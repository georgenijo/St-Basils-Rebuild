import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "St. Basil's Syriac Orthodox Church",
  description:
    "St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Serving the Jacobite Malayalee community in the New England region.",
}

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-22 font-body text-wood-800">
      <h1 className="font-heading text-3xl font-semibold text-wood-900">
        Public Group
      </h1>
      <p className="mt-4">Homepage placeholder — (public) route group.</p>
    </main>
  )
}
