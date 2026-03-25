import { Navbar } from '@/components/layout/Navbar'

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <Navbar />
      <main className="pt-16">{children}</main>
      {/* Footer will be added here */}
    </>
  )
}
