import { LogoutButton } from '@/components/features/LogoutButton'

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col bg-charcoal p-6">
        <div className="flex-1">
          {/* AdminSidebar nav will be added here */}
        </div>
        <LogoutButton />
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  )
}
