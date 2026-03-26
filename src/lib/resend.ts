import { Resend } from 'resend'

import { isMockEmailTransportEnabled } from '@/lib/test-support'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

export const resend = new Proxy({} as Resend, {
  get(_, prop) {
    return getResend()[prop as keyof Resend]
  },
})

export async function addContactToAudience(email: string): Promise<void> {
  if (isMockEmailTransportEnabled()) return

  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) return

  try {
    await getResend().contacts.create({ email, audienceId })
  } catch (error) {
    console.error('Failed to add contact to Resend Audience:', error)
  }
}

export async function removeContactFromAudience(email: string): Promise<void> {
  if (isMockEmailTransportEnabled()) return

  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) return

  try {
    await getResend().contacts.remove({ audienceId, email })
  } catch (error) {
    console.error('Failed to remove contact from Resend Audience:', error)
  }
}
