'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { announcementSchema } from '@/lib/validators/announcement'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function createAnnouncement(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    body: formData.get('body'),
    priority: formData.get('priority'),
    is_pinned: formData.get('is_pinned') === 'true',
    expires_at: formData.get('expires_at'),
    send_email: formData.get('send_email') === 'true',
    published: formData.get('published') === 'true',
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

  // 3. Parse body JSON
  let bodyJson = null
  if (parsed.data.body) {
    try {
      bodyJson = JSON.parse(parsed.data.body)
    } catch {
      bodyJson = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: parsed.data.body }] }] }
    }
  }

  // 4. Insert announcement
  const { error } = await supabase
    .from('announcements')
    .insert({
      title: parsed.data.title,
      slug: parsed.data.slug,
      body: bodyJson,
      priority: parsed.data.priority,
      is_pinned: parsed.data.is_pinned,
      expires_at: parsed.data.expires_at || null,
      send_email: parsed.data.send_email,
      published_at: parsed.data.published ? new Date().toISOString() : null,
      author_id: user.id,
    })

  if (error) {
    if (error.code === '23505') {
      return { success: false, message: 'An announcement with this slug already exists', errors: { slug: ['Slug is already taken'] } }
    }
    return { success: false, message: 'Failed to create announcement' }
  }

  // 5. Revalidate and return
  revalidatePath('/admin/announcements')
  return { success: true, message: 'Announcement created successfully' }
}

export async function updateAnnouncement(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const announcementId = formData.get('announcement_id') as string
  if (!announcementId) return { success: false, message: 'Announcement ID is required' }

  // 1. Validate with Zod
  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    body: formData.get('body'),
    priority: formData.get('priority'),
    is_pinned: formData.get('is_pinned') === 'true',
    expires_at: formData.get('expires_at'),
    send_email: formData.get('send_email') === 'true',
    published: formData.get('published') === 'true',
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

  // 3. Fetch existing to check published_at transition
  const { data: existing } = await supabase
    .from('announcements')
    .select('published_at')
    .eq('id', announcementId)
    .single()

  // 4. Parse body JSON
  let bodyJson = null
  if (parsed.data.body) {
    try {
      bodyJson = JSON.parse(parsed.data.body)
    } catch {
      bodyJson = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: parsed.data.body }] }] }
    }
  }

  // 5. Determine published_at
  let publishedAt: string | null = null
  if (parsed.data.published) {
    // Keep existing published_at if already published, otherwise set now
    publishedAt = existing?.published_at ?? new Date().toISOString()
  }

  // 6. Update announcement
  const { error } = await supabase
    .from('announcements')
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      body: bodyJson,
      priority: parsed.data.priority,
      is_pinned: parsed.data.is_pinned,
      expires_at: parsed.data.expires_at || null,
      send_email: parsed.data.send_email,
      published_at: publishedAt,
    })
    .eq('id', announcementId)

  if (error) {
    if (error.code === '23505') {
      return { success: false, message: 'An announcement with this slug already exists', errors: { slug: ['Slug is already taken'] } }
    }
    return { success: false, message: 'Failed to update announcement' }
  }

  // 7. Revalidate and return
  revalidatePath('/admin/announcements')
  return { success: true, message: 'Announcement updated successfully' }
}

export async function deleteAnnouncement(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const announcementId = formData.get('announcement_id') as string
  if (!announcementId) return { success: false, message: 'Announcement ID is required' }

  // 1. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  // 2. Delete announcement
  const { error } = await supabase.from('announcements').delete().eq('id', announcementId)

  if (error) {
    return { success: false, message: 'Failed to delete announcement' }
  }

  // 3. Revalidate and return
  revalidatePath('/admin/announcements')
  return { success: true, message: 'Announcement deleted successfully' }
}
