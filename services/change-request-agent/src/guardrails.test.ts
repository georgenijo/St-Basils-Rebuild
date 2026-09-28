import { describe, expect, it } from 'vitest'

import {
  containsSecret,
  countChangedLines,
  evaluateChangeSet,
  evaluateGuardrails,
  isAllowedPath,
  pathPolicyViolation,
  parseNumstat,
  parsePorcelainZ,
  unreferencedAttachments,
} from './guardrails'
import type { PlacedAttachment } from './types'

describe('isAllowedPath', () => {
  it.each([
    'src/app/(public)/page.tsx',
    'src/app/(public)/giving/page.tsx',
    'src/components/features/FeastFlyer.tsx',
    'public/images/requests/abcd1234/photo.jpg',
    'src/app/globals.css',
  ])('allows %s', (p) => expect(isAllowedPath(p)).toBe(true))

  it.each([
    'src/app/(admin)/admin/page.tsx',
    'src/app/api/route.ts',
    'src/lib/supabase/admin.ts',
    'src/actions/requests.ts',
    'package.json',
    '.github/workflows/ci.yml',
    'middleware.ts',
    'next.config.ts',
    'supabase/migrations/x.sql',
    'services/change-request-agent/src/job.ts',
    '.claude/settings.json',
    'public',
    'public/',
    'src/components',
    'src/app/(public)/../(admin)/page.tsx',
    '/etc/passwd',
    'src/app/globals.css.bak',
    'src/app/(public)x/page.tsx',
  ])('rejects %s', (p) => expect(isAllowedPath(p)).toBe(false))
})

describe('parsePorcelainZ', () => {
  it('parses modified, untracked, and renamed entries', () => {
    const out = [
      ' M src/components/A.tsx',
      '?? public/images/new file.png',
      'R  src/components/B.tsx',
      'src/lib/old.ts',
      '',
    ].join('\0')
    expect(parsePorcelainZ(out)).toEqual([
      { path: 'src/components/A.tsx', status: ' M' },
      { path: 'public/images/new file.png', status: '??' },
      { path: 'src/components/B.tsx', status: 'R ', origPath: 'src/lib/old.ts' },
    ])
  })

  it('returns nothing for a clean tree', () => {
    expect(parsePorcelainZ('')).toEqual([])
  })
})

describe('numstat', () => {
  it('counts text lines and ignores binaries', () => {
    const entries = parseNumstat(
      '10\t2\tsrc/components/A.tsx\n-\t-\tpublic/x.png\n3\t0\tsrc/app/globals.css\n'
    )
    expect(entries[1]).toMatchObject({ binary: true, added: 0 })
    expect(countChangedLines(entries)).toBe(15)
  })
})

describe('evaluateGuardrails', () => {
  const base = { changedLines: 10, maxDiffLines: 800, diffText: '+hello', secrets: [] as string[] }

  it('passes an allowlisted change', () => {
    expect(
      evaluateGuardrails({ ...base, files: [{ path: 'src/components/A.tsx', status: ' M' }] })
    ).toEqual({ ok: true })
  })

  it('rejects empty changes', () => {
    expect(evaluateGuardrails({ ...base, files: [] })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('did not change'),
    })
  })

  it('rejects files outside the allowlist, including rename sources', () => {
    const res = evaluateGuardrails({
      ...base,
      files: [
        { path: 'src/components/A.tsx', status: ' M' },
        { path: 'src/components/moved.ts', status: 'R ', origPath: 'src/lib/auth.ts' },
        { path: 'package.json', status: ' M' },
      ],
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.reason).toContain('package.json')
      expect(res.reason).toContain('src/lib/auth.ts')
      expect(res.reason).not.toContain('src/components/A.tsx')
    }
  })

  it('rejects huge diffs', () => {
    expect(
      evaluateGuardrails({
        ...base,
        changedLines: 801,
        files: [{ path: 'public/a.txt', status: '??' }],
      })
    ).toMatchObject({ ok: false, reason: expect.stringContaining('too large') })
  })

  it('rejects diffs containing secrets', () => {
    const secret = 'super-secret-service-role-key-value'
    expect(
      evaluateGuardrails({
        ...base,
        secrets: [secret],
        diffText: `+const k = "${secret}"`,
        files: [{ path: 'public/a.txt', status: '??' }],
      })
    ).toMatchObject({ ok: false, reason: expect.stringContaining('credential') })
  })
})

describe('containsSecret', () => {
  it('detects secret-shaped tokens', () => {
    expect(containsSecret('+ key = sk-ant-api03-abcdefghijklmnopqrstuv', [])).toBe(true)
    expect(containsSecret('+ ghp_abcdefghijklmnopqrstuvwxyz0123456789', [])).toBe(true)
    expect(containsSecret('+ <p>Hello world</p>', [])).toBe(false)
  })
})

describe('unreferencedAttachments', () => {
  const a: PlacedAttachment = {
    filename: 'Flyer.JPG',
    repoPath: 'public/images/requests/abcd1234/flyer.jpg',
    publicPath: '/images/requests/abcd1234/flyer.jpg',
    contentType: 'image/jpeg',
  }
  const b: PlacedAttachment = {
    ...a,
    filename: 'other.png',
    repoPath: 'public/images/requests/abcd1234/other.png',
    publicPath: '/images/requests/abcd1234/other.png',
  }

  it('keeps attachments referenced from changed files and drops the rest', () => {
    const contents = new Map([
      [
        'src/components/features/FeastFlyer.tsx',
        `<Image src="/images/requests/abcd1234/flyer.jpg" alt="" />`,
      ],
    ])
    expect(unreferencedAttachments([a, b], contents)).toEqual([b])
  })

  it('does not count an attachment as referencing itself', () => {
    const contents = new Map([[a.repoPath, 'binary /images/requests/abcd1234/flyer.jpg']])
    expect(unreferencedAttachments([a], contents)).toEqual([a])
  })
})

describe('pathPolicyViolation', () => {
  it.each([
    'src/components/features/FeastFlyer.tsx',
    'src/components/ui/button.ts',
    'src/app/(public)/giving/page.tsx',
    'src/app/globals.css',
    'public/images/requests/abcd1234/flyer.jpg',
    'public/docs/bulletin.pdf',
    'public/robots.txt',
    'public/icon.svg',
    'src/components/ConfigurationPanel.tsx',
  ])('allows %s', (p) => expect(pathPolicyViolation(p)).toBeNull())

  it.each([
    ['src/components/prettier.config.cjs', 'file type'],
    ['src/components/prettier.config.ts', 'configuration'],
    ['src/components/eslint.config.mjs', 'file type'],
    ['src/components/site-config.ts', 'configuration'],
    ['src/components/foo.rc.ts', 'configuration'],
    ['src/components/.prettierrc', 'hidden'],
    ['src/components/.editorconfig', 'hidden'],
    ['public/.well-known/x.txt', 'hidden'],
    ['src/components/package.json', 'file type'],
    ['public/package.json', 'file type'],
    ['src/components/tsconfig.ts', 'configuration'],
    ['src/components/types.d.ts', 'configuration'],
    ['src/components/middleware.ts', 'configuration'],
    ['src/components/next.config.ts', 'configuration'],
    ['src/components/A.js', 'file type'],
    ['src/components/A.jsx', 'file type'],
    ['src/components/data.json', 'file type'],
    ['public/script.js', 'file type'],
    ['public/page.html', 'file type'],
    ['public/Makefile', 'file type'],
    ['src/lib/x.ts', 'outside'],
    ['node_modules/prettier/index.js', 'outside'],
  ])('rejects %s (%s)', (p, why) => expect(pathPolicyViolation(p)).toContain(why))
})

describe('evaluateChangeSet', () => {
  const ok = (p: string) => ({ path: p, change: 'modified' as const, kind: 'file' as const })

  it('passes ordinary edits and deletions', () => {
    expect(
      evaluateChangeSet(
        [ok('src/components/A.tsx'), { path: 'public/old.png', change: 'deleted', kind: 'file' }],
        new Map([['src/components/A.tsx', 'export const A = 1']])
      )
    ).toEqual({ ok: true })
  })

  it('rejects empty change sets', () => {
    expect(evaluateChangeSet([], new Map())).toMatchObject({ ok: false })
  })

  it('rejects symlinks and special files even on allowed paths', () => {
    const res = evaluateChangeSet(
      [
        { path: 'src/components/link.tsx', change: 'added', kind: 'symlink' },
        { path: 'public/fifo.txt', change: 'added', kind: 'other' },
      ],
      new Map()
    )
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.reason).toContain('src/components/link.tsx (symlink)')
      expect(res.reason).toContain('public/fifo.txt (special file)')
    }
  })

  it("rejects 'use server' modules", () => {
    for (const content of [
      "'use server'\nexport async function x() {}",
      'async function a() { "use server" }',
    ]) {
      const res = evaluateChangeSet(
        [ok('src/components/actions.ts')],
        new Map([['src/components/actions.ts', content]])
      )
      expect(res).toMatchObject({ ok: false, reason: expect.stringContaining("'use server'") })
    }
  })

  it('rejects files written into node_modules or config names', () => {
    const res = evaluateChangeSet(
      [
        { path: 'node_modules/eslint/lib/api.js', change: 'added', kind: 'file' },
        { path: 'src/components/prettier.config.cjs', change: 'added', kind: 'file' },
      ],
      new Map()
    )
    expect(res.ok).toBe(false)
  })
})
