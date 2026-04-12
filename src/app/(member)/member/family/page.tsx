import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui'
import { FamilyClient } from '@/components/features/FamilyClient'

export const metadata: Metadata = {
  title: 'Family',
}

export default async function FamilyPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null // layout redirects

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return (
      <main className="p-6 lg:p-8">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Family</h1>
        <Card variant="outlined" className="mt-6 p-6">
          <p className="text-sm text-wood-800/60">
            We couldn&apos;t load your profile right now. Please try again.
          </p>
        </Card>
      </main>
    )
  }

  if (!profile.family_id) {
    return (
      <main className="p-6 lg:p-8">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Family</h1>
        <Card variant="outlined" className="mt-6 p-6">
          <p className="text-sm text-wood-800/60">
            Your family hasn&apos;t been set up yet. Please contact the church office to get
            started.
          </p>
        </Card>
      </main>
    )
  }

  const [{ data: family, error: familyError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from('families')
        .select('id, family_name, head_of_household, phone, address, created_at')
        .eq('id', profile.family_id)
        .single(),
      supabase
        .from('family_members')
        .select('id, full_name, relationship, profile_id')
        .eq('family_id', profile.family_id)
        .order('created_at', { ascending: true }),
    ])

  if (familyError || membersError || !family) {
    return (
      <main className="p-6 lg:p-8">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Family</h1>
        <Card variant="outlined" className="mt-6 p-6">
          <p className="text-sm text-wood-800/60">
            We couldn&apos;t load your family details right now. Please try again.
          </p>
        </Card>
      </main>
    )
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Family</h1>
        <p className="mt-1 text-sm text-wood-800/60">Your household details and members</p>
      </div>

      <FamilyClient family={family} members={members ?? []} currentUserId={user.id} />
    </main>
  )
}
