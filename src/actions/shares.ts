'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { buySharesSchema, markSharesPaidSchema } from '@/lib/validators/member'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

/** Parse a form field that may be repeated (getAll) or a JSON array string. */
function parseStringArray(formData: FormData, key: string): string[] {
  const all = formData.getAll(key) as string[]
  // Multiple repeated fields — use directly
  if (all.length > 1) return all
  // Single value — could be a JSON array string
  if (all.length === 1) {
    try {
      const parsed = JSON.parse(all[0])
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Not JSON — treat as a single-element array
    }
    return all
  }
  return []
}

export async function buyShares(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = buySharesSchema.safeParse({
    names: parseStringArray(formData, 'names'),
    year: formData.get('year'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 2. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  // 3. Get user's family
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return {
      success: false,
      message: 'You must belong to a family to purchase shares',
    }
  }

  // 4. Insert one share row per name
  const rows = parsed.data.names.map((name) => ({
    family_id: profile.family_id,
    person_name: name,
    year: parsed.data.year,
    amount: 50,
    paid: false,
  }))

  const { error } = await supabase.from('shares').insert(rows)

  if (error) {
    console.error('[buyShares] DB error:', error.code, error.message)
    if (error.code === '23505') {
      return {
        success: false,
        message: 'One or more names already have shares for this year',
        errors: { names: ['Duplicate share entry for this year'] },
      }
    }
    return { success: false, message: 'Failed to purchase shares' }
  }

  // 5. Revalidate and return
  revalidatePath('/member')
  return {
    success: true,
    message: `${parsed.data.names.length} share(s) purchased successfully`,
  }
}

export async function markSharesPaid(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate
  const parsed = markSharesPaidSchema.safeParse({
    share_ids: parseStringArray(formData, 'share_ids'),
    method: formData.get('method'),
    note: formData.get('note') ?? undefined,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  // 2. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  // 3. Admin check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, message: 'Forbidden: admin access required' }
  }

  // 4. Fetch shares to get family_id and amount for payment records
  const { data: shares, error: fetchError } = await supabase
    .from('shares')
    .select('id, family_id, amount, paid')
    .in('id', parsed.data.share_ids)

  if (fetchError || !shares?.length) {
    return { success: false, message: 'Failed to find the specified shares' }
  }

  const alreadyPaid = shares.filter((s) => s.paid)
  if (alreadyPaid.length > 0) {
    return {
      success: false,
      message: `${alreadyPaid.length} share(s) are already marked as paid`,
    }
  }

  // 5. Mark shares as paid
  const { error: updateError } = await supabase
    .from('shares')
    .update({ paid: true })
    .in('id', parsed.data.share_ids)

  if (updateError) {
    console.error('[markSharesPaid] Update error:', updateError.code, updateError.message)
    return { success: false, message: 'Failed to mark shares as paid' }
  }

  // 6. Create payment records
  const paymentRows = shares.map((share) => ({
    family_id: share.family_id,
    type: 'share' as const,
    amount: share.amount,
    method: parsed.data.method,
    note: parsed.data.note || null,
    recorded_by: user.id,
    related_share_id: share.id,
  }))

  const { error: paymentError } = await supabase.from('payments').insert(paymentRows)

  if (paymentError) {
    console.error('[markSharesPaid] Payment insert error:', paymentError.code, paymentError.message)
    // Shares are already marked paid — log but don't fail the whole action
    return {
      success: true,
      message: 'Shares marked as paid but payment records could not be created. Please contact support.',
    }
  }

  // 7. Revalidate and return
  revalidatePath('/admin')
  return {
    success: true,
    message: `${shares.length} share(s) marked as paid`,
  }
}
