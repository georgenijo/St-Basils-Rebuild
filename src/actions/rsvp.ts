'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { verifyTurnstile } from '@/lib/turnstile'
import { rsvpSchema } from '@/lib/validators/rsvp'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function submitRsvp(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const slug = formData.get('slug') as string
  if (!slug) {
    return { success: false, message: 'Event not found' }
  }

  // 1. Validate with Zod
  const parsed = rsvpSchema.safeParse({
    name: formData.get('name'),
    headcount: formData.get('headcount'),
    children_count: formData.get('children_count') || null,
    dietary: formData.get('dietary') || null,
    bringing: formData.get('bringing') || null,
    notes: formData.get('notes') || null,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 2. Turnstile CAPTCHA verification
  const turnstileToken = formData.get('cf-turnstile-response') as string
  if (!turnstileToken) {
    return { success: false, message: 'Please complete the CAPTCHA' }
  }

  const turnstileValid = await verifyTurnstile(turnstileToken)
  if (!turnstileValid) {
    return { success: false, message: 'CAPTCHA verification failed' }
  }

  // 3. Look up event by slug
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('id, rsvp_settings')
    .eq('slug', slug)
    .single()

  if (!event) {
    return { success: false, message: 'Event not found' }
  }

  const rsvpSettings = (event.rsvp_settings as Record<string, unknown>) ?? {}
  if (rsvpSettings.enabled !== true) {
    return { success: false, message: 'RSVP is not enabled for this event' }
  }

  // 4. Check if user is logged in and get family_id
  let familyId: string | null = null
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single()

    familyId = profile?.family_id ?? null
  }

  // 5. Upsert RSVP
  const { error } = await supabase.from('event_rsvps').upsert(
    {
      event_id: event.id,
      family_id: familyId,
      name: parsed.data.name,
      headcount: parsed.data.headcount,
      children_count: parsed.data.children_count ?? null,
      dietary: parsed.data.dietary ?? null,
      bringing: parsed.data.bringing ?? null,
      notes: parsed.data.notes ?? null,
    },
    { onConflict: 'event_id,name' }
  )

  if (error) {
    console.error('[submitRsvp] DB upsert failed:', error.code, error.message)
    return { success: false, message: 'Failed to submit RSVP. Please try again.' }
  }

  // 6. Revalidate
  revalidatePath(`/rsvp/${slug}`)

  return {
    success: true,
    message: `Thanks, ${parsed.data.name}! You're in for ${parsed.data.headcount} ${parsed.data.headcount === 1 ? 'person' : 'people'}.`,
  }
}
