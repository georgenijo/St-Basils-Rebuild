'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import {
  updateUserRole,
  deactivateUser,
  reactivateUser,
  sendPasswordReset,
  fetchUserAuditLog,
} from '@/actions/users'
import type { AuditLogEntry } from '@/actions/users'
import { Button } from '@/components/ui'
import { UserActionDialog } from './UserActionDialog'

// ─── Types ───────────────────────────────────────────────────────────

interface User {
  id: string
  email: string | null
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UserDetailPanelProps {
  user: User | null
  currentUserId: string
  onClose: () => void
}

// ─── Constants ───────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Member',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-amber-50 text-amber-800',
  member: 'bg-indigo-50 text-indigo-700',
}

const STATUS_COLORS = {
  active: 'bg-emerald-50 text-emerald-700',
  deactivated: 'bg-red-50 text-red-700',
}

const AVATAR_COLORS: Record<string, string> = {
  admin: 'bg-amber-100 text-amber-800',
  member: 'bg-indigo-100 text-indigo-700',
}

const AUDIT_DOT_COLORS: Record<string, string> = {
  'user.invite': 'bg-blue-500',
  'user.role_change': 'bg-yellow-500',
  'user.deactivate': 'bg-red-500',
  'user.reactivate': 'bg-emerald-500',
  'user.password_reset': 'bg-violet-500',
}

type DialogType = 'role' | 'deactivate' | 'reactivate' | 'password' | null

// ─── Helpers ─────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return (email?.[0] ?? '?').toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function describeAction(entry: AuditLogEntry): string {
  switch (entry.action) {
    case 'user.invite':
      return `invited this user as ${entry.metadata.role ?? 'member'}`
    case 'user.role_change':
      return `changed role from ${entry.metadata.old_role ?? '?'} to ${entry.metadata.new_role ?? '?'}`
    case 'user.deactivate':
      return 'deactivated this account'
    case 'user.reactivate':
      return 'reactivated this account'
    case 'user.password_reset':
      return 'sent a password reset email'
    default:
      return entry.action
  }
}

// ─── Component ───────────────────────────────────────────────────────

export function UserDetailPanel({ user, currentUserId, onClose }: UserDetailPanelProps) {
  const router = useRouter()
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [activeDialog, setActiveDialog] = useState<DialogType>(null)

  const isOpen = user !== null
  const isSelf = user?.id === currentUserId

  // Fetch audit log when user changes
  useEffect(() => {
    if (!user) {
      setAuditLog([])
      return
    }
    setAuditLoading(true)
    fetchUserAuditLog(user.id)
      .then(setAuditLog)
      .finally(() => setAuditLoading(false))
  }, [user])

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !activeDialog) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, activeDialog, onClose])

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleActionSuccess = useCallback(() => {
    router.refresh()
    if (user) {
      fetchUserAuditLog(user.id).then(setAuditLog)
    }
  }, [router, user])

  if (!user) return null

  const status = user.is_active ? 'active' : 'deactivated'
  const displayName = user.full_name || user.email || 'Unknown'
  const initials = getInitials(user.full_name, user.email)
  // Derive "Invited By" from audit log
  const inviteEntry = auditLog.find((e) => e.action === 'user.invite')
  const invitedBy = inviteEntry?.actor_name ?? '—'

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${displayName}`}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col bg-cream-50 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-350',
          isOpen
            ? 'translate-x-0'
            : 'translate-x-full'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between bg-cream-50 px-6 pt-6">
          <div />
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-wood-800/15 bg-white text-wood-800/60 transition-colors hover:bg-cream-100 hover:text-wood-900"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* User info */}
          <div className="flex gap-4">
            <div
              className={cn(
                'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl font-semibold',
                AVATAR_COLORS[user.role] ?? 'bg-gray-100 text-gray-700'
              )}
            >
              {initials}
            </div>
            <div>
              <h2 className="font-heading text-xl font-semibold text-wood-900">
                {displayName}
                {isSelf && (
                  <span className="ml-1 font-body text-sm font-normal text-wood-800/50">(you)</span>
                )}
              </h2>
              <p className="mt-0.5 font-body text-sm text-wood-800/60">{user.email}</p>
              <div className="mt-2 flex gap-2">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    ROLE_COLORS[user.role] ?? 'bg-gray-50 text-gray-700'
                  )}
                >
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    STATUS_COLORS[status]
                  )}
                >
                  {status === 'active' ? 'Active' : 'Deactivated'}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 border-b border-wood-800/10 pb-5">
            {isSelf ? (
              <p className="font-body text-sm text-wood-800/50">
                Actions are disabled for your own account.
              </p>
            ) : user.is_active ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveDialog('password')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wood-800/20 bg-white px-3.5 py-2 font-body text-sm font-medium text-wood-800 transition-colors hover:bg-cream-100"
                >
                  <LockIcon />
                  Password Reset
                </button>
                <button
                  onClick={() => setActiveDialog('role')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wood-800/20 bg-white px-3.5 py-2 font-body text-sm font-medium text-wood-800 transition-colors hover:bg-cream-100"
                >
                  <UserCheckIcon />
                  Change Role
                </button>
                <button
                  onClick={() => setActiveDialog('deactivate')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 font-body text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <BanIcon />
                  Deactivate
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveDialog('reactivate')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 font-body text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
              >
                <RefreshIcon />
                Reactivate
              </button>
            )}
          </div>

          {/* Account details */}
          <div className="mt-5">
            <h3 className="mb-3 font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
              Account Details
            </h3>
            <div className="overflow-hidden rounded-xl border border-wood-800/10 bg-white">
              <DetailRow label="Email" value={user.email ?? '—'} />
              <DetailRow
                label="Role"
                value={
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      ROLE_COLORS[user.role] ?? 'bg-gray-50 text-gray-700'
                    )}
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                }
              />
              <DetailRow
                label="Status"
                value={
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      STATUS_COLORS[status]
                    )}
                  >
                    {status === 'active' ? 'Active' : 'Deactivated'}
                  </span>
                }
              />
              <DetailRow label="Joined" value={formatDate(user.created_at)} />
              <DetailRow label="Last Updated" value={formatDate(user.updated_at)} />
              <DetailRow label="Invited By" value={invitedBy} isLast />
            </div>
          </div>

          {/* Activity / Audit log */}
          <div className="mt-5">
            <h3 className="mb-3 font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
              Activity
            </h3>
            <div className="overflow-hidden rounded-xl border border-wood-800/10 bg-white">
              {auditLoading ? (
                <div className="px-4 py-8 text-center font-body text-sm text-wood-800/50">
                  Loading activity...
                </div>
              ) : auditLog.length === 0 ? (
                <div className="px-4 py-8 text-center font-body text-sm text-wood-800/50">
                  No activity recorded yet.
                </div>
              ) : (
                auditLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2.5 border-b border-wood-800/[0.06] px-3.5 py-3 last:border-b-0"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full',
                        AUDIT_DOT_COLORS[entry.action] ?? 'bg-gray-400'
                      )}
                      aria-hidden="true"
                    />
                    <p className="flex-1 font-body text-[13px] leading-relaxed text-wood-800">
                      <strong className="font-semibold">{entry.actor_name}</strong>{' '}
                      {describeAction(entry)}
                    </p>
                    <span className="flex-shrink-0 font-body text-xs text-wood-800/40">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation dialogs */}
      {activeDialog === 'role' && (
        <ChangeRoleDialog
          key={user.id}
          open
          onClose={() => setActiveDialog(null)}
          onSuccess={handleActionSuccess}
          user={user}
        />
      )}
      {activeDialog === 'deactivate' && (
        <UserActionDialog
          key={user.id}
          open
          onClose={() => setActiveDialog(null)}
          onSuccess={handleActionSuccess}
          title="Deactivate User"
          description={`Deactivate ${displayName}? They won\u2019t be able to log in.`}
          action={deactivateUser}
          hiddenFields={{ user_id: user.id }}
          confirmLabel="Deactivate"
          confirmClassName="bg-red-600 text-white hover:bg-red-700"
        />
      )}
      {activeDialog === 'reactivate' && (
        <UserActionDialog
          key={user.id}
          open
          onClose={() => setActiveDialog(null)}
          onSuccess={handleActionSuccess}
          title="Reactivate User"
          description={`Reactivate ${displayName}? They\u2019ll be able to log in again.`}
          action={reactivateUser}
          hiddenFields={{ user_id: user.id }}
          confirmLabel="Reactivate"
          confirmClassName="bg-emerald-600 text-white hover:bg-emerald-700"
        />
      )}
      {activeDialog === 'password' && (
        <UserActionDialog
          key={user.id}
          open
          onClose={() => setActiveDialog(null)}
          onSuccess={handleActionSuccess}
          title="Password Reset"
          description={`Send a password reset email to ${user.email}?`}
          action={sendPasswordReset}
          hiddenFields={{ user_id: user.id }}
          confirmLabel="Send Reset Email"
        />
      )}
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  isLast,
}: {
  label: string
  value: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3.5 py-2.5',
        !isLast && 'border-b border-wood-800/[0.06]'
      )}
    >
      <span className="font-body text-sm text-wood-800/60">{label}</span>
      <span className="font-body text-sm font-medium text-wood-900">{value}</span>
    </div>
  )
}

// ─── Change Role Dialog ──────────────────────────────────────────────

function ChangeRoleDialog({
  open,
  onClose,
  onSuccess,
  user,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  user: User
}) {
  const [state, formAction, isPending] = useActionState(updateUserRole, {
    success: false,
    message: '',
  })
  const [selectedRole, setSelectedRole] = useState(user.role)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [open])

  useEffect(() => {
    if (state.success) {
      onClose()
      onSuccess()
    }
  }, [state.success, onClose, onSuccess])

  const displayName = user.full_name || user.email || 'Unknown'
  const isSameRole = selectedRole === user.role

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-2xl border border-wood-800/10 bg-cream-50 p-0 shadow-lg backdrop:bg-charcoal/50"
    >
      <div className="p-6">
        <h2 className="font-heading text-xl font-semibold text-wood-900">Change Role</h2>
        <p className="mt-2 font-body text-sm text-wood-800/80">
          Select a new role for {displayName}.
        </p>

        <div className="mt-4 flex gap-2">
          {(['admin', 'member'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={cn(
                'flex-1 rounded-lg border px-4 py-3 text-center font-body text-sm font-medium transition-colors',
                selectedRole === role
                  ? 'border-burgundy-700 bg-burgundy-700/[0.06] text-burgundy-700'
                  : 'border-wood-800/15 bg-white text-wood-800 hover:bg-cream-100'
              )}
            >
              {ROLE_LABELS[role]}
              {user.role === role && (
                <span className="ml-1.5 text-xs font-normal text-wood-800/40">(current)</span>
              )}
            </button>
          ))}
        </div>

        {state.message && !state.success && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
            <p className="font-body text-sm text-red-600">{state.message}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <form action={formAction}>
            <input type="hidden" name="user_id" value={user.id} />
            <input type="hidden" name="role" value={selectedRole} />
            <button
              type="submit"
              disabled={isPending || isSameRole}
              className="inline-flex items-center justify-center rounded-lg bg-burgundy-700 px-4 py-2 text-sm font-medium text-cream-50 transition-colors hover:bg-burgundy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Updating...
                </span>
              ) : (
                'Change Role'
              )}
            </button>
          </form>
        </div>
      </div>
    </dialog>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function UserCheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}
