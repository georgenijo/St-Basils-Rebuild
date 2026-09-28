import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { Config } from './config'
import { childEnv, runChecked } from './exec'
import { parseNumstat, parsePorcelainZ, type ChangedFile, type NumstatEntry } from './guardrails'
import { log } from './log'

const LOCK_MARKER = path.join('node_modules', '.change-request-agent-lock-sha256')

function gitEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return childEnv({ GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', ...extra })
}

/** Auth header for github.com passed via env (never argv, never .git/config). */
function gitAuthEnv(token: string | null): Record<string, string> {
  if (!token) return {}
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  }
}

export async function git(
  repoDir: string,
  args: string[],
  options: { timeoutMs?: number; env?: Record<string, string> } = {}
): Promise<string> {
  const result = await runChecked('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: repoDir,
    env: gitEnv(options.env),
    timeoutMs: options.timeoutMs ?? 5 * 60_000,
  })
  return result.stdout
}

export async function ensureClone(config: Config): Promise<void> {
  if (existsSync(path.join(config.workDir, '.git'))) {
    await git(config.workDir, ['remote', 'set-url', 'origin', config.repoUrl])
    return
  }
  await fs.mkdir(path.dirname(config.workDir), { recursive: true })
  log.info('cloning repository', { repoUrl: config.repoUrl, workDir: config.workDir })
  await runChecked(
    'git',
    ['clone', '--no-tags', '--branch', config.baseBranch, config.repoUrl, config.workDir],
    { env: gitEnv(gitAuthEnv(config.githubToken)), timeoutMs: 15 * 60_000 }
  )
}

/**
 * Fresh working branch from origin/<base>. Everything untracked or ignored is
 * removed except node_modules (reused between jobs).
 */
export async function prepareBranch(config: Config, branch: string): Promise<string> {
  const dir = config.workDir
  await git(
    dir,
    [
      'fetch',
      '--no-tags',
      '--prune',
      'origin',
      `+refs/heads/${config.baseBranch}:refs/remotes/origin/${config.baseBranch}`,
    ],
    {
      env: gitAuthEnv(config.githubToken),
    }
  )
  await git(dir, ['reset', '--hard'])
  await git(dir, ['clean', '-ffdx', '-e', '/node_modules'])
  await git(dir, ['checkout', '--force', '-B', branch, `origin/${config.baseBranch}`])
  await git(dir, ['clean', '-ffdx', '-e', '/node_modules'])
  return (await git(dir, ['rev-parse', 'HEAD'])).trim()
}

export async function ensureDependencies(config: Config): Promise<void> {
  const dir = config.workDir
  const lock = await fs.readFile(path.join(dir, 'package-lock.json'))
  const sha = createHash('sha256').update(lock).digest('hex')
  const markerPath = path.join(dir, LOCK_MARKER)
  const previous = existsSync(markerPath) ? (await fs.readFile(markerPath, 'utf8')).trim() : null
  if (previous === sha) return
  log.info('installing website dependencies (npm ci)', {
    reason: previous ? 'lockfile changed' : 'first install',
  })
  await runChecked('npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], {
    cwd: dir,
    env: childEnv({ CI: '1', HUSKY: '0' }),
    timeoutMs: config.npmCiTimeoutMs,
  })
  await fs.writeFile(markerPath, `${sha}\n`)
}

export async function changedFiles(dir: string): Promise<ChangedFile[]> {
  const out = await git(dir, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  return parsePorcelainZ(out)
}

export interface StagedDiff {
  numstat: NumstatEntry[]
  patch: string
}

export async function stageAll(dir: string): Promise<StagedDiff> {
  await git(dir, ['add', '-A'])
  const numstat = parseNumstat(await git(dir, ['diff', '--cached', '--numstat', '--no-renames']))
  const patch = await git(dir, ['diff', '--cached', '--no-renames', '--no-color'])
  return { numstat, patch }
}

export async function commit(config: Config, message: string): Promise<string> {
  const dir = config.workDir
  await git(
    dir,
    [
      '-c',
      `user.name=${config.gitName}`,
      '-c',
      `user.email=${config.gitEmail}`,
      'commit',
      '--no-verify',
      '-m',
      message,
    ],
    {
      env: {
        GIT_AUTHOR_NAME: config.gitName,
        GIT_AUTHOR_EMAIL: config.gitEmail,
        GIT_COMMITTER_NAME: config.gitName,
        GIT_COMMITTER_EMAIL: config.gitEmail,
      },
    }
  )
  return (await git(dir, ['rev-parse', 'HEAD'])).trim()
}

/** Force-push: change-request/* branches are owned by the worker and rebuilt from main on every run. */
export async function pushBranch(config: Config, branch: string): Promise<void> {
  if (!config.githubToken) throw new Error('GITHUB_TOKEN is required to push')
  await git(config.workDir, ['push', '--force', 'origin', `HEAD:refs/heads/${branch}`], {
    env: gitAuthEnv(config.githubToken),
    timeoutMs: 5 * 60_000,
  })
}
