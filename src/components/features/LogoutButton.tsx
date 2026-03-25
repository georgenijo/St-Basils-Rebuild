'use client'

interface LogoutButtonProps {
  className?: string
}

export function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className={
          className ??
          'text-sm text-cream-50/70 transition-colors hover:text-cream-50'
        }
      >
        Sign Out
      </button>
    </form>
  )
}
