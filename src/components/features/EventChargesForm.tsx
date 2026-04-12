'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'

import { assignEventCosts } from '@/actions/admin-payments'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────

interface Family {
  id: string
  family_name: string
}

interface ExistingCharge {
  family_id: string
  family_name: string
  amount: number
  paid: boolean
}

export interface EventChargesFormProps {
  eventId: string
  eventTitle: string
  families: Family[]
  existingCharges: ExistingCharge[]
}

// ─── Styles ───────────────────────────────────────────────────────────

const inputBase =
  'w-full rounded-lg border bg-cream-50 px-4 py-3 font-body text-base text-wood-800 placeholder:text-wood-800/40 transition-colors focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20'

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

// ─── USD formatter ────────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

// ─── Component ────────────────────────────────────────────────────────

export function EventChargesForm({
  eventId,
  eventTitle,
  families,
  existingCharges,
}: EventChargesFormProps) {
  const [state, formAction, isPending] = useActionState(assignEventCosts, initialState)

  const [totalCost, setTotalCost] = useState('')
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set())
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [useManualAmounts, setUseManualAmounts] = useState(false)

  // Families that don't already have a charge for this event
  const availableFamilies = useMemo(
    () => families.filter((f) => !existingCharges.some((c) => c.family_id === f.id)),
    [families, existingCharges]
  )

  // Filtered by search
  const filteredFamilies = useMemo(() => {
    if (!searchQuery.trim()) return availableFamilies
    const q = searchQuery.toLowerCase()
    return availableFamilies.filter((f) => f.family_name.toLowerCase().includes(q))
  }, [availableFamilies, searchQuery])

  // Auto-split calculation
  const splitAmount =
    selectedFamilyIds.size > 0 && totalCost
      ? Math.round((Number(totalCost) / selectedFamilyIds.size) * 100) / 100
      : 0

  // Build charges array for submission
  const charges = useMemo(() => {
    return Array.from(selectedFamilyIds).map((familyId) => ({
      family_id: familyId,
      amount: useManualAmounts ? Number(manualAmounts[familyId] || 0) : splitAmount,
    }))
  }, [selectedFamilyIds, useManualAmounts, manualAmounts, splitAmount])

  const chargesTotal = charges.reduce((sum, c) => sum + c.amount, 0)

  // Redirect on success
  useEffect(() => {
    if (state.success) {
      window.location.href = `/admin/events/${eventId}`
    }
  }, [state.success, eventId])

  function toggleFamily(familyId: string) {
    setSelectedFamilyIds((prev) => {
      const next = new Set(prev)
      if (next.has(familyId)) {
        next.delete(familyId)
      } else {
        next.add(familyId)
      }
      return next
    })
  }

  function selectAll() {
    setSelectedFamilyIds(new Set(availableFamilies.map((f) => f.id)))
  }

  function deselectAll() {
    setSelectedFamilyIds(new Set())
    setManualAmounts({})
  }

  function handleManualAmountChange(familyId: string, value: string) {
    setManualAmounts((prev) => ({ ...prev, [familyId]: value }))
  }

  return (
    <form
      action={(formData) => {
        formData.set('event_id', eventId)
        formData.set('charges', JSON.stringify(charges))
        formAction(formData)
      }}
      className="space-y-8"
    >
      {/* Server error message */}
      {!state.success && state.message && !state.errors && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
          <p className="font-body text-sm text-red-600">{state.message}</p>
        </div>
      )}

      {/* ─── Total Cost ──────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="total-cost"
          className="mb-1.5 block font-body text-sm font-medium text-wood-900"
        >
          Total Event Cost <span className="text-burgundy-700">*</span>
        </label>
        <p className="mb-2 text-xs text-wood-800/60">
          The total cost for &quot;{eventTitle}&quot; to be split among selected families.
        </p>
        <div className="relative max-w-xs">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-body text-wood-800/50">
            $
          </span>
          <input
            type="number"
            id="total-cost"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            className={cn(inputBase, 'max-w-xs pl-8')}
          />
        </div>
      </div>

      {/* ─── Family Selector ─────────────────────────────────────── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-body text-sm font-medium text-wood-900" id="family-selector-label">
            Select Families <span className="text-burgundy-700">*</span>
          </span>
          <span className="font-body text-xs text-wood-800/60">
            {selectedFamilyIds.size} of {availableFamilies.length} selected
          </span>
        </div>

        {/* Search + bulk actions */}
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search families..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(inputBase, 'text-sm')}
          />
          <button
            type="button"
            onClick={selectAll}
            className="shrink-0 rounded-lg px-3 py-2 font-body text-xs font-medium text-burgundy-700 transition-colors hover:bg-burgundy-100"
          >
            All
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="shrink-0 rounded-lg px-3 py-2 font-body text-xs font-medium text-wood-800/60 transition-colors hover:bg-cream-100"
          >
            None
          </button>
        </div>

        {/* Family list */}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-wood-800/10 bg-cream-50">
          {filteredFamilies.length === 0 ? (
            <div className="px-4 py-8 text-center font-body text-sm text-wood-800/40">
              {searchQuery
                ? 'No families match your search'
                : 'All families already have charges for this event'}
            </div>
          ) : (
            <ul role="listbox" aria-labelledby="family-selector-label" aria-multiselectable="true">
              {filteredFamilies.map((family) => {
                const selected = selectedFamilyIds.has(family.id)
                return (
                  <li
                    key={family.id}
                    role="option"
                    aria-selected={selected}
                    tabIndex={0}
                    onClick={() => toggleFamily(family.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleFamily(family.id)
                      }
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 border-b border-wood-800/5 px-4 py-2.5 transition-colors last:border-b-0',
                      selected ? 'bg-burgundy-700/5' : 'hover:bg-cream-100'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                        selected
                          ? 'border-burgundy-700 bg-burgundy-700 text-cream-50'
                          : 'border-wood-800/20 bg-cream-50'
                      )}
                      aria-hidden="true"
                    >
                      {selected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <span className="font-body text-sm text-wood-900">{family.family_name}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {state.errors?.charges && (
          <p className="mt-1.5 font-body text-sm text-red-600" role="alert">
            {state.errors.charges[0]}
          </p>
        )}
      </div>

      {/* ─── Amount Mode Toggle ──────────────────────────────────── */}
      {selectedFamilyIds.size > 0 && totalCost && (
        <div>
          <div className="mb-3 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setUseManualAmounts(false)}
              className={cn(
                'rounded-full px-3 py-1 font-body text-xs font-medium transition-colors',
                !useManualAmounts
                  ? 'bg-burgundy-700 text-cream-50'
                  : 'bg-cream-100 text-wood-800 hover:bg-cream-100/80'
              )}
            >
              Even Split
            </button>
            <button
              type="button"
              onClick={() => setUseManualAmounts(true)}
              className={cn(
                'rounded-full px-3 py-1 font-body text-xs font-medium transition-colors',
                useManualAmounts
                  ? 'bg-burgundy-700 text-cream-50'
                  : 'bg-cream-100 text-wood-800 hover:bg-cream-100/80'
              )}
            >
              Custom Amounts
            </button>
          </div>

          {/* ─── Summary / Manual Overrides ───────────────────────── */}
          <div className="rounded-xl border border-wood-800/10 bg-cream-50">
            <div className="border-b border-wood-800/5 px-4 py-3">
              <h3 className="font-body text-sm font-medium text-wood-900">Charge Breakdown</h3>
            </div>
            <div className="divide-y divide-wood-800/5">
              {Array.from(selectedFamilyIds).map((familyId) => {
                const family = families.find((f) => f.id === familyId)
                if (!family) return null
                return (
                  <div key={familyId} className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-body text-sm text-wood-900">{family.family_name}</span>
                    {useManualAmounts ? (
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-wood-800/50">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={manualAmounts[familyId] ?? ''}
                          onChange={(e) => handleManualAmountChange(familyId, e.target.value)}
                          placeholder={splitAmount.toFixed(2)}
                          className="w-full rounded-lg border border-wood-800/10 bg-cream-50 py-1.5 pl-7 pr-2 text-right font-body text-sm text-wood-800 focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20"
                        />
                      </div>
                    ) : (
                      <span className="font-body text-sm font-medium text-wood-900">
                        {usd.format(splitAmount)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Totals footer */}
            <div className="border-t border-wood-800/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-body text-sm font-medium text-wood-900">Total</span>
                <span
                  className={cn(
                    'font-body text-sm font-semibold',
                    useManualAmounts && Math.abs(chargesTotal - Number(totalCost)) > 0.01
                      ? 'text-amber-600'
                      : 'text-wood-900'
                  )}
                >
                  {usd.format(chargesTotal)}
                </span>
              </div>
              {useManualAmounts && Math.abs(chargesTotal - Number(totalCost)) > 0.01 && (
                <p className="mt-1 text-xs text-amber-600">
                  Custom total ({usd.format(chargesTotal)}) differs from event cost (
                  {usd.format(Number(totalCost))})
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Existing Charges ────────────────────────────────────── */}
      {existingCharges.length > 0 && (
        <div>
          <h3 className="mb-2 font-body text-sm font-medium text-wood-900">Existing Charges</h3>
          <div className="rounded-xl border border-wood-800/10 bg-cream-50">
            <div className="divide-y divide-wood-800/5">
              {existingCharges.map((charge) => (
                <div
                  key={charge.family_id}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="font-body text-sm text-wood-900">{charge.family_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm font-medium text-wood-900">
                      {usd.format(charge.amount)}
                    </span>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                        charge.paid
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {charge.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Submit / Cancel ─────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-t border-wood-800/10 pt-6">
        <Button type="submit" disabled={isPending || selectedFamilyIds.size === 0 || !totalCost}>
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
              Assigning Costs...
            </span>
          ) : (
            `Assign to ${selectedFamilyIds.size} ${selectedFamilyIds.size === 1 ? 'Family' : 'Families'}`
          )}
        </Button>
        <Button variant="ghost" href={`/admin/events/${eventId}`}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
