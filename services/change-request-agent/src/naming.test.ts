import { describe, expect, it } from 'vitest'

import {
  attachmentDisplayName,
  branchName,
  labelSlug,
  safeFilename,
  shortId,
  slugify,
} from './naming'

const ID = '3f2a9c1e-1234-4abc-9def-0123456789ab'

describe('branch naming', () => {
  it('uses the first 8 id chars and a title slug', () => {
    expect(shortId(ID)).toBe('3f2a9c1e')
    expect(branchName(ID, 'Change the homepage flyer caption!')).toBe(
      'change-request/3f2a9c1e-change-the-homepage-flyer-caption'
    )
  })

  it('handles accents, symbols, and empty slugs', () => {
    expect(slugify('Café  & Crème — Brûlée')).toBe('cafe-creme-brulee')
    expect(branchName(ID, '!!!')).toBe('change-request/3f2a9c1e-request')
  })

  it('caps slug length without a trailing dash', () => {
    const slug = slugify('a'.repeat(39) + ' bbbbbbbb')
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
  })

  it('never produces characters invalid in git refs', () => {
    const name = branchName(ID, 'feature..lock ~^:?*[\\ @{ end')
    expect(name).toMatch(/^change-request\/[a-z0-9-]+$/)
    expect(name).not.toContain('..')
  })
})

describe('safeFilename', () => {
  it('strips directories, dots and unsafe characters and keeps the extension', () => {
    expect(safeFilename('../../etc/My Photo (1).JPG')).toBe('my-photo-1.jpg')
    expect(safeFilename('.env')).toBe('file.env')
    expect(safeFilename('C:\\Users\\x\\scan.pdf')).toBe('scan.pdf')
    expect(safeFilename('noext')).toBe('noext')
  })
})

describe('attachmentDisplayName', () => {
  it('prefers the stored filename, else strips the uuid prefix', () => {
    expect(attachmentDisplayName('requests/x/attachments/abc.png', 'Flyer.png')).toBe('Flyer.png')
    expect(
      attachmentDisplayName(
        'requests/x/attachments/3f2a9c1e-1234-4abc-9def-0123456789ab-flyer.png',
        null
      )
    ).toBe('flyer.png')
  })
})

describe('labelSlug', () => {
  it('slugs verification labels', () => {
    expect(labelSlug('before · desktop')).toBe('before-desktop')
    expect(labelSlug('after · mobile')).toBe('after-mobile')
  })
})
