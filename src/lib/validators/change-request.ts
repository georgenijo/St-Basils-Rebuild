import { z } from 'zod'

// Limits mirror the CHECK constraints in
// supabase/migrations/20260928000000_create_change_requests.sql.
export const CHANGE_REQUEST_TITLE_MIN = 3
export const CHANGE_REQUEST_TITLE_MAX = 120
export const CHANGE_REQUEST_DESCRIPTION_MIN = 10
export const CHANGE_REQUEST_DESCRIPTION_MAX = 5000
export const CHANGE_REQUEST_PAGE_PATH_MAX = 300
export const CHANGE_REQUEST_SELECTOR_MAX = 1000
export const CHANGE_REQUEST_TARGET_TEXT_MAX = 500
export const CHANGE_REQUEST_MESSAGE_MAX = 5000

export const MAX_CHANGE_REQUEST_ATTACHMENTS = 5
export const MAX_CHANGE_REQUEST_ATTACHMENT_BYTES = 10 * 1024 * 1024

// Exactly one leading slash: `//host` would be a protocol-relative URL.
// Mirrors the page_path CHECK constraint in the migration.
export const CHANGE_REQUEST_PAGE_PATH_PATTERN = /^\/(?!\/)[A-Za-z0-9/_.~-]*$/

export const ALLOWED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const

export type AttachmentContentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number]

/** Empty / missing form values become `undefined` so optional fields stay optional. */
function blankToUndefined(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string' && value.trim() === '') return undefined
  return value
}

export const changeRequestSchema = z.object({
  title: z
    .string({ error: 'Title is required' })
    .trim()
    .min(CHANGE_REQUEST_TITLE_MIN, `Title must be at least ${CHANGE_REQUEST_TITLE_MIN} characters`)
    .max(CHANGE_REQUEST_TITLE_MAX, `Title must be ${CHANGE_REQUEST_TITLE_MAX} characters or less`),
  description: z
    .string({ error: 'Description is required' })
    .trim()
    .min(
      CHANGE_REQUEST_DESCRIPTION_MIN,
      `Describe the change in at least ${CHANGE_REQUEST_DESCRIPTION_MIN} characters`
    )
    .max(
      CHANGE_REQUEST_DESCRIPTION_MAX,
      `Description must be ${CHANGE_REQUEST_DESCRIPTION_MAX} characters or less`
    ),
  page_path: z
    .string({ error: 'Page is required' })
    .trim()
    .min(1, 'Page is required')
    .max(CHANGE_REQUEST_PAGE_PATH_MAX, 'Page path is too long')
    .regex(
      CHANGE_REQUEST_PAGE_PATH_PATTERN,
      'Page must be a site path like / or /giving (letters, numbers, / _ . ~ -)'
    ),
  target_selector: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .max(CHANGE_REQUEST_SELECTOR_MAX, 'Selected element is too complex; pick it again')
      .optional()
  ),
  target_text: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .max(
        CHANGE_REQUEST_TARGET_TEXT_MAX,
        `Element text must be ${CHANGE_REQUEST_TARGET_TEXT_MAX} characters or less`
      )
      .optional()
  ),
})

export type ChangeRequestFormData = z.infer<typeof changeRequestSchema>

export const changeRequestMessageSchema = z.object({
  request_id: z.uuid('Invalid request'),
  body: z
    .string({ error: 'Message is required' })
    .trim()
    .min(1, 'Message is required')
    .max(
      CHANGE_REQUEST_MESSAGE_MAX,
      `Message must be ${CHANGE_REQUEST_MESSAGE_MAX} characters or less`
    ),
})

// ─── Attachments ─────────────────────────────────────────────────────

/** Declared metadata the browser sends before uploading directly to Storage. */
export const attachmentUploadRequestSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1, 'Each file needs a name').max(255, 'File name is too long'),
      type: z.enum(ALLOWED_ATTACHMENT_TYPES, {
        error: 'Attachments must be PNG, JPEG, WebP, GIF, or PDF files',
      }),
      size: z
        .number()
        .int()
        .positive('Attachments cannot be empty')
        .max(MAX_CHANGE_REQUEST_ATTACHMENT_BYTES, 'Each attachment must be 10 MB or smaller'),
    })
  )
  .min(1, 'Choose at least one file')
  .max(MAX_CHANGE_REQUEST_ATTACHMENTS, `Attach at most ${MAX_CHANGE_REQUEST_ATTACHMENTS} files`)

export type AttachmentUploadRequest = z.infer<typeof attachmentUploadRequestSchema>

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0))
}

/**
 * Identify an allowed attachment type from its leading bytes. The browser's
 * declared MIME type is never trusted; anything unrecognized returns null.
 */
export function detectAttachmentType(bytes: Uint8Array): AttachmentContentType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'image/gif'
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp'
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf'
  return null
}

const EXTENSIONS: Record<AttachmentContentType, string[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
}

const MAX_FILENAME_STEM = 80

/**
 * Reduce a user-supplied filename to a safe storage key segment: basename only,
 * ASCII letters/digits/`.`/`_`/`-`, no leading dots, bounded length, and an
 * extension that matches the detected content type.
 */
export function sanitizeAttachmentFilename(
  name: string,
  contentType: AttachmentContentType
): string {
  const basename = name.split(/[\\/]/).pop() ?? ''
  const ascii = basename.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  const dot = ascii.lastIndexOf('.')
  const rawStem = dot > 0 ? ascii.slice(0, dot) : ascii
  const rawExt = dot > 0 ? ascii.slice(dot + 1).toLowerCase() : ''

  const stem =
    rawStem
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, MAX_FILENAME_STEM)
      .replace(/[-_.]+$/g, '') || 'file'

  const allowed = EXTENSIONS[contentType]
  const ext = allowed.includes(rawExt) ? rawExt : allowed[0]
  return `${stem}.${ext}`
}

/** Browser-side fallback when a File has no declared type (some OSes omit it). */
export function guessAttachmentType(name: string, declared: string): AttachmentContentType | null {
  if ((ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(declared)) {
    return declared as AttachmentContentType
  }
  if (declared) return null
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const match = (Object.entries(EXTENSIONS) as [AttachmentContentType, string[]][]).find(
    ([, extensions]) => extensions.includes(ext)
  )
  return match ? match[0] : null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
