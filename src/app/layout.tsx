import type { Metadata } from 'next'
import { Raleway, Roboto, Libre_Baskerville } from 'next/font/google'

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

import { cn } from '@/lib/utils'
import { churchSchema } from '@/lib/structured-data'
import { JsonLd } from '@/components/ui'
import { DynamicFonts } from '@/components/DynamicFonts'

import './globals.css'

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-raleway',
  display: 'swap',
})

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
})

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-libre-baskerville',
  display: 'swap',
})

const isVercelDeployment = process.env.VERCEL === '1'

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
        url: '/api/og/default',
        width: 1200,
        height: 630,
        alt: "St. Basil's Syriac Orthodox Church",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "St. Basil's Syriac Orthodox Church",
    description:
      "St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.",
    images: ['/api/og/default'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn(raleway.variable, roboto.variable, libreBaskerville.variable)}>
      <body>
        <DynamicFonts />
        <JsonLd data={churchSchema} />
        {children}
        {isVercelDeployment && <Analytics />}
        {isVercelDeployment && <SpeedInsights />}
      </body>
    </html>
  )
}
