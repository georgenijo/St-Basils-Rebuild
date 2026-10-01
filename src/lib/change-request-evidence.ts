import type { ChangeRequestFileWithUrl } from '@/types/change-request'

export interface EvidenceComparison {
  /** Viewport name from the worker label, e.g. "desktop" or "mobile". */
  viewport: string
  before: ChangeRequestFileWithUrl | null
  after: ChangeRequestFileWithUrl | null
}

export interface EvidenceGroups {
  comparisons: EvidenceComparison[]
  /** Screenshots whose label does not follow the before/after pattern. */
  others: ChangeRequestFileWithUrl[]
}

// The worker labels screenshots "before · desktop", "after · mobile", ...
// (services/change-request-agent/src/verify.ts).
const SHOT_LABEL = /^(before|after)\s*·\s*([a-z][\w-]*)$/i
const VIEWPORT_ORDER = ['desktop', 'mobile']

/** Pair before/after screenshots per viewport, desktop first. */
export function groupEvidenceShots(shots: ChangeRequestFileWithUrl[]): EvidenceGroups {
  const byViewport = new Map<string, EvidenceComparison>()
  const others: ChangeRequestFileWithUrl[] = []

  for (const shot of shots) {
    const match = SHOT_LABEL.exec((shot.label ?? '').trim())
    if (!match) {
      others.push(shot)
      continue
    }
    const phase = match[1].toLowerCase() as 'before' | 'after'
    const viewport = match[2].toLowerCase()
    const comparison = byViewport.get(viewport) ?? { viewport, before: null, after: null }
    if (comparison[phase]) {
      others.push(shot)
      continue
    }
    comparison[phase] = shot
    byViewport.set(viewport, comparison)
  }

  const rank = (viewport: string) => {
    const index = VIEWPORT_ORDER.indexOf(viewport)
    return index === -1 ? VIEWPORT_ORDER.length : index
  }
  const comparisons = [...byViewport.values()].sort(
    (a, b) => rank(a.viewport) - rank(b.viewport) || a.viewport.localeCompare(b.viewport)
  )
  return { comparisons, others }
}

export function viewportLabel(viewport: string): string {
  return viewport.charAt(0).toUpperCase() + viewport.slice(1)
}
