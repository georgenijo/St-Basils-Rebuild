import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { removeContactFromAudience } from '@/lib/resend'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/?unsubscribed=invalid', req.url))
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Deactivate subscription
  const { data: subscriber, error } = await supabase
    .from('email_subscribers')
    .update({
      confirmed: false,
      confirmed_at: null,
    })
    .eq('unsubscribe_token', token)
    .select('id, email')
    .single()

  if (error || !subscriber) {
    return NextResponse.redirect(new URL('/?unsubscribed=invalid', req.url))
  }

  // Remove from Resend Audience
  await removeContactFromAudience(subscriber.email)

  return NextResponse.redirect(new URL('/?unsubscribed=success', req.url))
}
