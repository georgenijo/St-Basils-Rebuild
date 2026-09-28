'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { buildElementSelector, describeElement, extractElementText } from '@/lib/element-selector'
import { CHANGE_REQUEST_PAGE_PATH_PATTERN } from '@/lib/validators/change-request'

export const COMMON_PUBLIC_PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'Our History' },
  { path: '/spiritual-leaders', label: 'Our Spiritual Fathers' },
  { path: '/our-clergy', label: 'Our Clergy' },
  { path: '/office-bearers', label: 'Office Bearers' },
  { path: '/acolytes-choir', label: 'Acolytes & Choir' },
  { path: '/our-organizations', label: 'Our Organizations' },
  { path: '/events', label: 'Events' },
  { path: '/announcements', label: 'Announcements' },
  { path: '/useful-links', label: 'Useful Links' },
  { path: '/first-time', label: 'First Time Visiting?' },
  { path: '/giving', label: 'Giving' },
  { path: '/contact', label: 'Contact Us' },
  { path: '/privacy-policy', label: 'Privacy Policy' },
  { path: '/terms-of-use', label: 'Terms of Use' },
]

const CUSTOM = '__custom__'

export interface PickedElement {
  selector: string
  text: string
  description: string
}

interface ElementPickerProps {
  pagePath: string
  onPagePathChange: (path: string) => void
  target: PickedElement | null
  onTargetChange: (target: PickedElement | null) => void
  pathError?: string
}

export function isValidPagePath(path: string): boolean {
  return CHANGE_REQUEST_PAGE_PATH_PATTERN.test(path) && path.length <= 300
}

const OVERLAY_ID = '__change-request-picker-overlay'

export function ElementPicker({
  pagePath,
  onPagePathChange,
  target,
  onTargetChange,
  pathError,
}: ElementPickerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const isCommon = COMMON_PUBLIC_PAGES.some((page) => page.path === pagePath)
  const [customMode, setCustomMode] = useState(!isCommon)
  const [customPath, setCustomPath] = useState(isCommon ? '' : pagePath)
  // The iframe's src only changes when the admin chooses a page; in-frame
  // navigation updates pagePath without reloading the frame a second time.
  const [frameSrc, setFrameSrc] = useState(isValidPagePath(pagePath) ? pagePath : '/')
  const [frameVersion, setFrameVersion] = useState(0)
  const [picking, setPicking] = useState(false)

  const pagePathRef = useRef(pagePath)
  const lastFramePathRef = useRef<string | null>(null)
  // Path the admin asked the frame to load; see syncFramePath.
  const pendingFramePathRef = useRef<string | null>(frameSrc)

  const loadFrame = useCallback((path: string) => {
    pendingFramePathRef.current = path
    setFrameSrc(path)
  }, [])

  const choosePath = useCallback(
    (path: string) => {
      onPagePathChange(path)
      onTargetChange(null)
      if (isValidPagePath(path)) loadFrame(path)
    },
    [onPagePathChange, onTargetChange, loadFrame]
  )

  useEffect(() => {
    pagePathRef.current = pagePath
  }, [pagePath])

  // Follow navigation inside the preview (full loads and client-side route
  // changes) so the request records the page the admin actually ended up on.
  // Paths the admin chose are not treated as navigation: their arrival never
  // overwrites what was typed meanwhile, and the old page lingering while the
  // new one loads is ignored. A server redirect (load lands elsewhere) syncs.
  const syncFramePath = useCallback(
    (fromLoad = false) => {
      let framePath: string | undefined
      try {
        framePath = iframeRef.current?.contentWindow?.location.pathname
      } catch {
        return // Cross-origin navigation (external link): leave the chosen path alone.
      }
      if (!framePath || framePath === 'blank') return

      const pending = pendingFramePathRef.current
      if (pending) {
        if (framePath === pending) {
          pendingFramePathRef.current = null
          lastFramePathRef.current = framePath
          return
        }
        if (!fromLoad) return
        pendingFramePathRef.current = null
      }

      if (framePath === lastFramePathRef.current) return
      lastFramePathRef.current = framePath
      if (framePath === pagePathRef.current || !isValidPagePath(framePath)) return

      onPagePathChange(framePath)
      onTargetChange(null)
      const common = COMMON_PUBLIC_PAGES.some((page) => page.path === framePath)
      setCustomMode(!common)
      if (!common) setCustomPath(framePath)
    },
    [onPagePathChange, onTargetChange]
  )

  const handleFrameLoad = useCallback(() => {
    setFrameVersion((version) => version + 1)
    syncFramePath(true)
  }, [syncFramePath])

  useEffect(() => {
    const id = window.setInterval(() => syncFramePath(), 500)
    return () => window.clearInterval(id)
  }, [syncFramePath])

  // Pick mode: outline hovered elements and capture the clicked one, without
  // letting the click reach the page (no navigation, no form submission).
  useEffect(() => {
    if (!picking) return
    const frame = iframeRef.current
    let doc: Document | null = null
    try {
      doc = frame?.contentDocument ?? null
    } catch {
      doc = null
    }
    const win = frame?.contentWindow
    if (!doc || !doc.body || !win) return

    const overlay = doc.createElement('div')
    overlay.id = OVERLAY_ID
    Object.assign(overlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      border: '2px solid #9b1b3d',
      background: 'rgba(155, 27, 61, 0.12)',
      borderRadius: '3px',
      display: 'none',
      transition: 'all 60ms ease-out',
    })
    doc.body.appendChild(overlay)
    // A stylesheet (not an inline body style) so the framed page's React tree
    // never sees attribute changes it did not render.
    const cursorStyle = doc.createElement('style')
    cursorStyle.textContent = '*, *::before, *::after { cursor: crosshair !important; }'
    doc.head.appendChild(cursorStyle)

    const pickable = (node: EventTarget | null): Element | null => {
      if (!node || !(node as Node).nodeType) return null
      const el = (node as Node).nodeType === 1 ? (node as Element) : (node as Node).parentElement
      if (!el || el.id === OVERLAY_ID || el === doc!.body || el === doc!.documentElement) {
        return null
      }
      return el
    }

    const onMove = (event: Event) => {
      const el = pickable(event.target)
      if (!el) {
        overlay.style.display = 'none'
        return
      }
      const rect = el.getBoundingClientRect()
      Object.assign(overlay.style, {
        display: 'block',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      })
    }

    const block = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onClick = (event: Event) => {
      block(event)
      const el = pickable(event.target)
      if (!el) return
      onTargetChange({
        selector: buildElementSelector(el),
        text: extractElementText(el),
        description: describeElement(el),
      })
      setPicking(false)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        block(event)
        setPicking(false)
      }
    }

    const blocked = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick', 'submit']
    win.addEventListener('mouseover', onMove, true)
    win.addEventListener('mousemove', onMove, true)
    win.addEventListener('click', onClick, true)
    win.addEventListener('keydown', onKey, true)
    blocked.forEach((type) => win.addEventListener(type, block, true))
    const onParentKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPicking(false)
    }
    window.addEventListener('keydown', onParentKey)

    return () => {
      win.removeEventListener('mouseover', onMove, true)
      win.removeEventListener('mousemove', onMove, true)
      win.removeEventListener('click', onClick, true)
      win.removeEventListener('keydown', onKey, true)
      blocked.forEach((type) => win.removeEventListener(type, block, true))
      window.removeEventListener('keydown', onParentKey)
      overlay.remove()
      cursorStyle.remove()
    }
  }, [picking, frameVersion, onTargetChange])

  const selectValue = customMode ? CUSTOM : pagePath

  return (
    <div className="cr-picker">
      <div className="cr-picker-bar">
        <div className="admin-field cr-picker-page">
          <label htmlFor="page_path_select">
            Page <span className="admin-required">*</span>
          </label>
          <select
            id="page_path_select"
            value={selectValue}
            onChange={(event) => {
              const value = event.target.value
              setPicking(false)
              if (value === CUSTOM) {
                setCustomMode(true)
                setCustomPath(pagePath)
                return
              }
              setCustomMode(false)
              choosePath(value)
            }}
          >
            {COMMON_PUBLIC_PAGES.map((page) => (
              <option key={page.path} value={page.path}>
                {page.label} ({page.path})
              </option>
            ))}
            <option value={CUSTOM}>Other path…</option>
          </select>
        </div>
        {customMode && (
          <div className="admin-field cr-picker-custom">
            <label htmlFor="page_path_custom">Path</label>
            <input
              id="page_path_custom"
              type="text"
              value={customPath}
              placeholder="/announcements/some-slug"
              maxLength={300}
              onChange={(event) => {
                setCustomPath(event.target.value)
                onPagePathChange(event.target.value.trim())
                onTargetChange(null)
              }}
              onBlur={() => {
                const path = customPath.trim()
                if (isValidPagePath(path)) loadFrame(path)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const path = customPath.trim()
                  if (isValidPagePath(path)) loadFrame(path)
                }
              }}
            />
          </div>
        )}
      </div>
      {pathError && (
        <p className="cr-field-error" role="alert">
          {pathError}
        </p>
      )}

      {/* Desktop: live preview + element picker */}
      <div className="cr-picker-desktop">
        <div className="cr-picker-toolbar">
          <span className="cr-picker-hint">
            {picking
              ? 'Click the part of the page you want changed. Press Esc to cancel.'
              : 'Optional: point at the exact element on the page.'}
          </span>
          <button
            type="button"
            className={`admin-button ${picking ? 'admin-button-primary' : 'admin-button-quiet'}`}
            onClick={() => setPicking((value) => !value)}
            aria-pressed={picking}
          >
            {picking ? 'Cancel picking' : target ? 'Re-pick element' : 'Pick element'}
          </button>
        </div>
        <div className="cr-picker-frame" data-picking={picking ? 'true' : undefined}>
          <iframe
            ref={iframeRef}
            src={frameSrc}
            title="Page preview for element picker"
            onLoad={handleFrameLoad}
          />
        </div>
      </div>

      {/* Picked element summary */}
      {target ? (
        <div className="cr-picked cr-picker-desktop-only" data-testid="picked-element">
          <div className="cr-picked-copy">
            <p className="cr-picked-title">{target.description}</p>
            {target.selector && <code className="cr-picked-selector">{target.selector}</code>}
            {target.text && <p className="cr-picked-text">“{target.text}”</p>}
          </div>
          <div className="cr-picked-actions">
            <button
              type="button"
              className="admin-button admin-button-bare"
              onClick={() => setPicking(true)}
            >
              Re-pick
            </button>
            <button
              type="button"
              className="admin-button admin-button-bare"
              onClick={() => onTargetChange(null)}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {/* Narrow screens: describe the element in words instead */}
      <div className="cr-picker-mobile admin-field">
        <label htmlFor="target_text_mobile">Text on or near the element (optional)</label>
        <input
          id="target_text_mobile"
          type="text"
          maxLength={500}
          value={target?.text ?? ''}
          placeholder="e.g. Sunday Holy Qurbono 9:15 AM"
          onChange={(event) =>
            onTargetChange(
              event.target.value
                ? {
                    selector: target?.selector ?? '',
                    text: event.target.value,
                    description: target?.description ?? 'Described element',
                  }
                : null
            )
          }
        />
      </div>
    </div>
  )
}
