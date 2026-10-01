import type { Config } from './config'
import { log } from './log'
import type { ChangeRequest } from './types'

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch
  )
}

export interface NotifyInput {
  request: Pick<ChangeRequest, 'id' | 'title' | 'verification' | 'pr_url' | 'preview_url'>
  status: 'ready_for_review' | 'needs_attention'
  headline: string
  /** Resend request timeout; shorter during shutdown. Default 20 s. */
  timeoutMs?: number
}

/** Email George about a request needing him. Never throws. */
export async function notify(config: Config, input: NotifyInput): Promise<void> {
  const { request, status } = input
  const adminLink = `${config.siteUrl}/admin/requests/${request.id}`
  const verdict = request.verification?.verdict ?? 'n/a'
  const subject =
    status === 'ready_for_review'
      ? `Change request ready for review: ${request.title}`
      : `Change request needs attention: ${request.title}`
  const lines: [string, string | null][] = [
    ['Request', request.title],
    ['Status', status.replace(/_/g, ' ')],
    ['Verdict', verdict],
    ['What happened', input.headline],
    ['Pull request', request.pr_url],
    ['Preview', request.preview_url],
    ['Admin', adminLink],
  ]
  const text = lines
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  if (!config.resendApiKey || !config.notifyEmail) {
    log.info('notification (email not configured)', { requestId: request.id, subject, text })
    return
  }
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">${lines
    .filter(([, value]) => value)
    .map(([key, value]) => {
      const v = escapeHtml(value as string)
      const rendered = /^https?:\/\//.test(value as string) ? `<a href="${v}">${v}</a>` : v
      return `<p style="margin:0 0 8px"><strong>${escapeHtml(key)}:</strong> ${rendered}</p>`
    })
    .join('')}</div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.notifyFrom,
        to: config.notifyEmail
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 20_000),
    })
    if (!res.ok) {
      log.warn('notification email failed', {
        requestId: request.id,
        status: res.status,
        body: (await res.text()).slice(0, 300),
      })
      return
    }
    log.info('notification email sent', { requestId: request.id, status })
  } catch (error) {
    log.warn('notification email failed', { requestId: request.id, error: String(error) })
  }
}
