import type { PlacedAttachment } from './types'

export const ALLOWED_PREFIXES = ['src/app/(public)/', 'src/components/', 'public/'] as const
export const ALLOWED_FILES = ['src/app/globals.css'] as const
export const ALLOWLIST_DESCRIPTION = [
  'src/app/(public)/**',
  'src/components/**',
  'public/**',
  'src/app/globals.css',
]

/** File types the agent may create, edit or delete, by top-level area. */
export const SRC_EXTENSIONS = ['.ts', '.tsx', '.css'] as const
export const PUBLIC_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.pdf',
  '.ico',
  '.txt',
] as const
export const FILE_TYPE_DESCRIPTION = `src: ${SRC_EXTENSIONS.join(' ')}; public: ${PUBLIC_EXTENSIONS.join(' ')}`

export interface ChangedFile {
  path: string
  /** Porcelain XY status, e.g. ' M', '??', 'R ', 'D ' */
  status: string
  /** For renames/copies: the original path (also subject to the allowlist). */
  origPath?: string
}

/**
 * Parse `git status --porcelain=v1 -z --untracked-files=all`. With -z paths
 * are never quoted; renames are `XY new\0old\0`.
 */
export function parsePorcelainZ(output: string): ChangedFile[] {
  const tokens = output.split('\0')
  const files: ChangedFile[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (!token) continue
    const status = token.slice(0, 2)
    const filePath = token.slice(3)
    if (status[0] === 'R' || status[0] === 'C') {
      const origPath = tokens[i + 1]
      i++
      files.push({ path: filePath, status, origPath })
    } else {
      files.push({ path: filePath, status })
    }
  }
  return files
}

export function isAllowedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  if (normalized.startsWith('/') || normalized.split('/').some((part) => part === '..')) {
    return false
  }
  if ((ALLOWED_FILES as readonly string[]).includes(normalized)) return true
  return ALLOWED_PREFIXES.some(
    (prefix) => normalized.startsWith(prefix) && normalized.length > prefix.length
  )
}

const CONFIG_LIKE = /(^|[.-])(config|rc)([.-]|$)/i

/**
 * Why a path may not be changed by the agent, or null when it may. Covers the
 * area allowlist, allowed file types, and names that tooling (Prettier,
 * ESLint, TypeScript, Next.js) could pick up as configuration or code.
 */
export function pathPolicyViolation(filePath: string): string | null {
  if (!isAllowedPath(filePath)) return 'outside the allowed areas'
  const segments = filePath.split('/')
  if (segments.some((segment) => segment === '' || segment.startsWith('.'))) {
    return 'hidden file or directory'
  }
  const base = segments[segments.length - 1]
  const lower = base.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot) : ''
  const allowedExt: readonly string[] = filePath.startsWith('public/')
    ? PUBLIC_EXTENSIONS
    : SRC_EXTENSIONS
  if (!allowedExt.includes(ext)) return `file type not allowed (${ext || 'no extension'})`
  if (
    CONFIG_LIKE.test(base) ||
    lower === 'package.json' ||
    lower.startsWith('tsconfig') ||
    lower.endsWith('.d.ts') ||
    lower.startsWith('middleware.') ||
    lower.startsWith('next.config.')
  ) {
    return 'configuration-like file name'
  }
  return null
}

/** A `'use server'` directive turns a module into server actions; never allowed. */
export function hasUseServerDirective(content: string): boolean {
  return /['"]use server['"]/.test(content)
}

export type EntryKind = 'file' | 'symlink' | 'other'

export interface TreeChange {
  path: string
  change: 'added' | 'modified' | 'deleted'
  /** Kind of the entry after the change (for deletions: before). */
  kind: EntryKind
}

export type GuardrailResult = { ok: true } | { ok: false; reason: string }

function reject(problems: string[]): GuardrailResult {
  return {
    ok: false,
    reason: `The change touched files the worker may not submit (allowed: ${ALLOWLIST_DESCRIPTION.join(', ')}; ${FILE_TYPE_DESCRIPTION}): ${problems.sort().join('; ')}`,
  }
}

/**
 * Validate the agent's change set (computed from its sandbox checkout) before
 * any of it is copied into the trusted checkout where tooling runs.
 * `contents` holds the new text of added/modified .ts/.tsx files.
 */
export function evaluateChangeSet(
  changes: TreeChange[],
  contents: Map<string, string>
): GuardrailResult {
  if (changes.length === 0) return { ok: false, reason: 'The agent did not change any files.' }
  const problems: string[] = []
  for (const change of changes) {
    if (change.kind !== 'file') {
      problems.push(`${change.path} (${change.kind === 'symlink' ? 'symlink' : 'special file'})`)
      continue
    }
    const violation = pathPolicyViolation(change.path)
    if (violation) {
      problems.push(`${change.path} (${violation})`)
      continue
    }
    const content = contents.get(change.path)
    if (change.change !== 'deleted' && content !== undefined && hasUseServerDirective(content)) {
      problems.push(`${change.path} ('use server' directive)`)
    }
  }
  return problems.length ? reject(problems) : { ok: true }
}

export interface NumstatEntry {
  path: string
  added: number
  deleted: number
  binary: boolean
}

/** Parse `git diff --cached --numstat` output. Binary files show `-\t-\tpath`. */
export function parseNumstat(output: string): NumstatEntry[] {
  return output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [added, deleted, ...rest] = line.split('\t')
      const binary = added === '-' && deleted === '-'
      return {
        path: rest.join('\t'),
        added: binary ? 0 : Number.parseInt(added, 10) || 0,
        deleted: binary ? 0 : Number.parseInt(deleted, 10) || 0,
        binary,
      }
    })
}

export function countChangedLines(entries: NumstatEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.binary ? 0 : entry.added + entry.deleted), 0)
}

/**
 * Attachments the agent did not reference from any other changed file. They
 * are removed before anything is submitted so unrelated uploads never land in
 * the repo.
 */
export function unreferencedAttachments(
  attachments: PlacedAttachment[],
  changedFileContents: Map<string, string>
): PlacedAttachment[] {
  const attachmentPaths = new Set(attachments.map((a) => a.repoPath))
  const texts = [...changedFileContents.entries()]
    .filter(([filePath]) => !attachmentPaths.has(filePath))
    .map(([, content]) => content)
  return attachments.filter(
    (attachment) =>
      !texts.some(
        (text) =>
          text.includes(attachment.publicPath) ||
          text.includes(attachment.repoPath) ||
          text.includes(attachment.publicPath.split('/').pop() ?? '\0')
      )
  )
}

/** Detection only (non-global); replacement patterns live in redact.ts. */
export const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{16,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/,
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]

/** True when the diff text contains a known secret value or a secret-shaped token. */
export function containsSecret(diffText: string, secrets: string[]): boolean {
  if (secrets.some((secret) => secret.length >= 12 && diffText.includes(secret))) return true
  return SECRET_PATTERNS.some((pattern) => pattern.test(diffText))
}

export interface GuardrailInput {
  files: ChangedFile[]
  changedLines: number
  maxDiffLines: number
  diffText: string
  secrets: string[]
}

/**
 * Final check on exactly what is staged in the trusted checkout (after
 * formatting): path policy, size, and secrets.
 */
export function evaluateGuardrails(input: GuardrailInput): GuardrailResult {
  if (input.files.length === 0) {
    return { ok: false, reason: 'The agent did not change any files.' }
  }
  const problems: string[] = []
  for (const file of input.files) {
    for (const p of [file.path, file.origPath]) {
      if (!p) continue
      const violation = pathPolicyViolation(p)
      if (violation) problems.push(`${p} (${violation})`)
    }
  }
  if (problems.length > 0) return reject([...new Set(problems)])
  if (input.changedLines > input.maxDiffLines) {
    return {
      ok: false,
      reason: `The change is too large to open automatically (${input.changedLines} changed lines; limit ${input.maxDiffLines}).`,
    }
  }
  if (containsSecret(input.diffText, input.secrets)) {
    return { ok: false, reason: 'The change appears to contain a credential or secret value.' }
  }
  return { ok: true }
}
