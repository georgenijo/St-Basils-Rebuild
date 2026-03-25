import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'

import '@/app/globals.css'

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: "St. Basil's Syriac Orthodox Church",
    template: "%s | St. Basil's Syriac Orthodox Church",
  },
  description:
    "St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${dmSans.variable}`}
    >
      <body className="bg-cream-50 font-body text-wood-800 antialiased">
        {children}
      </body>
    </html>
  )
}
