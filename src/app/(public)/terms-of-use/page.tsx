import type { Metadata } from 'next'

import { LegalPageLayout } from '@/components/features/LegalPageLayout'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    "Terms of use for the St. Basil's Syriac Orthodox Church website. Review our website usage policies, disclaimers, and conditions.",
  openGraph: {
    title: "Terms of Use | St. Basil's Syriac Orthodox Church",
    description:
      "Terms of use for the St. Basil's Syriac Orthodox Church website.",
  },
}

export default function TermsOfUsePage() {
  return <LegalPageLayout slug="terms-of-use" />
}
