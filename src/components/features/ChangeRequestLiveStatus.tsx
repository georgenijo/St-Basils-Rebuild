'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { getChangeRequestLiveState } from '@/actions/change-request-live'
import {
  CHANGE_REQUEST_STEPS,
  formatElapsed,
  getChangeRequestStep,
} from '@/lib/change-request-status'

// Poll quickly while things are moving, slow down once nothing has changed
// for a while (CI and preview builds take minutes), and stop entirely after
// a long quiet spell so a forgotten tab does not poll forever.
const POLL_MS = 5_000
const SLOW_POLL_MS = 15_000
const SLOW_AFTER_MS = 10 * 60_000
const STOP_AFTER_MS = 2 * 60 * 60_000
// The worker posts its closing message a little after the final status, so
// keep watching briefly once the request stops being active.
const DRAIN_MS = 3 * 60_000
// Attachment and evidence links are signed for 10 minutes; re-render the page
// before they expire even if nothing else changed.
const URL_REFRESH_MS = 8 * 60_000

interface ChangeRequestLiveStatusProps {
  requestId: string
  active: boolean
  status: string
  previewUrl: string | null
  claimedAt: string | null
  createdAt: string
  updatedAt: string
  /** Omit while the thread is still loading: the first poll sets the baseline. */
  messageCount?: number
  fileCount?: number
}

/**
 * Current step, elapsed time, and live updates for a request the website
 * agent is working on. Polls a small fingerprint of the request and refreshes
 * the server-rendered page when the status, thread, or files changed (and
 * before signed file links expire). Paused while the tab is hidden. Render it
 * for every status: it shows nothing once the request is done, but keeps
 * polling for a few minutes after it finishes to pick up the closing message.
 */
export function ChangeRequestLiveStatus({
  requestId,
  active,
  status,
  previewUrl,
  claimedAt,
  createdAt,
  updatedAt,
  messageCount,
  fileCount,
}: ChangeRequestLiveStatusProps) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [paused, setPaused] = useState(false)
  // Null until mounted, so server and client render the same markup.
  const [now, setNow] = useState<number | null>(null)

  const step = getChangeRequestStep({
    status,
    preview_url: previewUrl,
    claimed_at: claimedAt,
    created_at: createdAt,
    updated_at: updatedAt,
  })

  // What the page currently shows; a poll result that differs means refresh.
  const shown = useRef({ status, updatedAt, messageCount, fileCount })
  const lastChangeAt = useRef(0)
  const lastRefreshAt = useRef(0)
  const refreshingRef = useRef(refreshing)
  const wasActive = useRef(active)
  const drainUntil = useRef(0)

  useEffect(() => {
    shown.current = { status, updatedAt, messageCount, fileCount }
    lastChangeAt.current = Date.now()
    lastRefreshAt.current = Date.now()
  }, [status, updatedAt, messageCount, fileCount])

  useEffect(() => {
    if (wasActive.current && !active) drainUntil.current = Date.now() + DRAIN_MS
    wasActive.current = active
  }, [active])

  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (paused || (!active && Date.now() >= drainUntil.current)) return
    let timer: number | undefined
    let cancelled = false

    const schedule = (ms: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(tick, ms)
    }

    async function tick() {
      // Hidden tabs stop here; the visibility listener resumes polling.
      if (cancelled || document.visibilityState !== 'visible') return
      if (!active && Date.now() >= drainUntil.current) return
      const quietFor = Date.now() - lastChangeAt.current
      if (quietFor >= STOP_AFTER_MS) {
        setPaused(true)
        return
      }
      const refresh = () => {
        lastRefreshAt.current = Date.now()
        startRefresh(() => router.refresh())
      }
      if (!refreshingRef.current) {
        try {
          const latest = await getChangeRequestLiveState(requestId)
          if (cancelled) return
          const current = shown.current
          if (latest && current.messageCount === undefined) {
            current.messageCount = latest.messageCount
          }
          if (latest && current.fileCount === undefined) current.fileCount = latest.fileCount
          if (
            latest &&
            (latest.status !== current.status ||
              latest.updatedAt !== current.updatedAt ||
              latest.messageCount !== current.messageCount ||
              latest.fileCount !== current.fileCount)
          ) {
            lastChangeAt.current = Date.now()
            refresh()
          } else if (Date.now() - lastRefreshAt.current >= URL_REFRESH_MS) {
            refresh()
          }
        } catch {
          // Offline or a deploy in progress: try again on the next tick.
        }
      }
      if (!cancelled) schedule(quietFor >= SLOW_AFTER_MS ? SLOW_POLL_MS : POLL_MS)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      // Time spent hidden says nothing about whether the request changed:
      // check now, and restart the quiet-period clock.
      lastChangeAt.current = Date.now()
      // A tab hidden through the whole post-completion drain still gets one
      // catch-up check for the closing message.
      if (!active && drainUntil.current > 0) {
        drainUntil.current = Math.max(drainUntil.current, Date.now() + POLL_MS)
      }
      schedule(0)
    }

    schedule(POLL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [active, paused, requestId, router])

  const resume = useCallback(() => {
    lastChangeAt.current = Date.now()
    setPaused(false)
    startRefresh(() => router.refresh())
  }, [router])

  if (!active) return null
  // Active without an agent step (e.g. merging, or waiting for the live-site
  // check): just show that the page is updating itself.
  const liveIndicator = paused ? (
    <span>
      Live updates paused.{' '}
      <button type="button" className="admin-button admin-button-bare" onClick={resume}>
        Refresh
      </button>
    </span>
  ) : (
    <span className="cr-live">Live — updates automatically</span>
  )
  if (!step) return <p className="cr-progress-meta">{liveIndicator}</p>
  const currentIndex = CHANGE_REQUEST_STEPS.findIndex((item) => item.key === step.key)
  const since = Date.parse(step.since)
  const started = step.startedAt ? Date.parse(step.startedAt) : NaN

  return (
    <div className="cr-progress" data-testid="change-request-live-status">
      <ol className="cr-steps" aria-label="Progress">
        {CHANGE_REQUEST_STEPS.map((item, index) => (
          <li
            key={item.key}
            className="cr-step"
            data-state={index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'next'}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            {item.label}
          </li>
        ))}
      </ol>
      <p className="cr-progress-step" aria-live="polite" data-testid="change-request-step">
        {step.label}
      </p>
      <p className="cr-progress-meta">
        {now !== null && Number.isFinite(since) && (
          <span data-testid="change-request-step-elapsed">
            {step.key === 'queued' ? 'Waiting' : 'On this step'} for {formatElapsed(now - since)}
          </span>
        )}
        {now !== null && Number.isFinite(started) && step.key !== 'queued' && (
          <span>Agent working for {formatElapsed(now - started)}</span>
        )}
        {liveIndicator}
      </p>
    </div>
  )
}
