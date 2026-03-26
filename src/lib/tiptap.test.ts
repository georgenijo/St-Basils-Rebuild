import { describe, it, expect } from 'vitest'
import { renderTiptapHTML } from '@/lib/tiptap'

describe('renderTiptapHTML', () => {
  it('returns empty string for null', () => {
    expect(renderTiptapHTML(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(renderTiptapHTML(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(renderTiptapHTML('')).toBe('')
  })

  it('returns empty string for 0 (falsy)', () => {
    expect(renderTiptapHTML(0)).toBe('')
  })

  it('wraps plain text in a <p> tag and escapes HTML', () => {
    expect(renderTiptapHTML('Hello <b>world</b>')).toBe('<p>Hello &lt;b&gt;world&lt;/b&gt;</p>')
  })

  it('parses a JSON string containing a Tiptap doc', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    })
    const result = renderTiptapHTML(json)
    expect(result).toContain('Hello')
    expect(result).toMatch(/<p[\s>]/)
  })

  it('renders a Tiptap doc object directly', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test' }] }],
    }
    const result = renderTiptapHTML(doc)
    expect(result).toContain('Test')
  })

  it('returns empty string for a random object without type "doc"', () => {
    expect(renderTiptapHTML({ foo: 'bar' })).toBe('')
  })

  it('escapes ampersands in plain text', () => {
    expect(renderTiptapHTML('Tom & Jerry')).toBe('<p>Tom &amp; Jerry</p>')
  })

  it('escapes double quotes in plain text', () => {
    const result = renderTiptapHTML('She said "hi"')
    expect(result).toContain('&quot;')
  })
})
