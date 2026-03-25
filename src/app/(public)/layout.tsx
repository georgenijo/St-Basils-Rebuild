export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {/* Navbar will be added here */}
      {children}
      {/* Footer will be added here */}
    </>
  )
}
