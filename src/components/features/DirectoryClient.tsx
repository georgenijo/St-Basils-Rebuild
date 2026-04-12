'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui'

// ─── Types ───────────────────────────────────────────────────────────

interface DirectoryFamily {
  id: string
  family_name: string
  phone: string | null
  address: string | null
  created_at: string
  head_of_household: string | null
}

interface DirectoryMember {
  id: string
  family_id: string
  full_name: string
  relationship: string
}

interface DirectoryClientProps {
  families: DirectoryFamily[]
  members: DirectoryMember[]
}

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
    self: 'Head of Household',
    spouse: 'Spouse',
    child: 'Child',
    parent: 'Parent',
    sibling: 'Sibling',
    other: 'Other',
  }
  return labels[relationship] ?? relationship
}

function getMemberSinceYear(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

// ─── Component ───────────────────────────────────────────────────────

export function DirectoryClient({ families, members }: DirectoryClientProps) {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Build a lookup: family_id → members
  const membersByFamily = new Map<string, DirectoryMember[]>()
  for (const m of members) {
    const list = membersByFamily.get(m.family_id) ?? []
    list.push(m)
    membersByFamily.set(m.family_id, list)
  }

  // Get head-of-household name for a family (member with relationship = 'self')
  function getHeadName(familyId: string): string {
    const familyMembers = membersByFamily.get(familyId) ?? []
    const head = familyMembers.find((m) => m.relationship === 'self')
    return head?.full_name ?? '—'
  }

  // Filter families by search
  const query = search.toLowerCase().trim()
  const filtered = query
    ? families.filter((f) => {
        const headName = getHeadName(f.id).toLowerCase()
        return f.family_name.toLowerCase().includes(query) || headName.includes(query)
      })
    : families

  if (families.length === 0) {
    return (
      <Card variant="outlined" className="p-8 text-center">
        <p className="text-sm text-wood-800/40">The member directory is empty.</p>
      </Card>
    )
  }

  return (
    <>
      {/* ─── Search Bar ──────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Search by family name or head of household..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-wood-800/15 bg-white py-2.5 pl-10 pr-4 text-sm text-wood-900 placeholder:text-wood-800/30 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
            aria-label="Search families"
          />
        </div>
        <p className="mt-2 text-xs text-wood-800/45" aria-live="polite">
          Showing {filtered.length} of {families.length}{' '}
          {families.length === 1 ? 'family' : 'families'}
        </p>
      </div>

      {/* ─── Family Cards ────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card variant="outlined" className="p-8 text-center">
          <p className="text-sm text-wood-800/40">
            No families found matching &ldquo;{search}&rdquo;
          </p>
          <p className="mt-1 text-xs text-wood-800/30">Try a different search term</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((family, index) => {
            const familyMembers = membersByFamily.get(family.id) ?? []
            const headName = getHeadName(family.id)
            const isExpanded = expandedId === family.id
            const memberCount = familyMembers.length

            return (
              <Card key={family.id} variant="outlined" className="overflow-hidden">
                {/* Family Summary Row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : family.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-wood-800/[0.02]"
                  aria-expanded={isExpanded}
                  aria-controls={`family-members-${family.id}`}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      avatarColor(index)
                    )}
                  >
                    {getInitials(family.family_name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-wood-900 truncate">
                        {family.family_name}
                      </span>
                      {memberCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-wood-800/5 px-2 py-0.5 text-[10px] font-medium text-wood-800/50">
                          {memberCount} {memberCount === 1 ? 'member' : 'members'}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-wood-800/50">
                      {headName !== '—' ? headName : ''}{' '}
                      {headName !== '—' && family.phone ? '·' : ''}{' '}
                      {family.phone ?? ''}{' '}
                      {(headName !== '—' || family.phone) && family.address ? '·' : ''}{' '}
                      {family.address ?? ''}
                    </div>
                  </div>

                  {/* Meta + Chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="hidden text-xs text-wood-800/35 sm:block">
                      Since {getMemberSinceYear(family.created_at)}
                    </span>
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center text-wood-800/30 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                      aria-hidden="true"
                    >
                      <ChevronDownIcon />
                    </span>
                  </div>
                </button>

                {/* Expanded: Family Members */}
                {isExpanded && (
                  <div
                    id={`family-members-${family.id}`}
                    className="border-t border-wood-800/5 bg-wood-800/[0.015]"
                  >
                    {familyMembers.length === 0 ? (
                      <div className="px-5 py-4 text-center text-xs text-wood-800/35">
                        No family members listed
                      </div>
                    ) : (
                      <ul className="divide-y divide-wood-800/5 px-5">
                        {familyMembers.map((member) => (
                          <li
                            key={member.id}
                            className="flex items-center justify-between py-3"
                          >
                            <span className="text-sm text-wood-900">{member.full_name}</span>
                            <span className="inline-flex items-center rounded-full bg-wood-800/5 px-2 py-0.5 text-[10px] font-medium text-wood-800/50">
                              {relationshipLabel(member.relationship)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-wood-800/30"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
