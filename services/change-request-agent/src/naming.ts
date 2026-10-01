export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toLowerCase()
}

/** Lowercase ASCII slug: letters, digits and single dashes. */
export function slugify(input: string, maxLength = 40): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const trimmed = slug.slice(0, maxLength).replace(/-+$/g, '')
  return trimmed
}

export function branchName(id: string, title: string): string {
  const slug = slugify(title) || 'request'
  return `change-request/${shortId(id)}-${slug}`
}

/**
 * Filename safe to place in a git checkout and a URL: no directories, no
 * leading dots, only [a-z0-9._-], extension preserved, bounded length.
 */
export function safeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? ''
  const match = /^(.*?)(\.[A-Za-z0-9]{1,8})?$/.exec(base)
  const stem = slugify(match?.[1] ?? '', 60) || 'file'
  const ext = (match?.[2] ?? '').toLowerCase()
  return `${stem}${ext}`
}

/** Storage attachment objects are named `<uuid>-<safe filename>`; strip the uuid. */
export function attachmentDisplayName(storagePath: string, filename: string | null): string {
  if (filename) return filename
  const base = storagePath.split('/').pop() ?? storagePath
  return base.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '')
}

export function labelSlug(label: string): string {
  return slugify(label, 80) || 'screenshot'
}
