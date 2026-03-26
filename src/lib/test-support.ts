import 'server-only'

const DEFAULT_TURNSTILE_BYPASS_TOKEN = 'ci-turnstile-pass'

export function isE2EModeEnabled(): boolean {
  return process.env.E2E_MODE === 'ci' || process.env.E2E_MODE === 'test'
}

export function isTestSupportEnabled(): boolean {
  return process.env.TEST_SUPPORT_ENABLED === 'true' || isE2EModeEnabled()
}

export function isMockEmailTransportEnabled(): boolean {
  return process.env.EMAIL_TRANSPORT === 'mock' && isTestSupportEnabled()
}

export function isTurnstileBypassEnabled(): boolean {
  return process.env.ALLOW_TURNSTILE_TEST_BYPASS === 'true' && isTestSupportEnabled()
}

export function getTurnstileBypassToken(): string {
  return (
    process.env.TURNSTILE_TEST_BYPASS_TOKEN ||
    process.env.NEXT_PUBLIC_TURNSTILE_TEST_BYPASS_TOKEN ||
    DEFAULT_TURNSTILE_BYPASS_TOKEN
  )
}

export function getTestSupportSecret(): string {
  return process.env.TEST_SUPPORT_SECRET || ''
}

export function isAuthorizedTestSupportRequest(secretHeader: string | null): boolean {
  const expectedSecret = getTestSupportSecret()
  return Boolean(expectedSecret && secretHeader === expectedSecret)
}
