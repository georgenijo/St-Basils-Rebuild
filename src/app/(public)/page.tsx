import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    absolute: "St. Basil's Syriac Orthodox Church — Boston, MA",
  },
  description:
    "Welcome to St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Join us for Sunday services, community events, and fellowship. Serving the Jacobite Malayalee community in New England.",
  openGraph: {
    title: "St. Basil's Syriac Orthodox Church — Boston, MA",
    description:
      "Welcome to St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Join us for Sunday services, community events, and fellowship.",
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen px-4 py-16 font-body text-wood-800 md:py-22">
      <h1 className="font-heading text-[2rem] font-semibold text-wood-900 md:text-[3rem]">
        Public Group
      </h1>
      <p className="mt-4">Homepage placeholder — (public) route group.</p>
    </div>
  )
}
