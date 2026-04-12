'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { buyShares } from '@/actions/shares'

export function BuySharesPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [names, setNames] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const [state, formAction, isPending] = useActionState(buyShares, {
    success: false,
    message: '',
  })

  // Close panel and reset on success
  useEffect(() => {
    if (state.success && state.message) {
      setNames([])
      setInputValue('')
      setIsOpen(false)
    }
  }, [state])

  // Escape key closes panel
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const addName = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    setNames((prev) => [...prev, trimmed])
    setInputValue('')
  }, [inputValue])

  const removeName = useCallback((index: number) => {
    setNames((prev) => prev.filter((_, i) => i !== index))
  }, [])

  function handleSubmit() {
    const formData = new FormData()
    formData.append('names', JSON.stringify(names))
    formData.append('year', String(new Date().getFullYear()))
    formAction(formData)
  }

  const total = names.length * 50

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gold-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gold-700"
      >
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
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Buy Shares
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform bg-white shadow-xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Buy Shares"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wood-800/10 px-5 py-4">
          <h3 className="font-heading text-lg font-semibold text-wood-900">Buy Shares</h3>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-wood-800/40 transition-colors hover:text-wood-900"
            aria-label="Close panel"
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
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="mb-5 text-sm text-wood-800/60">
            Add names to be remembered in weekly services. Each share is{' '}
            <strong className="text-wood-900">$50</strong>.
          </p>

          {/* Name input */}
          <div className="mb-5">
            <label htmlFor="share-name" className="mb-1.5 block text-sm font-medium text-wood-900">
              Person&apos;s Name
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                id="share-name"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addName()
                  }
                }}
                placeholder="e.g. Thomas Kurian"
                className="flex-1 rounded-lg border border-wood-800/15 bg-white px-3 py-2 text-sm text-wood-900 placeholder:text-wood-800/30 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
              />
              <button
                type="button"
                onClick={addName}
                className="rounded-lg border border-wood-800/15 px-3 py-2 text-sm font-medium text-wood-900 transition-colors hover:bg-wood-800/5"
              >
                Add
              </button>
            </div>
            <p className="mt-1 text-xs text-wood-800/40">Press Enter or click Add for each name</p>
          </div>

          {/* Name pills */}
          {names.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {names.map((name, index) => (
                <span
                  key={`${name}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-sm font-medium text-gold-800"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeName(index)}
                    className="ml-0.5 text-gold-600 transition-colors hover:text-gold-900"
                    aria-label={`Remove ${name}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Running total */}
          {names.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-wood-800/[0.03] px-4 py-3">
              <span className="text-sm font-medium text-wood-800/60">
                {names.length} {names.length === 1 ? 'share' : 'shares'}
              </span>
              <span className="font-heading text-lg font-semibold text-wood-900">
                ${total.toLocaleString('en-US')}
              </span>
            </div>
          )}

          {/* Error message */}
          {!state.success && state.message && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-wood-800/10 px-5 py-4 justify-end">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg border border-wood-800/15 px-4 py-2 text-sm font-medium text-wood-900 transition-colors hover:bg-wood-800/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={names.length === 0 || isPending}
            className="rounded-lg bg-gold-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gold-700 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isPending ? 'Submitting...' : 'Submit Shares'}
          </button>
        </div>
      </div>
    </>
  )
}
