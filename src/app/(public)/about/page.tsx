import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description:
    "Learn about the history and mission of St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Rooted in the apostolic Syriac Orthodox tradition and serving the Jacobite Malayalee community in New England.",
  openGraph: {
    title: "About | St. Basil's Syriac Orthodox Church",
    description:
      "Learn about the history and mission of St. Basil's Syriac Orthodox Church in Boston, Massachusetts.",
  },
}

export default function AboutPage() {
  return (
    <main className="min-h-screen px-4 py-22 font-body text-wood-800">
      <h1 className="font-heading text-3xl font-semibold text-wood-900">About</h1>
      <p className="mt-4">About page placeholder.</p>
    </main>
  )
}
