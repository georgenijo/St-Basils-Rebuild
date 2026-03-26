import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_URL = 'https://api.resend.com/emails/batch'
const CHURCH_NAME = "St. Basil's Syriac Orthodox Church"
const CHURCH_ADDRESS = '73 Ellis Street, Newton, MA 02464'
const FROM_EMAIL = 'announcements@stbasilsboston.org'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://stbasilsboston.org'
const RESEND_BATCH_LIMIT = 100
const EMAIL_TRANSPORT = Deno.env.get('EMAIL_TRANSPORT') ?? 'resend'
const EMAIL_SINK_BASE_URL = Deno.env.get('EMAIL_SINK_BASE_URL')
const TEST_SUPPORT_SECRET = Deno.env.get('TEST_SUPPORT_SECRET')

// ─── Types ──────────────────────────────────────────────────────────

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE'
  table: string
  schema: string
  record: AnnouncementRecord
}

interface AnnouncementRecord {
  id: string
  title: string
  slug: string
  body: TiptapNode | null
  send_email: boolean
  email_sent_at: string | null
  published_at: string | null
}

interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  attrs?: Record<string, unknown>
  marks?: TiptapMark[]
}

interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

interface Subscriber {
  email: string
  name: string | null
  unsubscribe_token: string
}

// ─── Tiptap JSON → HTML ─────────────────────────────────────────────

function tiptapToHtml(node: TiptapNode): string {
  if (node.type === 'text') {
    let html = escapeHtml(node.text ?? '')
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            html = `<strong>${html}</strong>`
            break
          case 'italic':
            html = `<em>${html}</em>`
            break
          case 'strike':
            html = `<s>${html}</s>`
            break
          case 'code':
            html = `<code>${html}</code>`
            break
          case 'link': {
            const href = escapeAttr(String(mark.attrs?.href ?? ''))
            html = `<a href="${href}" style="color:#9B1B3D;text-decoration:underline;">${html}</a>`
            break
          }
        }
      }
    }
    return html
  }

  const children = (node.content ?? []).map(tiptapToHtml).join('')

  switch (node.type) {
    case 'doc':
      return children
    case 'paragraph':
      return `<p style="margin:0 0 12px;line-height:1.6;color:#4A3729;">${children}</p>`
    case 'heading': {
      const level = node.attrs?.level ?? 2
      const fontSize = level === 1 ? '24px' : level === 2 ? '20px' : '18px'
      return `<h${level} style="margin:20px 0 8px;font-size:${fontSize};font-weight:600;color:#352618;">${children}</h${level}>`
    }
    case 'bulletList':
      return `<ul style="margin:0 0 12px;padding-left:24px;color:#4A3729;">${children}</ul>`
    case 'orderedList':
      return `<ol style="margin:0 0 12px;padding-left:24px;color:#4A3729;">${children}</ol>`
    case 'listItem':
      return `<li style="margin:0 0 4px;line-height:1.6;">${children}</li>`
    case 'blockquote':
      return `<blockquote style="margin:0 0 12px;padding:8px 16px;border-left:3px solid #D4A017;color:#4A3729;font-style:italic;">${children}</blockquote>`
    case 'codeBlock':
      return `<pre style="margin:0 0 12px;padding:12px;background:#f5f5f5;border-radius:4px;overflow-x:auto;"><code>${children}</code></pre>`
    case 'horizontalRule':
      return `<hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;" />`
    case 'hardBreak':
      return '<br />'
    default:
      return children
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ─── Email HTML Builder ──────────────────────────────────────────────

function buildEmailHtml(announcement: AnnouncementRecord, unsubscribeUrl: string): string {
  const bodyHtml = announcement.body ? tiptapToHtml(announcement.body) : '<p>No content</p>'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f6;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background-color:#253341;padding:24px 32px;text-align:center;">
            <span style="font-size:18px;font-weight:600;color:#FFFDF8;letter-spacing:0.02em;">${escapeHtml(CHURCH_NAME)}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#352618;line-height:1.3;">
              ${escapeHtml(announcement.title)}
            </h1>
            <hr style="border:none;border-top:2px solid #D4A017;width:60px;margin:0 0 24px;" />
            ${bodyHtml}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr><td>
                <a href="${SITE_URL}/announcements/${encodeURIComponent(announcement.slug)}"
                   style="display:inline-block;padding:10px 24px;background-color:#9B1B3D;color:#FFFDF8;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
                  Read on our website
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #e5e5e5;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
              ${escapeHtml(CHURCH_NAME)}<br />
              ${escapeHtml(CHURCH_ADDRESS)}
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
              <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
              from future announcements.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Resend Batch Send ───────────────────────────────────────────────

async function sendBatch(
  emails: {
    from: string
    to: string
    subject: string
    html: string
    metadata?: Record<string, string>
  }[],
  apiKey?: string
): Promise<{ success: boolean; error?: string }> {
  if (EMAIL_TRANSPORT === 'mock') {
    if (!EMAIL_SINK_BASE_URL || !TEST_SUPPORT_SECRET) {
      return {
        success: false,
        error: 'EMAIL_SINK_BASE_URL and TEST_SUPPORT_SECRET are required for mock transport',
      }
    }

    for (const email of emails) {
      const res = await fetch(`${EMAIL_SINK_BASE_URL}/api/test/email-sink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-secret': TEST_SUPPORT_SECRET,
        },
        body: JSON.stringify(email),
      })

      if (!res.ok) {
        const body = await res.text()
        return { success: false, error: `Email sink ${res.status}: ${body}` }
      }
    }

    return { success: true }
  }

  if (!apiKey) {
    return { success: false, error: 'Resend API key is required' }
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emails),
  })

  if (!res.ok) {
    const body = await res.text()
    return { success: false, error: `Resend API ${res.status}: ${body}` }
  }

  return { success: true }
}

// ─── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verify authorization
  const authHeader = req.headers.get('Authorization')
  const expectedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (EMAIL_TRANSPORT !== 'mock' && !resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { record } = payload

  // Idempotency: skip if already sent or conditions not met
  if (!record.send_email || record.email_sent_at || !record.published_at) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'Conditions not met for sending' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Create Supabase admin client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Double-check idempotency from DB (race condition guard)
  const { data: freshRecord, error: fetchError } = await supabase
    .from('announcements')
    .select('email_sent_at')
    .eq('id', record.id)
    .single()

  if (fetchError || freshRecord?.email_sent_at) {
    return new Response(JSON.stringify({ skipped: true, reason: 'Already sent (DB check)' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch active, confirmed, non-unsubscribed subscribers
  const { data: subscribers, error: subError } = await supabase
    .from('email_subscribers')
    .select('email, name, unsubscribe_token')
    .eq('confirmed', true)
    .is('unsubscribed_at', null)

  if (subError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch subscribers', details: subError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!subscribers || subscribers.length === 0) {
    // Mark as sent even with no subscribers to avoid retrying
    await supabase
      .from('announcements')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', record.id)

    return new Response(JSON.stringify({ sent: 0, reason: 'No active subscribers' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Build and send emails in batches
  const subject = record.title
  let totalSent = 0
  const errors: string[] = []

  for (let i = 0; i < subscribers.length; i += RESEND_BATCH_LIMIT) {
    const batch = (subscribers as Subscriber[]).slice(i, i + RESEND_BATCH_LIMIT)
    const emails = batch.map((sub) => {
      const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${sub.unsubscribe_token}`
      return {
        from: `${CHURCH_NAME} <${FROM_EMAIL}>`,
        to: sub.email,
        subject,
        html: buildEmailHtml(record, unsubscribeUrl),
        metadata: {
          template: 'announcement-broadcast',
          announcementId: record.id,
          announcementUrl: `${SITE_URL}/announcements/${record.slug}`,
          unsubscribeUrl,
        },
      }
    })

    const result = await sendBatch(emails, resendApiKey)
    if (result.success) {
      totalSent += batch.length
    } else {
      errors.push(result.error ?? 'Unknown error')
    }
  }

  // Only mark as sent when ALL batches succeeded — partial failures
  // leave email_sent_at NULL so a manual retry can re-trigger the webhook.
  if (errors.length === 0) {
    await supabase
      .from('announcements')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('id', record.id)
  }

  const status = errors.length === 0 ? 200 : 500
  return new Response(
    JSON.stringify({
      sent: totalSent,
      total: subscribers.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
})
