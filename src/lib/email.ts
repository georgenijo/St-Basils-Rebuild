import 'server-only'

import type { ReactElement } from 'react'

import { storeMockEmail } from '@/lib/email-sink'
import { resend } from '@/lib/resend'
import { isMockEmailTransportEnabled } from '@/lib/test-support'

interface SendEmailPayload {
  from: string
  to: string | string[]
  subject: string
  react?: ReactElement
  html?: string
  text?: string
  metadata?: Record<string, string | null>
}

interface SendEmailResult {
  data: unknown
  error: unknown
}

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  if (isMockEmailTransportEnabled()) {
    const record = await storeMockEmail({
      from: payload.from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      metadata: payload.metadata ?? {},
    })

    return { data: record, error: null }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { metadata: _metadata, ...message } = payload
  const result = await resend.emails.send(message as Parameters<typeof resend.emails.send>[0])
  return { data: result.data, error: result.error }
}
