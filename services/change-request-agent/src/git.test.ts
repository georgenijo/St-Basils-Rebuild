import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Config } from './config'
import { branchDiffNumstat, prepareRevisionBranch } from './git'

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
