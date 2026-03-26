/**
 * Validates that a redirect URL is internal-only to prevent open redirect attacks.
 * Must start with `/` and not contain protocol schemes or protocol-relative URLs.
 */
export function isValidRedirectUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('://')
}
