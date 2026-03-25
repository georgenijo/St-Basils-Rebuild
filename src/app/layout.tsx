import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'

import { cn } from '@/lib/utils'
import { JsonLd } from '@/components/ui'

import './globals.css'

const churchJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Church',
  name: "St. Basil's Syriac Orthodox Church",
  description:
    "St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.",
  url: 'https://stbasilsboston.org',
  telephone: '+1-617-527-0527',
  logo: 'https://stbasilsboston.org/images/logo.png',
  image: 'https://stbasilsboston.org/images/logo.png',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '73 Ellis Street',
    addressLocality: 'Newton',
    addressRegion: 'MA',
    postalCode: '02464',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 42.3375,
    longitude: -71.2093,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Sunday',
      opens: '08:30',
      closes: '12:00',
      description: 'Morning Prayer at 8:30 AM, Holy Qurbono at 9:15 AM',
    },
  ],
  sameAs: ['https://www.facebook.com/stbasilsboston'],
}

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
    <html lang="en" className={cn(cormorantGaramond.variable, dmSans.variable)}>
      <body>
        <JsonLd data={churchJsonLd} />
        {children}
      </body>
    </html>
  )
}
