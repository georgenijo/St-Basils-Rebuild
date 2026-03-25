import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default function DashboardPage() {
  return (
    <main className="px-4 py-22 font-body text-wood-800 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-semibold text-wood-900">
        Admin Group
      </h1>
      <p className="mt-4">Dashboard placeholder — (admin) route group.</p>
    </main>
  )
}
