import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Config } from './config'
import {
  branchDiffNumstat,
  prepareRevisionBranch,
  revertMergedPull,
  stagedTreeChanges,
} from './git'

// Real git against a local bare "origin": exercises the exact commands the
// worker runs when it revises a verified change on its existing branch.
const BRANCH = 'change-request/abcd1234-website-update'

function sh(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'T',
      GIT_AUTHOR_EMAIL: 't@example.org',
      GIT_COMMITTER_NAME: 'T',
      GIT_COMMITTER_EMAIL: 't@example.org',
    },
  }).trim()
}

async function commitFile(dir: string, file: string, text: string): Promise<string> {
  await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true })
  await fs.writeFile(path.join(dir, file), text)
  sh(dir, 'add', '-A')
  sh(dir, 'commit', '-q', '-m', `edit ${file}`)
  return sh(dir, 'rev-parse', 'HEAD')
}

let root: string
let seed: string
let config: Config
let verified: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cra-git-'))
  const origin = path.join(root, 'origin.git')
  seed = path.join(root, 'seed')
  sh(root, 'init', '-q', '--bare', '-b', 'main', origin)
  sh(root, 'clone', '-q', origin, seed)
  sh(seed, 'checkout', '-q', '-b', 'main')
  await commitFile(seed, 'src/app/(public)/page.tsx', 'home\n')
  sh(seed, 'push', '-q', 'origin', 'main')
  sh(seed, 'checkout', '-q', '-b', BRANCH)
  verified = await commitFile(seed, 'src/app/(public)/page.tsx', 'home, changed\n')
  // A later (failed) revision that must not survive the next attempt.
  await commitFile(seed, 'src/components/Broken.tsx', 'broken\n')
  sh(seed, 'push', '-q', 'origin', BRANCH)

  const workDir = path.join(root, 'work')
  sh(root, 'clone', '-q', '--branch', 'main', origin, workDir)
  config = { workDir, baseBranch: 'main', githubToken: null } as unknown as Config
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('prepareRevisionBranch', () => {
  it('checks the branch out at the verified commit, dropping anything pushed after it', async () => {
    const head = await prepareRevisionBranch(config, BRANCH, verified)
    expect(head).toBe(verified)
    expect(sh(config.workDir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(BRANCH)
    const page = await fs.readFile(path.join(config.workDir, 'src/app/(public)/page.tsx'), 'utf8')
    expect(page).toBe('home, changed\n')
    await expect(fs.stat(path.join(config.workDir, 'src/components/Broken.tsx'))).rejects.toThrow()

    const diff = await branchDiffNumstat(config)
    expect(diff).toEqual([
      { path: 'src/app/(public)/page.tsx', added: 1, deleted: 1, binary: false },
    ])
  })

  it('returns null for a commit that is not on the remote branch', async () => {
    sh(seed, 'checkout', '-q', 'main')
    const elsewhere = await commitFile(seed, 'public/other.txt', 'x\n')
    sh(seed, 'push', '-q', 'origin', 'main')
    expect(await prepareRevisionBranch(config, BRANCH, elsewhere)).toBeNull()
  })

  it('returns null when the branch no longer exists', async () => {
    sh(seed, 'push', '-q', 'origin', '--delete', BRANCH)
    expect(await prepareRevisionBranch(config, BRANCH, verified)).toBeNull()
  })

  it('throws instead of reporting the commit missing when the remote cannot be reached', async () => {
    sh(config.workDir, 'remote', 'set-url', 'origin', path.join(root, 'missing.git'))
    await expect(prepareRevisionBranch(config, BRANCH, verified)).rejects.toThrow()
  })

  it('rejects anything that is not a full commit id without running git', async () => {
    expect(await prepareRevisionBranch(config, BRANCH, '--upload-pack=evil')).toBeNull()
    expect(await prepareRevisionBranch(config, BRANCH, verified.slice(0, 7))).toBeNull()
  })
})

describe('revertMergedPull (undo)', () => {
  // A two-commit PR: adds a note component, then changes the home text.
  async function openPull(): Promise<string> {
    sh(seed, 'checkout', '-q', 'main')
    sh(seed, 'checkout', '-q', '-b', 'pr-branch')
    await commitFile(seed, 'src/components/Note.tsx', 'note\n')
    const head = await commitFile(seed, 'src/app/(public)/page.tsx', 'home, revised\n')
    sh(seed, 'push', '-q', 'origin', `${head}:refs/pull/7/head`)
    sh(seed, 'checkout', '-q', 'main')
    return head
  }

  function squashMerge(): string {
    sh(seed, 'merge', '-q', '--squash', 'pr-branch')
    sh(seed, 'commit', '-q', '-m', 'squash (#7)')
    return sh(seed, 'rev-parse', 'HEAD')
  }

  async function workOnMain(): Promise<void> {
    sh(seed, 'push', '-q', 'origin', 'main')
    sh(config.workDir, 'fetch', '-q', 'origin')
    sh(config.workDir, 'checkout', '-q', '-B', 'main', 'origin/main')
  }

  async function readWork(file: string): Promise<string | null> {
    return fs.readFile(path.join(config.workDir, file), 'utf8').catch(() => null)
  }

  it('undoes a squash merge completely', async () => {
    await openPull()
    const merge = squashMerge()
    await workOnMain()

    expect(await revertMergedPull(config, 7, merge, 2)).toBe('applied')
    expect(await readWork('src/components/Note.tsx')).toBeNull()
    expect(await readWork('src/app/(public)/page.tsx')).toBe('home\n')
    expect(await stagedTreeChanges(config.workDir)).toEqual([
      { path: 'src/app/(public)/page.tsx', change: 'modified', kind: 'file' },
      { path: 'src/components/Note.tsx', change: 'deleted', kind: 'file' },
    ])
  })

  it('undoes every commit of a rebase-and-merge, and nothing else', async () => {
    await openPull()
    // Like GitHub: main moved on, and the PR's commits are replayed as new commits.
    await commitFile(seed, 'public/other.txt', 'unrelated\n')
    sh(seed, 'rebase', '-q', 'main', 'pr-branch')
    const merge = sh(seed, 'rev-parse', 'pr-branch')
    sh(seed, 'checkout', '-q', 'main')
    sh(seed, 'merge', '-q', '--ff-only', merge)
    await workOnMain()

    expect(await revertMergedPull(config, 7, merge, 2)).toBe('applied')
    expect(await readWork('src/components/Note.tsx')).toBeNull()
    expect(await readWork('src/app/(public)/page.tsx')).toBe('home\n')
    expect(await readWork('public/other.txt')).toBe('unrelated\n')
  })

  it('undoes every commit of a fast-forwarded PR', async () => {
    const head = await openPull()
    sh(seed, 'merge', '-q', '--ff-only', head)
    await workOnMain()

    expect(await revertMergedPull(config, 7, head, 2)).toBe('applied')
    expect(await readWork('src/components/Note.tsx')).toBeNull()
    expect(await readWork('src/app/(public)/page.tsx')).toBe('home\n')
  })

  it("keeps a change another PR had already published (only the merge's own delta)", async () => {
    await openPull()
    // Another PR lands the same home text change first.
    await commitFile(seed, 'src/app/(public)/page.tsx', 'home, revised\n')
    const merge = squashMerge() // so this squash only adds the note
    await workOnMain()

    expect(await revertMergedPull(config, 7, merge, 2)).toBe('applied')
    expect(await readWork('src/components/Note.tsx')).toBeNull()
    expect(await readWork('src/app/(public)/page.tsx')).toBe('home, revised\n')
  })

  it('follows a later rename of a file the PR edited', async () => {
    await openPull()
    const merge = squashMerge()
    sh(seed, 'mv', 'src/app/(public)/page.tsx', 'src/app/(public)/home.tsx')
    sh(seed, 'commit', '-q', '-m', 'rename the home page file')
    await workOnMain()

    // The edit is undone in the renamed file, and the rename is kept.
    expect(await revertMergedPull(config, 7, merge, 2)).toBe('applied')
    expect(await readWork('src/app/(public)/home.tsx')).toBe('home\n')
    expect(await readWork('src/app/(public)/page.tsx')).toBeNull()
    expect(await readWork('src/components/Note.tsx')).toBeNull()
  })

  it('reports a conflict when a later change touched the same lines, leaving no half-done revert', async () => {
    await openPull()
    const merge = squashMerge()
    await commitFile(seed, 'src/app/(public)/page.tsx', 'home, edited again later\n')
    await workOnMain()

    expect(await revertMergedPull(config, 7, merge, 2)).toBe('conflict')
    expect(sh(config.workDir, 'status', '--porcelain')).toBe('')
  })
})
