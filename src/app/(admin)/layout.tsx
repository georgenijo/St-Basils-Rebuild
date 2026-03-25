export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen">
      {/* AdminSidebar will be added here */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
