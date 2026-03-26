import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { APIRequestContext, Page } from '@playwright/test'

interface MockEmailRecord {
  id: string
  from: string
  to: string[]
  subject: string
  html?: string
  text?: string
  metadata: Record<string, string | null>
  createdAt: string
}

interface SubscriberRow {
  id: string
  email: string
  confirmed: boolean
  confirmed_at: string | null
  unsubscribe_token: string
  unsubscribed_at: string | null
}

interface EventRow {
  id: string
  slug: string
  start_at: string
  end_at: string | null
}

interface AnnouncementRow {
  id: string
  slug: string
  published_at: string | null
  send_email: boolean
}

let adminClient: SupabaseClient | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getBaseUrl(): string {
  return process.env.BASE_URL || 'http://127.0.0.1:3000'
}

function getTestSupportSecret(): string {
  return process.env.TEST_SUPPORT_SECRET || 'test-support-secret'
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}@example.com`
}

export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  }

  return adminClient
}

export async function clearMockEmails(request: APIRequestContext): Promise<void> {
  const response = await request.delete(`${getBaseUrl()}/api/test/email-sink`, {
    headers: { 'x-test-secret': getTestSupportSecret() },
  })

  if (!response.ok()) {
    throw new Error(`Failed to clear mock emails: ${response.status()} ${await response.text()}`)
  }
}

export async function waitForMockEmail(
  request: APIRequestContext,
  filters: { to?: string; subject?: string; template?: string },
  timeoutMs = 15_000
): Promise<MockEmailRecord> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const params = new URLSearchParams()
    if (filters.to) params.set('to', filters.to)
    if (filters.subject) params.set('subject', filters.subject)
    if (filters.template) params.set('template', filters.template)

    const response = await request.get(`${getBaseUrl()}/api/test/email-sink?${params.toString()}`, {
      headers: { 'x-test-secret': getTestSupportSecret() },
    })

    if (!response.ok()) {
      throw new Error(`Failed to list mock emails: ${response.status()} ${await response.text()}`)
    }

    const payload = (await response.json()) as { emails: MockEmailRecord[] }
    if (payload.emails.length > 0) {
      return payload.emails[0]
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for mock email ${JSON.stringify(filters)}`)
}

export async function loginAsSeedAdmin(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input#email').fill('admin@stbasilsboston.org')
  await page.locator('input#password').fill('admin123')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

export async function ensureConfirmedSubscriber(email: string): Promise<SubscriberRow> {
  const supabase = getAdminClient()

  await supabase.from('email_subscribers').delete().eq('email', email)

  const { data, error } = await supabase
    .from('email_subscribers')
    .insert({
      email,
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      unsubscribed_at: null,
    })
    .select('id, email, confirmed, confirmed_at, unsubscribe_token, unsubscribed_at')
    .single()

  if (error || !data) {
    throw new Error(`Failed to seed subscriber: ${error?.message || 'unknown error'}`)
  }

  return data as SubscriberRow
}

export async function fetchSubscriberByEmail(email: string): Promise<SubscriberRow> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('email_subscribers')
    .select('id, email, confirmed, confirmed_at, unsubscribe_token, unsubscribed_at')
    .eq('email', email)
    .single()

  if (error || !data) {
    throw new Error(`Failed to fetch subscriber ${email}: ${error?.message || 'not found'}`)
  }

  return data as SubscriberRow
}

export async function fetchEventBySlug(slug: string): Promise<EventRow> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, start_at, end_at')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    throw new Error(`Failed to fetch event ${slug}: ${error?.message || 'not found'}`)
  }

  return data as EventRow
}

export async function fetchAnnouncementBySlug(slug: string): Promise<AnnouncementRow> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('announcements')
    .select('id, slug, published_at, send_email')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    throw new Error(`Failed to fetch announcement ${slug}: ${error?.message || 'not found'}`)
  }

  return data as AnnouncementRow
}
