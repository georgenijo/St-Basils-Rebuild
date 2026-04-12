import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { MemberSidebar } from '@/components/layout/MemberSidebar'
import { MemberTopBar } from '@/components/layout/MemberTopBar'

export default async function MemberLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()

  // Auth check — redirect unauthenticated users to login
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Role check — only members can access this layout
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, family_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'member') {
    redirect('/')
  }

  // Fetch family info for sidebar
  let family: { family_name: string; created_at: string } | null = null
  if (profile.family_id) {
    const { data } = await supabase
      .from('families')
      .select('family_name, created_at')
      .eq('id', profile.family_id)
      .single()
    family = data
  }

  return (
    <div className="flex min-h-screen bg-cream-50">
      <MemberSidebar
        familyName={family?.family_name}
        memberSince={family ? new Date(family.created_at).getFullYear().toString() : undefined}
      />
      <div className="flex flex-1 flex-col">
        <MemberTopBar email={user.email ?? ''} />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
