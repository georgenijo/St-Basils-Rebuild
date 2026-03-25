import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: "%s | St. Basil's Syriac Orthodox Church",
    default: "St. Basil's Syriac Orthodox Church",
  },
  description:
    "St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
