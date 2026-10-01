'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface GalleryItem {
  id: string
  label: string
  /** Small cached thumbnail; null when the file type has no thumbnail. */
  thumbnailSrc: string | null
  /** Full-size short-lived signed URL; null when signing failed. */
  fullSrc: string | null
}

export interface GalleryComparison {
  viewport: string
  before: GalleryItem | null
  after: GalleryItem | null
}

function Tile({
  item,
  placeholder,
  onOpen,
}: {
  item: GalleryItem | null
  placeholder: string
  onOpen: (item: GalleryItem) => void
}) {
  const [failed, setFailed] = useState(false)

  if (!item) {
    return (
      <figure className="cr-shot" data-state="empty">
        <div className="cr-shot-placeholder">{placeholder}</div>
      </figure>
    )
  }

  const unavailable = failed || !item.thumbnailSrc
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- private, already-resized thumbnail
    <img
      src={item.thumbnailSrc!}
      alt={item.label}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
  return (
    <figure className="cr-shot" data-state={unavailable ? 'error' : 'ready'}>
      {unavailable ? (
        <div className="cr-shot-placeholder" role="note">
          Couldn’t load this screenshot. Refresh the page to try again.
        </div>
      ) : item.fullSrc ? (
        <a
          href={item.fullSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="cr-shot-link"
          onClick={(event) => {
            // Keep new-tab gestures; a plain click opens the lightbox.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
            event.preventDefault()
            onOpen(item)
          }}
        >
          {image}
          <span className="sr-only"> (enlarge)</span>
        </a>
      ) : (
        <>
          {image}
          <p className="cr-shot-note" role="note">
            Full size unavailable. Refresh the page to try again.
          </p>
        </>
      )}
      <figcaption>{item.label}</figcaption>
    </figure>
  )
}

/**
 * Before/after screenshots side by side per viewport, with a click-to-zoom
 * lightbox (native <dialog>: focus trap and Escape come for free). Links keep
 * working as plain new-tab links without JavaScript.
 */
export function ChangeRequestEvidenceGallery({
  comparisons,
  others,
}: {
  comparisons: GalleryComparison[]
  others: GalleryItem[]
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const items = [
    ...comparisons.flatMap((comparison) =>
      [comparison.before, comparison.after].filter((item): item is GalleryItem => Boolean(item))
    ),
    ...others,
  ].filter((item) => item.fullSrc)

  // Track the open screenshot by file id (not index), and hold on to the URL
  // it opened with: the page's auto-refresh mints new signed URLs every few
  // seconds, which must neither switch the image nor restart its download.
  const [selected, setSelected] = useState<{
    id: string
    src: string
    failed: boolean
  } | null>(null)
  const index = selected ? items.findIndex((item) => item.id === selected.id) : -1
  const current = index === -1 ? null : items[index]
  const freshSrc = current?.fullSrc ?? null

  const show = useCallback((item: GalleryItem | undefined) => {
    setSelected(item?.fullSrc ? { id: item.id, src: item.fullSrc, failed: false } : null)
  }, [])

  const open = useCallback((item: GalleryItem) => show(item), [show])

  const step = useCallback(
    (delta: number) => {
      if (index === -1 || items.length === 0) return
      show(items[(index + delta + items.length) % items.length])
    },
    [index, items, show]
  )

  // The screenshot vanished (or lost its URL) after a refresh: close.
  useEffect(() => {
    if (selected && index === -1) setSelected(null)
  }, [selected, index])

  // After a failed load, adopt the refreshed signed URL once one arrives.
  useEffect(() => {
    if (selected?.failed && freshSrc && freshSrc !== selected.src) {
      setSelected({ id: selected.id, src: freshSrc, failed: false })
    }
  }, [selected, freshSrc])

  const isOpen = selected !== null && current !== null
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  // Arrow keys page through screenshots; a click on the backdrop (the dialog
  // element itself, outside the panel) closes it. Escape is native.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close()
    }
    dialog.addEventListener('keydown', onKeyDown)
    dialog.addEventListener('click', onClick)
    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      dialog.removeEventListener('click', onClick)
    }
  }, [step])

  return (
    <>
      {comparisons.map((comparison) => (
        <div key={comparison.viewport} className="cr-compare" data-viewport={comparison.viewport}>
          <h3 className="cr-compare-title">
            {comparison.viewport.charAt(0).toUpperCase() + comparison.viewport.slice(1)}
          </h3>
          <div className="cr-compare-grid">
            <Tile item={comparison.before} placeholder="No before screenshot" onOpen={open} />
            <Tile item={comparison.after} placeholder="No after screenshot" onOpen={open} />
          </div>
        </div>
      ))}
      {others.length > 0 && (
        <div className="cr-compare-grid cr-compare-others">
          {others.map((item) => (
            <Tile key={item.id} item={item} placeholder="" onOpen={open} />
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="cr-lightbox"
        aria-label={current ? `Screenshot: ${current.label}` : 'Screenshot'}
        onClose={() => setSelected(null)}
      >
        {selected && current && (
          <div className="cr-lightbox-panel">
            <div className="cr-lightbox-bar">
              <p className="cr-lightbox-caption">
                {current.label}
                {items.length > 1 && (
                  <span className="admin-meta">
                    {' '}
                    · {index + 1} of {items.length}
                  </span>
                )}
              </p>
              <div className="cr-lightbox-controls">
                {items.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="admin-button admin-button-quiet"
                      onClick={() => step(-1)}
                      aria-label="Previous screenshot"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button-quiet"
                      onClick={() => step(1)}
                      aria-label="Next screenshot"
                    >
                      →
                    </button>
                  </>
                )}
                <a
                  href={selected.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-button admin-button-quiet"
                >
                  Full size ↗<span className="sr-only"> (opens in a new tab)</span>
                </a>
                <button
                  type="button"
                  className="admin-button admin-button-quiet"
                  onClick={() => dialogRef.current?.close()}
                >
                  Close
                </button>
              </div>
            </div>
            {/* Focusable so keyboard users can scroll tall screenshots (Safari). */}
            <div
              className="cr-lightbox-image"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region
              tabIndex={0}
              role="region"
              aria-label={`${current.label}, scrollable`}
            >
              {selected.failed ? (
                <div className="cr-shot-placeholder cr-lightbox-error" role="alert">
                  <p>This screenshot link has expired or could not load.</p>
                  <button
                    type="button"
                    className="admin-button admin-button-quiet"
                    onClick={() => router.refresh()}
                  >
                    Reload screenshots
                  </button>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- private signed URL
                <img
                  src={selected.src}
                  alt={current.label}
                  onError={() =>
                    setSelected((value) => (value ? { ...value, failed: true } : value))
                  }
                />
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
