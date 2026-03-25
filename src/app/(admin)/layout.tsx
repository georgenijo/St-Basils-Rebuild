import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen">
      {/* AdminSidebar will be added here */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
