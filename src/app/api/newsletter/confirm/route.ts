import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { addContactToAudience } from '@/lib/resend'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/?confirmed=invalid', req.url))
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Look up subscriber by confirmation token
  const { data: subscriber, error: fetchError } = await supabase
    .from('email_subscribers')
    .select('id, email, confirmed')
    .eq('confirmation_token', token)
    .single()

  if (fetchError || !subscriber) {
    return NextResponse.redirect(new URL('/?confirmed=invalid', req.url))
  }

  if (subscriber.confirmed) {
    return NextResponse.redirect(new URL('/?confirmed=already', req.url))
  }

  // Activate subscription — clear unsubscribed_at in case of re-subscribe
  const { error: updateError } = await supabase
    .from('email_subscribers')
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      unsubscribed_at: null,
    })
    .eq('id', subscriber.id)

  if (updateError) {
    console.error('Failed to confirm subscriber:', updateError)
    return NextResponse.redirect(new URL('/?confirmed=error', req.url))
  }

  // Sync to Resend Audience
  await addContactToAudience(subscriber.email)

  return NextResponse.redirect(new URL('/?confirmed=success', req.url))
}
