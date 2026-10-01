'use client'

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from 'react'

import { createChangeRequest, prepareChangeRequestUploads } from '@/actions/change-requests'
import { Button } from '@/components/ui'
import {
  ElementPicker,
  isValidPagePath,
  type PickedElement,
} from '@/components/features/ElementPicker'
import {
  ALLOWED_ATTACHMENT_TYPES,
  CHANGE_REQUEST_DESCRIPTION_MAX,
  CHANGE_REQUEST_TITLE_MAX,
  MAX_CHANGE_REQUEST_ATTACHMENTS,
  MAX_CHANGE_REQUEST_ATTACHMENT_BYTES,
  changeRequestSchema,
  findAttachmentMention,
  formatBytes,
  guessAttachmentType,
} from '@/lib/validators/change-request'
import { uploadToSignedUrlWithProgress } from '@/lib/direct-upload'

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

interface SelectedFile {
  id: string
  file: File
  previewUrl: string | null
}

interface UploadProgress {
  status: 'uploading' | 'done' | 'error'
  fraction: number
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p className="cr-field-error" role="alert">
      {errors[0]}
    </p>
  )
}

export function ChangeRequestForm({ initialPath = '/' }: { initialPath?: string }) {
  const [state, formAction, isPending] = useActionState(createChangeRequest, initialState)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pagePath, setPagePath] = useState(initialPath)
  const [target, setTarget] = useState<PickedElement | null>(null)
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [pathError, setPathError] = useState<string | null>(null)
  const [clientErrors, setClientErrors] = useState<Record<string, string[]> | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, UploadProgress>>({})
  // Set after the first submit with a mentioned-but-missing attachment, so a
  // second submit goes through: a warning, not a hard block.
  const [missingAttachmentConfirmed, setMissingAttachmentConfirmed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentWarningRef = useRef<HTMLParagraphElement>(null)
  const filesRef = useRef(files)

  useEffect(() => {
    filesRef.current = files
  }, [files])

  // Release object URLs when the form unmounts.
  useEffect(() => {
    return () => {
      filesRef.current.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl))
    }
  }, [])

  const attachmentMention = files.length === 0 ? findAttachmentMention(title, description) : null
  const missingAttachment = attachmentMention !== null

  const handlePagePathChange = useCallback((path: string) => {
    setPagePath(path)
    setPathError(null)
  }, [])

  function addFiles(list: FileList | null) {
    if (!list) return
    setFileError(null)
    const incoming = Array.from(list)
    const next = [...files]
    for (const file of incoming) {
      if (next.length >= MAX_CHANGE_REQUEST_ATTACHMENTS) {
        setFileError(`Attach at most ${MAX_CHANGE_REQUEST_ATTACHMENTS} files`)
        break
      }
      if (file.size > MAX_CHANGE_REQUEST_ATTACHMENT_BYTES) {
        setFileError(`${file.name} is larger than 10 MB`)
        continue
      }
      const type = guessAttachmentType(file.name, file.type)
      if (!type) {
        setFileError(`${file.name} is not a PNG, JPEG, WebP, GIF, or PDF file`)
        continue
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        // Use the inferred type: some OSes give image files an empty MIME type.
        previewUrl: type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })
    }
    setFiles(next)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const entry = current.find((item) => item.id === id)
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl)
      return current.filter((item) => item.id !== id)
    })
    setFileError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploading || isPending) return
    setUploadError(null)
    if (!isValidPagePath(pagePath)) {
      setPathError('Choose a page, or enter a site path like /giving')
      return
    }

    // Check the fields before uploading anything; the server re-validates.
    const fields = {
      title,
      description,
      page_path: pagePath,
      target_selector: target?.selector || undefined,
      target_text: target?.text || undefined,
    }
    const check = changeRequestSchema.safeParse(fields)
    if (!check.success) {
      setClientErrors(check.error.flatten().fieldErrors as Record<string, string[]>)
      return
    }
    setClientErrors(null)

    if (missingAttachment && !missingAttachmentConfirmed) {
      setMissingAttachmentConfirmed(true)
      attachmentWarningRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      attachmentWarningRef.current?.focus({ preventScroll: true })
      return
    }

    // Build the payload from component state so a failed submission keeps
    // every field (including selected files) intact.
    const formData = new FormData()
    formData.set('title', title)
    formData.set('description', description)
    formData.set('page_path', pagePath)
    if (target?.selector) formData.set('target_selector', target.selector)
    if (target?.text) formData.set('target_text', target.text)

    // Attachments go straight to Storage through signed upload URLs; only
    // their pending paths are sent with the form. Every attempt re-uploads,
    // because the server discards pending uploads from a rejected submission.
    if (files.length > 0) {
      setUploading(true)
      setProgress(
        Object.fromEntries(files.map((entry) => [entry.id, { status: 'uploading', fraction: 0 }]))
      )
      try {
        const declared = files.map((entry) => ({
          name: entry.file.name,
          type: guessAttachmentType(entry.file.name, entry.file.type),
          size: entry.file.size,
        }))
        const prepared = await prepareChangeRequestUploads(declared)
        if (!prepared.success) {
          setUploadError(prepared.message)
          setProgress({})
          return
        }

        const results = await Promise.allSettled(
          files.map((entry, index) =>
            uploadToSignedUrlWithProgress(
              prepared.uploads[index].signedUrl,
              entry.file,
              declared[index].type!,
              (fraction) =>
                setProgress((current) => ({
                  ...current,
                  [entry.id]: { status: fraction >= 1 ? 'done' : 'uploading', fraction },
                }))
            ).catch((error: unknown) => {
              setProgress((current) => ({
                ...current,
                [entry.id]: { status: 'error', fraction: 0 },
              }))
              throw error
            })
          )
        )
        const failed = results.findIndex((result) => result.status === 'rejected')
        if (failed !== -1) {
          const reason = (results[failed] as PromiseRejectedResult).reason
          setUploadError(
            `${files[failed].file.name} could not be uploaded${
              reason instanceof Error ? `: ${reason.message}` : ''
            }. Try again.`
          )
          return
        }

        formData.set('upload_session', prepared.sessionId)
        formData.set('upload_token', prepared.sessionToken)
        prepared.uploads.forEach((upload) => formData.append('attachment_paths', upload.path))
      } catch {
        setUploadError(
          'The attachments could not be uploaded. Check your connection and try again.'
        )
        return
      } finally {
        setUploading(false)
      }
    }

    startTransition(() => formAction(formData))
  }

  const errors = clientErrors ?? state.errors
  const busy = uploading || isPending

  return (
    <form onSubmit={handleSubmit} className="cr-form" noValidate>
      {!state.success && state.message && !errors && (
        <div className="admin-error" role="alert">
          <p>{state.message}</p>
        </div>
      )}

      <p className="cr-privacy" role="note" data-testid="change-request-privacy-notice">
        The title and a summary of the change will appear in a public GitHub pull request.
        Don&apos;t include private information (phone numbers, emails, passwords).
      </p>

      <div className="admin-field">
        <label htmlFor="title">
          Title <span className="admin-required">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={CHANGE_REQUEST_TITLE_MAX}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Replace the feast flyer on the homepage"
        />
        <FieldError errors={errors?.title} />
      </div>

      <div className="admin-field">
        <label htmlFor="description">
          What should change? <span className="admin-required">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          maxLength={CHANGE_REQUEST_DESCRIPTION_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the change in plain words. Mention exact wording, dates, or which attachment to use."
        />
        <p className="cr-help">
          The website agent reads this literally and opens a pull request for review. Nothing goes
          live until the pull request is merged.
        </p>
        <FieldError errors={errors?.description} />
      </div>

      <ElementPicker
        pagePath={pagePath}
        onPagePathChange={handlePagePathChange}
        target={target}
        onTargetChange={setTarget}
        pathError={pathError ?? errors?.page_path?.[0]}
      />
      <FieldError errors={errors?.target_selector ?? errors?.target_text} />

      <div className="admin-field">
        <label htmlFor="attachments">Attachments (optional)</label>
        <input
          ref={fileInputRef}
          id="attachments"
          type="file"
          multiple
          accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
          onChange={(event) => addFiles(event.target.files)}
          disabled={busy || files.length >= MAX_CHANGE_REQUEST_ATTACHMENTS}
        />
        <p className="cr-help">
          Up to {MAX_CHANGE_REQUEST_ATTACHMENTS} files, 10 MB each. PNG, JPEG, WebP, GIF, or PDF,
          e.g. a new flyer.
        </p>
        {/* Always mounted so screen readers announce the warning when it appears. */}
        <div role="status" aria-live="polite">
          {missingAttachment && (
            <p
              ref={attachmentWarningRef}
              className="cr-attachment-warning"
              tabIndex={-1}
              data-testid="change-request-missing-attachment"
            >
              Your request mentions &ldquo;{attachmentMention}&rdquo; but nothing is attached.{' '}
              {missingAttachmentConfirmed
                ? 'Add the file above, or submit again to send the request without it.'
                : 'Add the file above if the website agent needs it.'}
            </p>
          )}
        </div>
        {(uploadError || fileError || errors?.attachments) && (
          <p className="cr-field-error" role="alert">
            {uploadError ?? fileError ?? errors?.attachments?.[0]}
          </p>
        )}
        {files.length > 0 && (
          <ul className="cr-files" aria-label="Selected attachments">
            {files.map((entry) => (
              <li key={entry.id} className="cr-file">
                <div className="cr-file-thumb">
                  {entry.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.previewUrl} alt={`Preview of ${entry.file.name}`} />
                  ) : (
                    <span>PDF</span>
                  )}
                </div>
                <div className="cr-file-meta">
                  <span className="cr-file-name" title={entry.file.name}>
                    {entry.file.name}
                  </span>
                  <button
                    type="button"
                    className="admin-button admin-button-bare"
                    disabled={busy}
                    onClick={() => removeFile(entry.id)}
                    aria-label={`Remove ${entry.file.name}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="cr-file-meta">
                  <span className="cr-file-size">{formatBytes(entry.file.size)}</span>
                  {progress[entry.id] && (
                    <span className="cr-upload-status" data-status={progress[entry.id].status}>
                      {progress[entry.id].status === 'error'
                        ? 'Failed'
                        : progress[entry.id].status === 'done'
                          ? 'Uploaded'
                          : `${Math.round(progress[entry.id].fraction * 100)}%`}
                    </span>
                  )}
                </div>
                {progress[entry.id]?.status === 'uploading' && (
                  <progress
                    className="cr-upload-progress"
                    max={1}
                    value={progress[entry.id].fraction}
                    aria-label={`Uploading ${entry.file.name}`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-wood-800/10 pt-6">
        <Button type="submit" disabled={busy} className="admin-button admin-button-primary">
          {uploading
            ? 'Uploading attachments…'
            : isPending
              ? 'Submitting…'
              : missingAttachment && missingAttachmentConfirmed
                ? 'Submit without attachment'
                : 'Submit request'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          href="/admin/requests"
          className="admin-button admin-button-quiet"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
