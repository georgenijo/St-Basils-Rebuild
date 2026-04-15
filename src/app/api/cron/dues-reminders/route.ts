import { NextResponse, type NextRequest } from 'next/server'
import type { ReactElement } from 'react'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { FROM_ADDRESS } from '@/lib/notifications'
import { DuesReminder } from '@/emails/dues-reminder'
import { MembershipExpired } from '@/emails/membership-expired'

export const dynamic = 'force-dynamic'

function utcDateOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

interface FamilyRow {
  id: string
  family_name: string | null
  membership_expires_at: string | null
}

interface ProfileRow {
  email: string | null
  notification_preferences: Record<string, unknown> | null
}

async function getOptedInEmails(
  supabase: ReturnType<typeof createAdminClient>,
  familyId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('email, notification_preferences')
    .eq('family_id', familyId)
    .not('email', 'is', null)

  if (error || !data) return []

  return (data as ProfileRow[])
    .filter((row) => {
      if (!row.email) return false
      const prefs = row.notification_preferences ?? {}
      const value = prefs.membership
      if (typeof value === 'boolean') return value
      return true
    })
    .map((row) => row.email as string)
}

async function sendBatch(
  supabase: ReturnType<typeof createAdminClient>,
  families: FamilyRow[],
  buildEmail: (family: FamilyRow) => { subject: string; react: ReactElement }
): Promise<number> {
  let sent = 0
  for (const family of families) {
    if (!family.membership_expires_at) continue
    const emails = await getOptedInEmails(supabase, family.id)
    if (emails.length === 0) continue

    const { subject, react } = buildEmail(family)
    try {
      const { error } = await sendEmail({ from: FROM_ADDRESS, to: emails, subject, react })
      if (error) {
        console.error('[dues-reminders] send failed for family', family.id, error)
      } else {
        sent += 1
      }
    } catch (err) {
      console.error('[dues-reminders] send threw for family', family.id, err)
    }
  }
  return sent
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const today = utcDateOffset(0)
    const in14 = utcDateOffset(14)
    const in3 = utcDateOffset(3)
    const yesterday = utcDateOffset(-1)

    const queryFor = async (date: string): Promise<FamilyRow[]> => {
      const { data, error } = await supabase
        .from('families')
        .select('id, family_name, membership_expires_at')
        .eq('membership_expires_at', date)

      if (error) {
        console.error('[dues-reminders] query failed for', date, error.message)
        return []
      }
      return (data ?? []) as FamilyRow[]
    }

    const [fams14, fams3, famsExpired] = await Promise.all([
      queryFor(in14),
      queryFor(in3),
      queryFor(yesterday),
    ])

    const reminders14 = await sendBatch(supabase, fams14, (family) => ({
      subject: 'Your membership expires in 14 days',
      react: DuesReminder({
        familyName: family.family_name ?? "St. Basil's",
        daysUntilExpiry: 14,
        expiryDate: formatDate(family.membership_expires_at as string),
      }),
    }))

    const reminders3 = await sendBatch(supabase, fams3, (family) => ({
      subject: 'Your membership expires in 3 days',
      react: DuesReminder({
        familyName: family.family_name ?? "St. Basil's",
        daysUntilExpiry: 3,
        expiryDate: formatDate(family.membership_expires_at as string),
      }),
    }))

    const expired = await sendBatch(supabase, famsExpired, (family) => ({
      subject: `Your membership expired on ${formatDate(family.membership_expires_at as string)}`,
      react: MembershipExpired({
        familyName: family.family_name ?? "St. Basil's",
        expiryDate: formatDate(family.membership_expires_at as string),
      }),
    }))

    const result = { today, reminders14, reminders3, expired }
    console.log('[dues-reminders] complete', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[dues-reminders] uncaught error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
