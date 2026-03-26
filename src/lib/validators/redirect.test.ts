import { describe, it, expect } from 'vitest'

import { isValidRedirectUrl } from '@/lib/validators/redirect'

describe('isValidRedirectUrl', () => {
  it('accepts "/admin"', () => {
    expect(isValidRedirectUrl('/admin')).toBe(true)
  })

  it('accepts "/events/my-event"', () => {
    expect(isValidRedirectUrl('/events/my-event')).toBe(true)
  })

  it('accepts "/"', () => {
    expect(isValidRedirectUrl('/')).toBe(true)
  })

  it('accepts "/admin/dashboard"', () => {
    expect(isValidRedirectUrl('/admin/dashboard')).toBe(true)
  })

  it('rejects protocol-relative "//evil.com"', () => {
    expect(isValidRedirectUrl('//evil.com')).toBe(false)
  })

  it('rejects "https://evil.com"', () => {
    expect(isValidRedirectUrl('https://evil.com')).toBe(false)
  })

  it('rejects "http://evil.com"', () => {
    expect(isValidRedirectUrl('http://evil.com')).toBe(false)
  })

  it('rejects "javascript:alert(1)"', () => {
    expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects "ftp://evil.com"', () => {
    expect(isValidRedirectUrl('ftp://evil.com')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidRedirectUrl('')).toBe(false)
  })

  it('rejects path without leading slash', () => {
    expect(isValidRedirectUrl('admin')).toBe(false)
  })

  it('rejects "//evil.com/path"', () => {
    expect(isValidRedirectUrl('//evil.com/path')).toBe(false)
  })
})
