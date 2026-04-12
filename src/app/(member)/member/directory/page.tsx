import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui'
import { DirectoryClient } from '@/components/features/DirectoryClient'

export const metadata: Metadata = {
  title: 'Directory',
}

export default async function DirectoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null // Layout handles redirect

  // Fetch all visible families (RLS filters to directory_visible = true + own family)
  const { data: families, error: familiesError } = await supabase
    .from('families')
    .select('id, family_name, phone, address, created_at, head_of_household')
    .order('family_name', { ascending: true })

  if (familiesError) {
    return (
      <main className="p-6 lg:p-8">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Directory</h1>
        <Card variant="outlined" className="mt-6 p-6">
          <p className="text-sm text-wood-800/60">
            We couldn&apos;t load the directory right now. Please try again.
          </p>
        </Card>
      </main>
    )
  }

  const familyIds = (families ?? []).map((f) => f.id)

  // Fetch members for all visible families (skip if none to avoid empty .in())
  const { data: members, error: membersError } =
    familyIds.length > 0
      ? await supabase
          .from('family_members')
          .select('id, family_id, full_name, relationship')
          .in('family_id', familyIds)
          .order('created_at', { ascending: true })
      : { data: [], error: null }

  if (membersError) {
    return (
      <main className="p-6 lg:p-8">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Directory</h1>
        <Card variant="outlined" className="mt-6 p-6">
          <p className="text-sm text-wood-800/60">
            We couldn&apos;t load the directory right now. Please try again.
          </p>
        </Card>
      </main>
    )
  }

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Directory</h1>
        <p className="mt-1 text-sm text-wood-800/60">Find and connect with parish families</p>
      </div>

      <DirectoryClient families={families ?? []} members={members ?? []} />
    </main>
  )
}
