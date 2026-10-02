import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  BASELINE_MEDIANS,
  CATEGORY_TARGETS,
  IMAGE_MAX_BYTES,
  PATHS,
  PERFORMANCE_TARGET,
  buildUrls,
  checkImageBudget,
  displayImage,
  lighthouseConfig,
  oversizedImages,
  renderComment,
  thresholdsFor,
} from '../../scripts/lighthouse/budget.mjs'

const PREVIEW = 'https://st-basils-rebuild-abc123-george-nijos-projects.vercel.app'
const SCRIPT = fileURLToPath(new URL('../../scripts/lighthouse/budget.mjs', import.meta.url))

type NetworkItem = {
  url: string
  resourceType: string
  transferSize?: number
  resourceSize?: number
}

function lhr(path: string, items: NetworkItem[]) {
  return {
    finalUrl: PREVIEW + path,
    audits: { 'network-requests': { details: { items } } },
  }
}

function image(path: string, bytes: number): NetworkItem {
  return { url: PREVIEW + path, resourceType: 'Image', transferSize: bytes, resourceSize: bytes }
}

// One run per audited page; `extra` adds network requests to a single page.
function runsFor(extra: Record<string, NetworkItem[]> = {}) {
  const lhrs = Object.fromEntries(PATHS.map((path) => [path, lhr(path, extra[path] ?? [])]))
  const manifest = PATHS.map((path) => ({
    url: PREVIEW + path,
    jsonPath: path,
    summary: { performance: 0.9, accessibility: 1, 'best-practices': 1, seo: 1 },
  }))
  return { manifest, readLhr: (jsonPath: string) => lhrs[jsonPath] }
}

describe('audited pages', () => {
  it('covers the pages named in #331', () => {
    expect(PATHS).toEqual(
      expect.arrayContaining(['/', '/about', '/our-clergy', '/our-organizations', '/events'])
    )
  })

  it('keeps only the preview origin so no query string or bypass token is tested (#367)', () => {
    const urls = buildUrls(`${PREVIEW}/somewhere?x-vercel-protection-bypass=secret#frag`)
    expect(urls).toEqual(PATHS.map((path) => PREVIEW + path))
    for (const url of urls) expect(url).not.toMatch(/[?#]|secret|bypass/)
  })

  it('rejects non-web preview URLs', () => {
    expect(() => buildUrls('file:///etc/passwd')).toThrow(/protocol/)
  })
})

describe('Lighthouse thresholds', () => {
  const matrix = lighthouseConfig.ci.assert.assertMatrix as {
    matchingUrlPattern?: string
    aggregationMethod?: string
    assertions: Record<string, [string, { minScore: number }]>
  }[]

  it('collects 3 mobile runs with every audit scored as-is', () => {
    const { collect } = lighthouseConfig.ci
    expect(collect.numberOfRuns).toBe(3)
    expect(collect.settings).toBeUndefined()
  })

  it('asserts the median run, not the best run, and fails the job', () => {
    for (const entry of matrix) {
      expect(entry.aggregationMethod).toBe('median')
      for (const [level] of Object.values(entry.assertions)) expect(level).toBe('error')
    }
  })

  it.each(PATHS)('enforces every category on %s', (path) => {
    const url = PREVIEW + path
    const thresholds = thresholdsFor(url)
    // Each category asserts its target, or exactly 0.01 below the documented
    // baseline median when today's median misses it. Never lower.
    const floor = (target: number, median: number) =>
      median >= target ? target : Math.round((median - 0.01) * 100) / 100
    const performance =
      BASELINE_MEDIANS.performance[path as keyof typeof BASELINE_MEDIANS.performance]
    expect(thresholds.performance).toBe(floor(PERFORMANCE_TARGET, performance))
    for (const [id, target] of Object.entries(CATEGORY_TARGETS)) {
      const median = BASELINE_MEDIANS[id as keyof typeof CATEGORY_TARGETS]
      expect(thresholds[id]).toBe(floor(target, median))
    }

    const performanceEntries = matrix.filter(
      (entry) =>
        entry.assertions['categories:performance'] &&
        (!entry.matchingUrlPattern || new RegExp(entry.matchingUrlPattern).test(url))
    )
    expect(performanceEntries).toHaveLength(1)
    // LHCI matches the final URL, which may gain a trailing slash.
    const withSlash = url.replace(/\/?$/, '/')
    expect(new RegExp(performanceEntries[0].matchingUrlPattern!).test(withSlash)).toBe(true)
  })
})

describe('image budget', () => {
  it('flags images over 500 KiB and ignores other resource types', () => {
    const page = lhr('/our-clergy', [
      image('/images/about/church-exterior.jpg', 4_002_818),
      image('/images/small.jpg', 300 * 1024),
      { url: `${PREVIEW}/_next/static/chunk.js`, resourceType: 'Script', transferSize: 2e6 },
      { url: `${PREVIEW}/video/intro.mp4`, resourceType: 'Media', transferSize: 1.1e6 },
    ])
    expect(oversizedImages(page)).toEqual([
      { url: `${PREVIEW}/images/about/church-exterior.jpg`, bytes: 4_002_818 },
    ])
  })

  it('allows exactly the budget and fails one byte over', () => {
    expect(oversizedImages(lhr('/', [image('/a.jpg', IMAGE_MAX_BYTES)]))).toEqual([])
    expect(oversizedImages(lhr('/', [image('/a.jpg', IMAGE_MAX_BYTES + 1)]))).toHaveLength(1)
  })

  it('uses the decoded size when little was transferred', () => {
    const cached = { ...image('/a.jpg', 0), resourceSize: 900 * 1024 }
    expect(oversizedImages(lhr('/', [cached]))).toHaveLength(1)
  })

  it('labels optimizer URLs by their source image without query strings', () => {
    expect(
      displayImage(`${PREVIEW}/_next/image?url=%2Fimages%2Fhero.jpg%3Fv%3D1&w=3840&q=75`)
    ).toBe('/images/hero.jpg (optimized)')
    expect(displayImage(`${PREVIEW}/images/a.jpg?token=secret`)).toBe('/images/a.jpg')
  })

  it('reports each oversized image once per page across runs', () => {
    const { manifest, readLhr } = runsFor({
      '/our-clergy': [image('/images/about/church-exterior.jpg', 4_002_818)],
    })
    const result = checkImageBudget([...manifest, ...manifest], readLhr)
    expect(result).toEqual({
      violations: [
        { page: '/our-clergy', image: '/images/about/church-exterior.jpg', bytes: 4_002_818 },
      ],
      unmeasured: [],
    })
  })

  it('fails pages that have no Lighthouse result', () => {
    const { manifest, readLhr } = runsFor()
    const result = checkImageBudget(manifest.slice(1), readLhr)
    expect(result.unmeasured).toEqual(['/'])
  })
})

describe('check-images command', () => {
  function run(extra: Record<string, NetworkItem[]>) {
    const dir = mkdtempSync(join(tmpdir(), 'lighthouse-budget-'))
    const { manifest, readLhr } = runsFor(extra)
    const onDisk = manifest.map((entry) => {
      const jsonPath = join(dir, `${PATHS.indexOf(entry.jsonPath)}.json`)
      writeFileSync(jsonPath, JSON.stringify(readLhr(entry.jsonPath)))
      return { ...entry, jsonPath }
    })
    return spawnSync(process.execPath, [SCRIPT, 'check-images'], {
      env: { ...process.env, LIGHTHOUSE_MANIFEST: JSON.stringify(onDisk) },
      encoding: 'utf8',
    })
  }

  it('exits 1 and names the image when a page loads an oversized image', () => {
    const result = run({ '/our-clergy': [image('/images/about/church-exterior.jpg', 4_002_818)] })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('/our-clergy: /images/about/church-exterior.jpg is 3909 KiB')
  })

  it('exits 0 when every image is within budget', () => {
    const result = run({ '/': [image('/images/hero.webp', 200 * 1024)] })
    expect(result.status).toBe(0)
  })

  it('exits 1 when there are no results to check', () => {
    const result = spawnSync(process.execPath, [SCRIPT, 'check-images'], {
      env: { ...process.env, LIGHTHOUSE_MANIFEST: '[]' },
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
  })
})

describe('PR comment', () => {
  it('shows median scores against each page threshold and never echoes a query string', () => {
    const { manifest, readLhr } = runsFor({
      '/our-clergy': [image('/images/about/church-exterior.jpg', 4_002_818)],
    })
    const scores = [0.52, 0.64, 0.95]
    const homeRuns = scores.map((performance) => ({
      ...manifest[0],
      url: `${PREVIEW}/?x-vercel-protection-bypass=secret`,
      summary: { ...manifest[0].summary, performance },
    }))
    const body = renderComment({
      manifest: [...homeRuns, ...manifest.slice(1)],
      links: { [`${PREVIEW}/about`]: 'https://storage.googleapis.com/report.html' },
      imageBudget: checkImageBudget(manifest, readLhr),
    })

    expect(body).not.toMatch(/secret|bypass/)
    // Median of 52/64/95 is 64, below the floor for `/`: the best run (95) must not win.
    expect(body).toMatch(/\| `\/` \| \*\*64\*\* \/ 74 ❌ \|/)
    expect(body).toContain(
      '| [`/about`](https://storage.googleapis.com/report.html) | **90** / 80 ✅'
    )
    expect(body).toContain('`/our-clergy` loads `/images/about/church-exterior.jpg` (3909 KiB)')
  })

  it('passes the raw preview SEO score of 66 and explains the noindex', () => {
    const { manifest } = runsFor()
    const preview = manifest.map((run) => ({ ...run, summary: { ...run.summary, seo: 0.66 } }))
    const body = renderComment({ manifest: preview, imageBudget: undefined })
    expect(body).toMatch(/\| \*\*66\*\* \/ 65 ✅ \|$/m)
    expect(body).toContain('`x-robots-tag: noindex` fails `is-crawlable`')
  })

  it('says so when every image is within budget', () => {
    const { manifest, readLhr } = runsFor()
    const body = renderComment({ manifest, imageBudget: checkImageBudget(manifest, readLhr) })
    expect(body).toContain('No image over budget')
  })
})
