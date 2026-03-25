import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Giving',
  description:
    "Support St. Basil's Syriac Orthodox Church in Boston through tithes, offerings, and donations. Your generosity sustains our ministries and community programs.",
  openGraph: {
    title: "Giving | St. Basil's Syriac Orthodox Church",
    description:
      "Support St. Basil's Syriac Orthodox Church through tithes, offerings, and donations.",
  },
}

export default function GivingPage() {
  return (
    <main className="min-h-screen px-4 py-22 font-body text-wood-800">
      <h1 className="font-heading text-3xl font-semibold text-wood-900">Giving</h1>
      <p className="mt-4">Giving page placeholder.</p>
    </main>
  )
}
