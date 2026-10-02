// Lighthouse CI budgets for .github/workflows/lighthouse.yml (#331).
//
// Category thresholds live in ./lighthouserc.json and are enforced by LHCI
// itself (median of 3 mobile runs per page). This module adds what LHCI cannot
// express: the list of audited pages, a per-image size budget, and the PR
// comment, which reads its thresholds from the same config file.
//
// Usage (from the repository root):
//   node scripts/lighthouse/budget.mjs urls <preview-url>
//     Prints one absolute URL per audited page. Only the origin of
//     <preview-url> is kept, so a query string (such as a protection-bypass
//     token) can never reach the tested URLs (#367).
//   LIGHTHOUSE_MANIFEST='<manifest json>' node scripts/lighthouse/budget.mjs check-images
//     Exits 1 if any image on an audited page is larger than IMAGE_MAX_BYTES,
//     or if an audited page has no Lighthouse result to check.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const PATHS = ['/', '/about', '/our-clergy', '/our-organizations', '/events']
export const IMAGE_MAX_BYTES = 500 * 1024
export const PERFORMANCE_TARGET = 0.8
export const CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best Practices'],
  ['seo', 'SEO'],
]

export const lighthouseConfig = JSON.parse(
  readFileSync(new URL('./lighthouserc.json', import.meta.url), 'utf8')
)

export function stripQuery(url) {
  return String(url).split(/[?#]/)[0]
}

export function buildUrls(previewUrl) {
  const { origin, protocol } = new URL(previewUrl)
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error(`Unsupported preview URL protocol: ${protocol}`)
  }
  return PATHS.map((path) => origin + path)
}

export function pathOf(url) {
  return new URL(url).pathname.replace(/(.)\/$/, '$1')
}

// Minimum category scores that apply to `url`, resolved from the config's
// assertMatrix the same way LHCI does (an entry without a pattern applies to
// every page).
/** @returns {Record<string, number>} */
export function thresholdsFor(url, config = lighthouseConfig) {
  /** @type {Record<string, number>} */
  const thresholds = {}
  for (const entry of config.ci.assert.assertMatrix) {
    if (entry.matchingUrlPattern && !new RegExp(entry.matchingUrlPattern).test(url)) continue
    for (const [id] of CATEGORIES) {
      const assertion = entry.assertions[`categories:${id}`]
      if (assertion) thresholds[id] = assertion[1].minScore
    }
  }
  return thresholds
}

export function median(values) {
  const sorted = values.filter((v) => typeof v === 'number').sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor((sorted.length - 1) / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid] + sorted[mid + 1]) / 2
}

// Images the browser downloaded that exceed the budget. Uses the larger of the
// bytes transferred and the decoded body so a cached or compressed response
// cannot hide a heavy file.
export function oversizedImages(lhr, maxBytes = IMAGE_MAX_BYTES) {
  const items = lhr.audits?.['network-requests']?.details?.items ?? []
  return items
    .filter((item) => item.resourceType === 'Image')
    .map((item) => ({
      url: item.url,
      bytes: Math.max(item.transferSize || 0, item.resourceSize || 0),
    }))
    .filter((image) => image.bytes > maxBytes)
}

// A readable, query-free label for an image URL. Next.js image-optimizer URLs
// are shown as the source image they resize.
export function displayImage(url) {
  const parsed = new URL(url)
  if (parsed.pathname === '/_next/image' && parsed.searchParams.get('url')) {
    return `${stripQuery(parsed.searchParams.get('url'))} (optimized)`
  }
  return parsed.pathname
}

// Checks every run in an LHCI manifest. Returns the budget violations and any
// audited page that has no result, both of which must fail the check.
export function checkImageBudget(manifest, readLhr = readLhrFile, maxBytes = IMAGE_MAX_BYTES) {
  const violations = new Map()
  const measured = new Set()
  for (const run of manifest) {
    const lhr = readLhr(run.jsonPath)
    const page = pathOf(lhr.finalUrl || run.url)
    measured.add(page)
    for (const image of oversizedImages(lhr, maxBytes)) {
      const label = displayImage(image.url)
      const key = `${page} ${label}`
      if ((violations.get(key)?.bytes ?? 0) < image.bytes) {
        violations.set(key, { page, image: label, bytes: image.bytes })
      }
    }
  }
  return {
    violations: [...violations.values()],
    unmeasured: PATHS.filter((path) => !measured.has(path)),
  }
}

function readLhrFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function summarize(manifest) {
  const byPage = new Map()
  for (const run of manifest) {
    const url = stripQuery(run.url)
    if (!byPage.has(url)) byPage.set(url, [])
    byPage.get(url).push(run.summary)
  }
  return [...byPage].map(([url, summaries]) => ({
    url,
    page: pathOf(url),
    thresholds: thresholdsFor(url),
    scores: Object.fromEntries(
      CATEGORIES.map(([id]) => [id, median(summaries.map((summary) => summary[id]))])
    ),
  }))
}

const kib = (bytes) => `${Math.round(bytes / 1024)} KiB`
const pct = (score) => Math.round(score * 100)

function scoreCell(score, threshold) {
  if (score === null) return 'n/a ❌'
  if (threshold === undefined) return `**${pct(score)}**`
  return `**${pct(score)}** / ${pct(threshold)} ${score >= threshold ? '✅' : '❌'}`
}

export function renderComment({ manifest, links = {}, imageBudget }) {
  const summary = summarize(manifest)
  const rows = summary.map(({ url, page, thresholds, scores }) => {
    const report = links[url] ?? links[`${url}/`]
    const label = report ? `[\`${page}\`](${report})` : `\`${page}\``
    const cells = CATEGORIES.map(([id]) => scoreCell(scores[id], thresholds[id]))
    return `| ${label} | ${cells.join(' | ')} |`
  })

  const floors = summary
    .filter(({ thresholds }) => thresholds.performance < PERFORMANCE_TARGET)
    .map(({ page }) => `\`${page}\``)

  const lines = [
    '## Lighthouse Results',
    '',
    'Median of 3 mobile runs per page; each cell is score / minimum.',
    '',
    `| Page | ${CATEGORIES.map(([, name]) => name).join(' | ')} |`,
    `|------|${CATEGORIES.map(() => '------').join('|')}|`,
    ...rows,
    '',
  ]
  if (floors.length) {
    lines.push(
      `Performance target is ${pct(PERFORMANCE_TARGET)}; ${floors.join(', ')} ` +
        'use a floor just below the measured median until they are fixed (#331).',
      ''
    )
  }
  lines.push(`### Image budget (${kib(IMAGE_MAX_BYTES)} per image)`, '')
  if (!imageBudget) {
    lines.push('Image budget was not checked.')
  } else {
    const { violations, unmeasured } = imageBudget
    if (!violations.length && !unmeasured.length) {
      lines.push('✅ No image over budget.')
    }
    for (const { page, image, bytes } of violations) {
      lines.push(`- ❌ \`${page}\` loads \`${image}\` (${kib(bytes)})`)
    }
    for (const page of unmeasured) {
      lines.push(`- ❌ \`${page}\` has no Lighthouse result`)
    }
  }
  return lines.join('\n')
}

function main([command, arg]) {
  if (command === 'urls') {
    if (!arg) throw new Error('usage: budget.mjs urls <preview-url>')
    console.log(buildUrls(arg).join('\n'))
    return 0
  }
  if (command === 'check-images') {
    const manifest = JSON.parse(process.env.LIGHTHOUSE_MANIFEST || '[]')
    if (!manifest.length) {
      console.error('No Lighthouse results to check.')
      return 1
    }
    const { violations, unmeasured } = checkImageBudget(manifest)
    for (const { page, image, bytes } of violations) {
      console.error(`${page}: ${image} is ${kib(bytes)} (budget ${kib(IMAGE_MAX_BYTES)})`)
    }
    for (const page of unmeasured) console.error(`${page}: no Lighthouse result`)
    if (violations.length || unmeasured.length) return 1
    console.log(`All images on ${PATHS.join(', ')} are within ${kib(IMAGE_MAX_BYTES)}.`)
    return 0
  }
  throw new Error(`Unknown command: ${command ?? '(none)'}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
