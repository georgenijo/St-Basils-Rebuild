'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  updateFamilySchema,
  addFamilyMemberSchema,
  removeFamilyMemberSchema,
} from '@/lib/validators/member'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function updateFamilyDetails(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = updateFamilySchema.safeParse({
    family_name: formData.get('family_name'),
    phone: formData.get('phone'),
    address: formData.get('address'),
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

  // 3. Fetch profile for family_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return { success: false, message: 'No family assigned to your account' }
  }

  // 4. Update family details (RLS enforces own-family-only + blocks admin columns)
  const { error } = await supabase
    .from('families')
    .update({
      family_name: parsed.data.family_name,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
    })
    .eq('id', profile.family_id)

  if (error) {
    return { success: false, message: 'Failed to update family details' }
  }

  // 5. Revalidate and return
  revalidatePath('/member')
  return { success: true, message: 'Family details updated successfully' }
}

export async function addFamilyMember(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = addFamilyMemberSchema.safeParse({
    full_name: formData.get('full_name'),
    relationship: formData.get('relationship'),
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

  // 3. Fetch profile for family_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return { success: false, message: 'No family assigned to your account' }
  }

  // 4. Insert family member (RLS enforces own-family-only)
  const { error } = await supabase.from('family_members').insert({
    family_id: profile.family_id,
    full_name: parsed.data.full_name,
    relationship: parsed.data.relationship,
  })

  if (error) {
    return { success: false, message: 'Failed to add family member' }
  }

  // 5. Revalidate and return
  revalidatePath('/member')
  return { success: true, message: 'Family member added successfully' }
}

export async function removeFamilyMember(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate with Zod
  const parsed = removeFamilyMemberSchema.safeParse({
    member_id: formData.get('member_id'),
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

  // 3. Fetch profile for family_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return { success: false, message: 'No family assigned to your account' }
  }

  // 4. Fetch the member being removed
  const { data: member } = await supabase
    .from('family_members')
    .select('id, family_id, profile_id')
    .eq('id', parsed.data.member_id)
    .single()

  if (!member) {
    return { success: false, message: 'Family member not found' }
  }

  if (member.family_id !== profile.family_id) {
    return { success: false, message: 'You can only remove members from your own family' }
  }

  // 5. Head-of-household protection
  const { data: family } = await supabase
    .from('families')
    .select('head_of_household')
    .eq('id', profile.family_id)
    .single()

  if (family && member.profile_id && member.profile_id === family.head_of_household) {
    return { success: false, message: 'Cannot remove the head of household' }
  }

  // 6. Delete the family member (RLS also enforces own-family-only)
  const { error } = await supabase.from('family_members').delete().eq('id', parsed.data.member_id)

  if (error) {
    return { success: false, message: 'Failed to remove family member' }
  }

  // 7. Revalidate and return
  revalidatePath('/member')
  return { success: true, message: 'Family member removed successfully' }
}
