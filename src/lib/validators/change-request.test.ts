import { describe, expect, it } from 'vitest'

import {
  attachmentUploadRequestSchema,
  changeRequestMessageSchema,
  changeRequestSchema,
  detectAttachmentType,
  findAttachmentMention,
  formatBytes,
  guessAttachmentType,
  sanitizeAttachmentFilename,
} from '@/lib/validators/change-request'

const VALID = {
  title: 'Replace feast flyer',
  description: 'Swap the homepage flyer for the attached 2026 version.',
  page_path: '/',
}

describe('changeRequestSchema', () => {
  it('accepts a minimal request and drops blank optional fields', () => {
    const result = changeRequestSchema.safeParse({
      ...VALID,
      target_selector: '',
      target_text: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.target_selector).toBeUndefined()
      expect(result.data.target_text).toBeUndefined()
    }
  })

  it.each(['/', '/giving', '/announcements/feast-2026', '/a/b_c.d~e-f/'])(
    'accepts the site path %s',
    (page_path) => {
      expect(changeRequestSchema.safeParse({ ...VALID, page_path }).success).toBe(true)
    }
  )

  it('trims fields and keeps the picked element', () => {
    const result = changeRequestSchema.safeParse({
      title: '  Replace feast flyer  ',
      description: VALID.description,
      page_path: ' /giving ',
      target_selector: ' #feast-flyer ',
      target_text: ' Feast of St. Basil ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Replace feast flyer')
      expect(result.data.page_path).toBe('/giving')
      expect(result.data.target_selector).toBe('#feast-flyer')
      expect(result.data.target_text).toBe('Feast of St. Basil')
    }
  })

  it.each([
    ['title too short', { title: 'Hi' }, 'title'],
    ['title too long', { title: 'x'.repeat(121) }, 'title'],
    ['description too short', { description: 'short' }, 'description'],
    ['description too long', { description: 'x'.repeat(5001) }, 'description'],
    ['missing title', { title: null }, 'title'],
    ['relative path', { page_path: 'giving' }, 'page_path'],
    ['protocol-relative URL', { page_path: '//example.com' }, 'page_path'],
    ['protocol-relative with path', { page_path: '//example.com/giving' }, 'page_path'],
    ['triple slash', { page_path: '///example.com' }, 'page_path'],
    ['backslash host', { page_path: '/\\example.com' }, 'page_path'],
    ['empty', { page_path: '' }, 'page_path'],
    ['absolute URL', { page_path: 'https://evil.example/' }, 'page_path'],
    ['query string', { page_path: '/giving?x=1' }, 'page_path'],
    ['path too long', { page_path: `/${'a'.repeat(300)}` }, 'page_path'],
    ['selector too long', { target_selector: 'div'.repeat(400) }, 'target_selector'],
    ['target text too long', { target_text: 'x'.repeat(501) }, 'target_text'],
  ])('rejects %s', (_label, override, field) => {
    const result = changeRequestSchema.safeParse({ ...VALID, ...override })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty(field)
    }
  })
})

describe('changeRequestMessageSchema', () => {
  const requestId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts a reply', () => {
    expect(
      changeRequestMessageSchema.safeParse({ request_id: requestId, body: 'Yes' }).success
    ).toBe(true)
  })

  it('rejects blank, oversized, or unattached replies', () => {
    expect(
      changeRequestMessageSchema.safeParse({ request_id: requestId, body: '   ' }).success
    ).toBe(false)
    expect(
      changeRequestMessageSchema.safeParse({ request_id: requestId, body: 'x'.repeat(5001) })
        .success
    ).toBe(false)
    expect(changeRequestMessageSchema.safeParse({ request_id: 'nope', body: 'Hi' }).success).toBe(
      false
    )
  })
})

function bytes(...values: (number | string)[]): Uint8Array {
  return new Uint8Array(
    values.flatMap((value) =>
      typeof value === 'string' ? Array.from(value, (c) => c.charCodeAt(0)) : [value]
    )
  )
}

describe('detectAttachmentType', () => {
  it.each([
    ['image/png', bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0)],
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/gif', bytes('GIF89a', 1, 0)],
    ['image/gif', bytes('GIF87a', 1, 0)],
    ['image/webp', bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 ')],
    ['application/pdf', bytes('%PDF-1.7\n')],
  ])('detects %s from magic bytes', (expected, input) => {
    expect(detectAttachmentType(input)).toBe(expected)
  })

  it.each([
    ['HTML', bytes('<html><script>')],
    ['SVG', bytes('<svg xmlns=')],
    ['RIFF but not WebP', bytes('RIFF', 0, 0, 0, 0, 'AVI ')],
    ['truncated PNG', bytes(0x89, 'PN')],
    ['empty', new Uint8Array()],
  ])('rejects %s', (_label, input) => {
    expect(detectAttachmentType(input)).toBeNull()
  })
})

describe('sanitizeAttachmentFilename', () => {
  it('keeps a safe name and a matching extension', () => {
    expect(sanitizeAttachmentFilename('Feast Flyer 2026.PNG', 'image/png')).toBe(
      'Feast-Flyer-2026.png'
    )
    expect(sanitizeAttachmentFilename('photo.jpeg', 'image/jpeg')).toBe('photo.jpeg')
  })

  it('strips paths, traversal, and unsafe characters', () => {
    expect(sanitizeAttachmentFilename('../../etc/passwd.png', 'image/png')).toBe('passwd.png')
    expect(sanitizeAttachmentFilename('C:\\Users\\me\\flyer.pdf', 'application/pdf')).toBe(
      'flyer.pdf'
    )
    expect(sanitizeAttachmentFilename('a<b>"alert(1)" ;rm.gif', 'image/gif')).toBe(
      'a-b-alert-1-rm.gif'
    )
  })

  it('replaces a mismatched extension with the detected type', () => {
    expect(sanitizeAttachmentFilename('flyer.exe', 'image/png')).toBe('flyer.png')
    expect(sanitizeAttachmentFilename('flyer', 'application/pdf')).toBe('flyer.pdf')
  })

  it('falls back to a default stem and bounds the length', () => {
    expect(sanitizeAttachmentFilename('...', 'image/png')).toBe('file.png')
    expect(sanitizeAttachmentFilename('.hidden', 'image/png')).toBe('hidden.png')
    expect(sanitizeAttachmentFilename('日本語.webp', 'image/webp')).toBe('file.webp')
    expect(sanitizeAttachmentFilename('Café menu.jpg', 'image/jpeg')).toBe('Cafe-menu.jpg')
    const long = sanitizeAttachmentFilename(`${'a'.repeat(300)}.png`, 'image/png')
    expect(long.length).toBeLessThanOrEqual(84)
    expect(long.endsWith('.png')).toBe(true)
  })
})

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('attachmentUploadRequestSchema', () => {
  it('accepts up to five allowed files within the size limit', () => {
    const files = Array.from({ length: 5 }, (_, i) => ({
      name: `f${i}.png`,
      type: 'image/png',
      size: 10 * 1024 * 1024,
    }))
    expect(attachmentUploadRequestSchema.safeParse(files).success).toBe(true)
  })

  it.each([
    ['no files', []],
    ['six files', Array.from({ length: 6 }, () => ({ name: 'a.png', type: 'image/png', size: 1 }))],
    ['svg', [{ name: 'a.svg', type: 'image/svg+xml', size: 1 }]],
    ['oversized', [{ name: 'a.png', type: 'image/png', size: 10 * 1024 * 1024 + 1 }]],
    ['empty', [{ name: 'a.png', type: 'image/png', size: 0 }]],
    ['fractional size', [{ name: 'a.png', type: 'image/png', size: 1.5 }]],
    ['blank name', [{ name: ' ', type: 'image/png', size: 1 }]],
  ])('rejects %s', (_label, files) => {
    expect(attachmentUploadRequestSchema.safeParse(files).success).toBe(false)
  })
})

describe('guessAttachmentType', () => {
  it('uses an allowed declared type, else the extension when undeclared', () => {
    expect(guessAttachmentType('a.bin', 'image/png')).toBe('image/png')
    expect(guessAttachmentType('photo.JPG', '')).toBe('image/jpeg')
    expect(guessAttachmentType('doc.pdf', '')).toBe('application/pdf')
    expect(guessAttachmentType('a.svg', 'image/svg+xml')).toBeNull()
    expect(guessAttachmentType('a.exe', '')).toBeNull()
  })
})

describe('findAttachmentMention', () => {
  it.each([
    ['replace flyer on home page', 'use attached image', 'flyer'],
    ['Update the photo', 'Swap the staff photo for the new one.', 'photo'],
    ['New schedule', 'Please link the attached PDF from the giving page.', 'attached'],
    ['Bulletin', 'See attachment for the wording.', 'attachment'],
    ['Poster', 'Put up the Easter poster, file enclosed.', 'Poster'],
  ])('finds a mention in %j / %j', (title, description, word) => {
    expect(findAttachmentMention(title, description)).toBe(word)
  })

  it.each([
    ['Fix typo', 'Change "Qurbana" to "Qurbono" in the footer.'],
    ['Imagine', 'Imagined wording: reword the profile section intro.'],
    ['Text only', 'No attachment needed, just update the service time to 9:15 AM.'],
    ['Wording', 'Without an image, reword the heading to "Welcome".'],
    ['Wording', "We don't need a photo here; shorten the paragraph."],
  ])('ignores %j / %j', (title, description) => {
    expect(findAttachmentMention(title, description)).toBeNull()
  })

  it('keeps looking after a negated mention', () => {
    expect(
      findAttachmentMention('No image change', 'Keep the layout, but use the attached flyer.')
    ).toBe('attached')
  })
})
