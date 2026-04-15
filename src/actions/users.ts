'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { inviteUserSchema, updateRoleSchema, userActionSchema } from '@/lib/validators/user'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function inviteUser(prevState: ActionState, formData: FormData): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = inviteUserSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
    newsletter_opt_in: formData.get('newsletter_opt_in'),
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

  // 4. Invite user via admin client (service role required for inviteUserByEmail)
  const adminClient = createAdminClient()
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { full_name: parsed.data.full_name },
    }
  )

  if (inviteError) {
    if (inviteError.message?.toLowerCase().includes('already')) {
      return {
        success: false,
        message: 'A user with this email already exists',
        errors: { email: ['This email is already registered'] },
      }
    }
    return { success: false, message: 'Failed to invite user' }
  }

  const newUserId = inviteData.user.id

  // 5. If role is admin, update the profile (handle_new_user trigger defaults to "member")
  if (parsed.data.role === 'admin') {
    const { error: roleError } = await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', newUserId)

    if (roleError) {
      return { success: false, message: 'User invited but failed to set admin role' }
    }
  }

  // 6. Auto-subscribe to newsletter if opted in. ignoreDuplicates preserves
  //    any prior unsubscribe / confirmation state on an existing row.
  if (parsed.data.newsletter_opt_in) {
    await adminClient.from('email_subscribers').upsert(
      {
        email: parsed.data.email,
        confirmed: true,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'email', ignoreDuplicates: true }
    )
  }

  // 7. Write audit log (authenticated client — RLS enforces admin-only inserts)
  await supabase.from('admin_audit_log').insert({
    actor_id: user.id,
    action: 'user.invite',
    target_user_id: newUserId,
    metadata: {
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      newsletter_opt_in: parsed.data.newsletter_opt_in,
    },
  })

  // 8. Revalidate and return
  revalidatePath('/admin/users')
  revalidatePath('/admin/subscribers')
  return { success: true, message: 'Invitation sent successfully' }
}

export async function updateUserRole(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = updateRoleSchema.safeParse({
    user_id: formData.get('user_id'),
    role: formData.get('role'),
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
  const { data: actorProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (actorProfile?.role !== 'admin') {
    return { success: false, message: 'Forbidden: admin access required' }
  }

  // 4. Self-protection
  if (parsed.data.user_id === user.id) {
    return { success: false, message: 'You cannot change your own role' }
  }

  // 5. Fetch target user's current role for audit metadata
  const { data: targetProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', parsed.data.user_id)
    .single()

  if (fetchError || !targetProfile) {
    return { success: false, message: 'User not found' }
  }

  if (targetProfile.role === parsed.data.role) {
    return { success: false, message: `User already has the "${parsed.data.role}" role` }
  }

  // 6. Update role (use admin client to bypass recursive RLS on profiles self-update policy)
  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.user_id)

  if (updateError) {
    return { success: false, message: 'Failed to update role' }
  }

  // 7. Write audit log (authenticated client — RLS enforces admin-only inserts)
  await supabase.from('admin_audit_log').insert({
    actor_id: user.id,
    action: 'user.role_change',
    target_user_id: parsed.data.user_id,
    metadata: {
      old_role: targetProfile.role,
      new_role: parsed.data.role,
    },
  })

  // 8. Revalidate and return
  revalidatePath('/admin/users')
  return { success: true, message: 'Role updated successfully' }
}

export async function deactivateUser(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = userActionSchema.safeParse({
    user_id: formData.get('user_id'),
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
  const { data: actorProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (actorProfile?.role !== 'admin') {
    return { success: false, message: 'Forbidden: admin access required' }
  }

  // 4. Self-protection: cannot deactivate yourself
  if (user.id === parsed.data.user_id) {
    return { success: false, message: 'You cannot deactivate your own account' }
  }

  const adminClient = createAdminClient()

  // 5. Set is_active = false on the profile
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ is_active: false })
    .eq('id', parsed.data.user_id)

  if (profileError) {
    return { success: false, message: 'Failed to deactivate user profile' }
  }

  // 6. Ban in Supabase auth (invalidates sessions)
  const { error: banError } = await adminClient.auth.admin.updateUserById(parsed.data.user_id, {
    ban_duration: '876000h',
  })

  if (banError) {
    // Rollback profile change
    await adminClient.from('profiles').update({ is_active: true }).eq('id', parsed.data.user_id)
    return { success: false, message: 'Failed to ban user in auth' }
  }

  // 7. Audit log (non-fatal)
  const { error: auditError } = await supabase.from('admin_audit_log').insert({
    actor_id: user.id,
    action: 'user.deactivate',
    target_user_id: parsed.data.user_id,
  })

  if (auditError) {
    console.error('Failed to write audit log for user.deactivate:', auditError)
  }

  // 8. Revalidate and return
  revalidatePath('/admin/users')
  return { success: true, message: 'User deactivated successfully' }
}

export async function reactivateUser(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = userActionSchema.safeParse({
    user_id: formData.get('user_id'),
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
  const { data: actorProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (actorProfile?.role !== 'admin') {
    return { success: false, message: 'Forbidden: admin access required' }
  }

  const adminClient = createAdminClient()

  // 4. Set is_active = true on the profile
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ is_active: true })
    .eq('id', parsed.data.user_id)

  if (profileError) {
    return { success: false, message: 'Failed to reactivate user profile' }
  }

  // 5. Unban in Supabase auth
  const { error: unbanError } = await adminClient.auth.admin.updateUserById(parsed.data.user_id, {
    ban_duration: 'none',
  })

  if (unbanError) {
    // Rollback profile change
    await adminClient.from('profiles').update({ is_active: false }).eq('id', parsed.data.user_id)
    return { success: false, message: 'Failed to unban user in auth' }
  }

  // 6. Audit log (non-fatal)
  const { error: auditError } = await supabase.from('admin_audit_log').insert({
    actor_id: user.id,
    action: 'user.reactivate',
    target_user_id: parsed.data.user_id,
  })

  if (auditError) {
    console.error('Failed to write audit log for user.reactivate:', auditError)
  }

  // 7. Revalidate and return
  revalidatePath('/admin/users')
  return { success: true, message: 'User reactivated successfully' }
}

export async function sendPasswordReset(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = userActionSchema.safeParse({
    user_id: formData.get('user_id'),
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

  // 3. Look up the target user's email from their profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', parsed.data.user_id)
    .single()

  if (profileError || !profile?.email) {
    console.error('sendPasswordReset profile lookup failed:', {
      profileError,
      hasProfile: !!profile,
      hasEmail: !!profile?.email,
      user_id: parsed.data.user_id,
    })
    return { success: false, message: 'Could not find email for this user' }
  }

  // 4. Send password reset email via Supabase auth mailer
  const adminClient = createAdminClient()
  const { error: resetError } = await adminClient.auth.resetPasswordForEmail(profile.email)

  if (resetError) {
    return { success: false, message: 'Failed to send password reset email' }
  }

  // 5. Audit log (non-fatal)
  const { error: auditError } = await supabase.from('admin_audit_log').insert({
    actor_id: user.id,
    action: 'user.password_reset',
    target_user_id: parsed.data.user_id,
    metadata: { email: profile.email },
  })

  if (auditError) {
    console.error('Failed to write audit log for user.password_reset:', auditError)
  }

  // 6. Revalidate and return
  revalidatePath('/admin/users')
  return { success: true, message: 'Password reset email sent successfully' }
}

// ─── Audit Log Query ─────────────────────────────────────────────────

export type AuditLogEntry = {
  id: string
  action: string
  actor_name: string
  metadata: Record<string, string>
  created_at: string
}

export async function fetchUserAuditLog(userId: string): Promise<AuditLogEntry[]> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch audit entries for the target user
  const { data: entries, error } = await supabase
    .from('admin_audit_log')
    .select('id, action, actor_id, metadata, created_at')
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !entries) {
    if (error) {
      console.error('Failed to fetch admin_audit_log:', { error, userId })
    }
    return []
  }

  // Collect unique actor IDs to resolve names
  const actorIds = [...new Set(entries.map((e) => e.actor_id))]
  const { data: actors } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', actorIds)

  const actorMap = new Map(actors?.map((a) => [a.id, a.full_name ?? 'Unknown']) ?? [])

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    actor_name: actorMap.get(e.actor_id) ?? 'Unknown',
    metadata: (e.metadata ?? {}) as Record<string, string>,
    created_at: e.created_at,
  }))
}
