'use server'

import { revalidatePath } from 'next/cache'

import { parseDatetimeLocalInTimeZone } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import {
  eventInstanceSchema,
  cancelInstanceSchema,
  restoreInstanceSchema,
} from '@/lib/validators/event'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

function revalidateEventPaths() {
  revalidatePath('/admin/events')
  revalidatePath('/admin/events/calendar')
  revalidatePath('/events')
}

export async function upsertEventInstance(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = eventInstanceSchema.safeParse({
    event_id: formData.get('event_id'),
    original_date: formData.get('original_date'),
    start_at: formData.get('start_at') ?? '',
    end_at: formData.get('end_at') ?? '',
    location: formData.get('location') ?? '',
    note: formData.get('note') ?? '',
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  // original_date is already UTC — store directly, no timezone conversion
  const originalDate = parsed.data.original_date

  // start_at/end_at are in church timezone (datetime-local format) — convert to UTC
  const startAtOverride = parsed.data.start_at
    ? parseDatetimeLocalInTimeZone(parsed.data.start_at)
    : null
  const endAtOverride = parsed.data.end_at ? parseDatetimeLocalInTimeZone(parsed.data.end_at) : null

  if (parsed.data.start_at && !startAtOverride) {
    return {
      success: false,
      message: 'Validation failed',
      errors: { start_at: ['Start time is invalid.'] },
    }
  }

  if (parsed.data.end_at && !endAtOverride) {
    return {
      success: false,
      message: 'Validation failed',
      errors: { end_at: ['End time is invalid.'] },
    }
  }

  const { error } = await supabase.from('event_instances').upsert(
    {
      event_id: parsed.data.event_id,
      original_date: originalDate,
      is_cancelled: false,
      start_at_override: startAtOverride,
      end_at_override: endAtOverride,
      location_override: parsed.data.location || null,
      note: parsed.data.note || null,
      modified_by: user.id,
    },
    { onConflict: 'event_id,original_date' }
  )

  if (error) {
    console.error('[upsertEventInstance] DB error:', error.message)
    return { success: false, message: 'Failed to update occurrence' }
  }

  revalidateEventPaths()
  return { success: true, message: 'Occurrence updated successfully' }
}

export async function cancelEventInstance(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = cancelInstanceSchema.safeParse({
    event_id: formData.get('event_id'),
    original_date: formData.get('original_date'),
    note: formData.get('note') ?? '',
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  const { error } = await supabase.from('event_instances').upsert(
    {
      event_id: parsed.data.event_id,
      original_date: parsed.data.original_date,
      is_cancelled: true,
      start_at_override: null,
      end_at_override: null,
      location_override: null,
      note: parsed.data.note || null,
      modified_by: user.id,
    },
    { onConflict: 'event_id,original_date' }
  )

  if (error) {
    console.error('[cancelEventInstance] DB error:', error.message)
    return { success: false, message: 'Failed to cancel occurrence' }
  }

  revalidateEventPaths()
  return { success: true, message: 'Occurrence cancelled' }
}

export async function restoreEventInstance(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = restoreInstanceSchema.safeParse({
    event_id: formData.get('event_id'),
    original_date: formData.get('original_date'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  const { error } = await supabase
    .from('event_instances')
    .delete()
    .eq('event_id', parsed.data.event_id)
    .eq('original_date', parsed.data.original_date)

  if (error) {
    console.error('[restoreEventInstance] DB error:', error.message)
    return { success: false, message: 'Failed to restore occurrence' }
  }

  revalidateEventPaths()
  return { success: true, message: 'Occurrence restored to regular schedule' }
}
