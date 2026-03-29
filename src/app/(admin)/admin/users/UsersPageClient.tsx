'use client'

import { useEffect, useState } from 'react'

import { UsersTable } from '@/components/features/UsersTable'
import { UserDetailPanel } from '@/components/features/UserDetailPanel'

interface User {
  id: string
  email: string | null
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UsersPageClientProps {
  users: User[]
  currentUserId: string
}

export function UsersPageClient({ users, currentUserId }: UsersPageClientProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Derive selected user from the fresh server data so it stays in sync after actions
  const selectedUser = selectedUserId ? users.find((u) => u.id === selectedUserId) ?? null : null

  // Clear selection if the user was removed from the list
  useEffect(() => {
    if (selectedUserId && !users.find((u) => u.id === selectedUserId)) {
      setSelectedUserId(null)
    }
  }, [users, selectedUserId])

  return (
    <>
      <UsersTable
        users={users}
        currentUserId={currentUserId}
        selectedUserId={selectedUserId}
        onRowClick={(user) => setSelectedUserId(user.id)}
      />
      <UserDetailPanel
        user={selectedUser}
        currentUserId={currentUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </>
  )
}
