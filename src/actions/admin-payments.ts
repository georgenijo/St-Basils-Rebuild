'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { assignEventCostsSchema, recordPaymentSchema } from '@/lib/validators/member'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Unauthorized' as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { user: null, error: 'Forbidden: admin access required' as const }

  return { user, error: null }
}

export async function assignEventCosts(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Parse charges JSON from formData
  const chargesRaw = formData.get('charges')
  let chargesParsed: unknown
  try {
    chargesParsed = typeof chargesRaw === 'string' ? JSON.parse(chargesRaw) : []
  } catch {
    return {
      success: false,
      message: 'Validation failed',
      errors: { charges: ['Invalid charges format'] },
    }
  }

  // 2. Validate with Zod
  const parsed = assignEventCostsSchema.safeParse({
    event_id: formData.get('event_id'),
    charges: chargesParsed,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 3. Auth check — admin only
  const supabase = await createClient()
  const { user, error: authError } = await requireAdmin(supabase)
  if (!user) return { success: false, message: authError }

  // 4. Insert event charges
  const rows = parsed.data.charges.map((charge) => ({
    event_id: parsed.data.event_id,
    family_id: charge.family_id,
    amount: charge.amount,
  }))

  const { error } = await supabase.from('event_charges').insert(rows)

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        message: 'One or more families already have a charge for this event',
      }
    }
    console.error('[assignEventCosts] DB error:', error.message)
    return { success: false, message: 'Failed to assign event costs' }
  }

  // 5. Revalidate and return
  revalidatePath('/admin')
  return { success: true, message: `Assigned costs to ${parsed.data.charges.length} families` }
}

export async function recordPaymentReceived(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = recordPaymentSchema.safeParse({
    family_id: formData.get('family_id'),
    type: formData.get('type'),
    amount: formData.get('amount'),
    method: formData.get('method'),
    note: formData.get('note') ?? '',
    related_event_id: formData.get('related_event_id') ?? '',
    related_share_id: formData.get('related_share_id') ?? '',
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 2. Auth check — admin only
  const supabase = await createClient()
  const { user, error: authError } = await requireAdmin(supabase)
  if (!user) return { success: false, message: authError }

  // 3. Insert payment row
  const { error: paymentError } = await supabase.from('payments').insert({
    family_id: parsed.data.family_id,
    type: parsed.data.type,
    amount: parsed.data.amount,
    method: parsed.data.method,
    note: parsed.data.note || null,
    recorded_by: user.id,
    related_event_id: parsed.data.type === 'event' ? parsed.data.related_event_id : null,
    related_share_id: parsed.data.type === 'share' ? parsed.data.related_share_id : null,
  })

  if (paymentError) {
    console.error('[recordPaymentReceived] DB error:', paymentError.message)
    return { success: false, message: 'Failed to record payment' }
  }

  // 4. Apply side effects based on payment type
  let sideEffectWarning = ''

  if (parsed.data.type === 'event' && parsed.data.related_event_id) {
    const { error: chargeError } = await supabase
      .from('event_charges')
      .update({ paid: true })
      .eq('event_id', parsed.data.related_event_id)
      .eq('family_id', parsed.data.family_id)

    if (chargeError) {
      console.error('[recordPaymentReceived] Failed to mark charge as paid:', chargeError.message)
      sideEffectWarning = ' (but failed to mark event charge as paid — please check manually)'
    }
  }

  if (parsed.data.type === 'share' && parsed.data.related_share_id) {
    const { error: shareError } = await supabase
      .from('shares')
      .update({ paid: true })
      .eq('id', parsed.data.related_share_id)

    if (shareError) {
      console.error('[recordPaymentReceived] Failed to mark share as paid:', shareError.message)
      sideEffectWarning = ' (but failed to mark share as paid — please check manually)'
    }
  }

  if (parsed.data.type === 'membership') {
    // Fetch family to determine membership type and current expiry
    const { data: family } = await supabase
      .from('families')
      .select('membership_type, membership_expires_at')
      .eq('id', parsed.data.family_id)
      .single()

    if (family) {
      const today = new Date()
      const currentExpiry = family.membership_expires_at
        ? new Date(family.membership_expires_at)
        : today
      const baseDate = currentExpiry > today ? currentExpiry : today

      const newExpiry = new Date(baseDate)
      if (family.membership_type === 'monthly') {
        newExpiry.setMonth(newExpiry.getMonth() + 1)
      } else {
        // Default to annual (covers 'annual' and null/unset membership_type)
        newExpiry.setFullYear(newExpiry.getFullYear() + 1)
      }

      const { error: familyError } = await supabase
        .from('families')
        .update({
          membership_expires_at: newExpiry.toISOString().split('T')[0],
          membership_status: 'active',
        })
        .eq('id', parsed.data.family_id)

      if (familyError) {
        console.error(
          '[recordPaymentReceived] Failed to update membership expiry:',
          familyError.message
        )
        sideEffectWarning =
          ' (but failed to update membership expiry — please check manually)'
      }
    } else {
      sideEffectWarning = ' (but could not find family record to update membership expiry)'
    }
  }

  // 5. Revalidate and return
  revalidatePath('/admin')
  return {
    success: true,
    message: `Payment recorded successfully${sideEffectWarning}`,
  }
}
