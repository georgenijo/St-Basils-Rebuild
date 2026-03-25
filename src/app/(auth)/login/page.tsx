import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login',
}

export default function LoginPage() {
  return (
    <main className="w-full max-w-md px-4 font-body text-wood-800">
      <h1 className="font-heading text-3xl font-semibold text-wood-900">Auth Group</h1>
      <p className="mt-4">Login placeholder — (auth) route group.</p>
    </main>
  )
}
