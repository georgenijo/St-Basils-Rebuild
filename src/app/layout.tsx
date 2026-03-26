import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans, Poppins } from 'next/font/google'

import { cn } from '@/lib/utils'
import { churchSchema } from '@/lib/structured-data'
import { JsonLd } from '@/components/ui'

import './globals.css'

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-cormorant-garamond',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://stbasilsboston.org'),
  title: {
    template: "%s | St. Basil's Syriac Orthodox Church",
    default: "St. Basil's Syriac Orthodox Church",
  },
  description:
    "St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.",
  openGraph: {
    title: "St. Basil's Syriac Orthodox Church",
    description:
      "St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.",
    url: 'https://stbasilsboston.org',
    siteName: "St. Basil's Syriac Orthodox Church",
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        alt: "St. Basil's Syriac Orthodox Church logo",
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: "St. Basil's Syriac Orthodox Church",
    description:
      "St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.",
    images: ['/logo.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn(cormorantGaramond.variable, dmSans.variable, poppins.variable)}>
      <body>
        <JsonLd data={churchSchema} />
        {children}
      </body>
    </html>
  )
}
