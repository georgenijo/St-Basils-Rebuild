'use client'

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import type { RefObject } from 'react'

interface CaptchaFieldProps {
  turnstileRef: RefObject<TurnstileInstance | null>
  theme: 'light' | 'dark'
  size?: 'normal' | 'compact'
}

const isTurnstileBypassEnabled =
  process.env.NEXT_PUBLIC_ALLOW_TURNSTILE_TEST_BYPASS === 'true'

const turnstileBypassToken =
  process.env.NEXT_PUBLIC_TURNSTILE_TEST_BYPASS_TOKEN || 'ci-turnstile-pass'

export function CaptchaField({
  turnstileRef,
  theme,
  size = 'normal',
}: CaptchaFieldProps) {
  if (isTurnstileBypassEnabled) {
    return <input type="hidden" name="cf-turnstile-response" value={turnstileBypassToken} />
  }

  return (
    <Turnstile
      ref={turnstileRef}
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      options={{ theme, size }}
    />
  )
}
