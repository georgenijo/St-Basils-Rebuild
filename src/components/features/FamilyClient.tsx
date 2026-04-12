'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { removeFamilyMember } from '@/actions/family'
import { Card, Button } from '@/components/ui'
import { EditFamilyPanel } from './EditFamilyPanel'
import { AddMemberPanel } from './AddMemberPanel'

// ─── Types ───────────────────────────────────────────────────────────

interface Family {
  id: string
  family_name: string
  head_of_household: string | null
  phone: string | null
  address: string | null
  created_at: string
}

interface FamilyMember {
  id: string
  full_name: string
  relationship: string
  profile_id: string | null
}

interface FamilyClientProps {
  family: Family
  members: FamilyMember[]
  currentUserId: string
}

type PanelType = 'edit-family' | 'add-member' | null

// ─── Helpers ─────────────────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name.trim()) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
]

function avatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function relationshipLabel(relationship: string): string {
  const labels: Record<string, string> = {
    self: 'Self',
    spouse: 'Spouse',
    child: 'Child',
    parent: 'Parent',
    sibling: 'Sibling',
    other: 'Other',
  }
  return labels[relationship] ?? relationship
}

// ─── Component ───────────────────────────────────────────────────────

export function FamilyClient({ family, members, currentUserId }: FamilyClientProps) {
  const [openPanel, setOpenPanel] = useState<PanelType>(null)

  const memberSince = new Date(family.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/New_York',
  })

  // Find head of household name from members list
  const headMember = members.find((m) => m.profile_id === family.head_of_household)
  const headName = headMember?.full_name ?? '—'

  return (
    <>
      {/* ─── Family Details Card ──────────────────────────────────── */}
      <Card variant="outlined" className="mb-6">
        <div className="flex items-center justify-between border-b border-wood-800/5 px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-wood-900">Family Details</h2>
          <Button variant="secondary" size="sm" onClick={() => setOpenPanel('edit-family')}>
            Edit
          </Button>
        </div>
        <div className="divide-y divide-wood-800/5">
          <DetailRow label="Family Name" value={family.family_name} />
          <DetailRow label="Head of Household" value={headName} />
          <DetailRow label="Phone" value={family.phone ?? '—'} />
          <DetailRow label="Address" value={family.address ?? '—'} />
          <DetailRow label="Member Since" value={memberSince} />
        </div>
      </Card>

      {/* ─── Family Members Card ──────────────────────────────────── */}
      <Card variant="outlined">
        <div className="flex items-center justify-between border-b border-wood-800/5 px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-wood-900">Family Members</h2>
          <Button variant="secondary" size="sm" onClick={() => setOpenPanel('add-member')}>
            <PlusIcon />
            Add Member
          </Button>
        </div>
        <div className="divide-y divide-wood-800/5">
          {members.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-wood-800/40">
              No family members yet.
            </div>
          ) : (
            members.map((member, index) => {
              const isCurrentUser = member.profile_id === currentUserId
              const isHead = member.profile_id === family.head_of_household

              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-3.5">
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      avatarColor(index)
                    )}
                  >
                    {getInitials(member.full_name)}
                  </div>

                  {/* Name + relationship */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-wood-900 truncate">
                        {member.full_name}
                      </span>
                      {isCurrentUser && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-wood-800/50">
                      {isHead ? 'Head of Household' : relationshipLabel(member.relationship)}
                    </div>
                  </div>

                  {/* Remove button — hidden for head of household */}
                  {!isHead && (
                    <RemoveMemberButton memberId={member.id} memberName={member.full_name} />
                  )}
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* ─── Panels ──────────────────────────────────────────────── */}
      <EditFamilyPanel
        open={openPanel === 'edit-family'}
        onClose={() => setOpenPanel(null)}
        family={family}
      />
      <AddMemberPanel open={openPanel === 'add-member'} onClose={() => setOpenPanel(null)} />
    </>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-wood-800/60">{label}</span>
      <span className="text-sm text-wood-900">{value}</span>
    </div>
  )
}

function RemoveMemberButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [state, formAction, isPending] = useActionState(removeFamilyMember, {
    success: false,
    message: '',
  })
  const hasNotified = useRef(false)

  useEffect(() => {
    if (state.message && !state.success && !hasNotified.current) {
      hasNotified.current = true
    }
  }, [state])

  return (
    <form action={formAction}>
      <input type="hidden" name="member_id" value={memberId} />
      {state.message && !state.success && (
        <span className="sr-only" role="alert">
          {state.message}
        </span>
      )}
      <button
        type="submit"
        disabled={isPending}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50',
          state.message && !state.success
            ? 'border-red-300 bg-red-50 text-red-600'
            : 'border-wood-800/10 text-wood-800/40 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
        )}
        aria-label={`Remove ${memberName}`}
        title={state.message && !state.success ? state.message : undefined}
      >
        {isPending ? <LoadingSpinner /> : <TrashIcon />}
      </button>
    </form>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────

function PlusIcon() {
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
      className="mr-1.5"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
