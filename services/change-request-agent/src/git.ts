import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { Config } from './config'
import { childEnv, ExecError, runChecked } from './exec'
import {
  parseNumstat,
  parsePorcelainZ,
  type ChangedFile,
  type NumstatEntry,
  type TreeChange,
} from './guardrails'
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

const FULL_SHA = /^[0-9a-f]{40}$/

/** Exit code of a git command whose non-zero codes are answers, not failures. */
async function gitExitCode(
  repoDir: string,
  args: string[],
  env: Record<string, string> = {}
): Promise<number> {
  try {
    await git(repoDir, args, { env, timeoutMs: 2 * 60_000 })
    return 0
  } catch (error) {
    const code = error instanceof ExecError && !error.result.timedOut ? error.result.code : null
    if (code === null) throw error
    return code
  }
}

/**
 * Revision of an already verified change: check out `branch` at `baseSha`
 * (the commit the admin saw verified) so the agent edits on top of it, and
 * anything pushed after it (e.g. a failed earlier revision) is dropped by the
 * next force-push. Returns null only when it is established that the commit
 * is not on the remote branch any more (branch deleted or rewritten); the
 * caller then rebuilds from base. Network, auth and other git failures throw,
 * so a transient error never replaces the reviewed change with a rebuild.
 */
export async function prepareRevisionBranch(
  config: Config,
  branch: string,
  baseSha: string
): Promise<string | null> {
  if (!FULL_SHA.test(baseSha)) return null
  const dir = config.workDir
  const auth = gitAuthEnv(config.githubToken)
  const remoteRef = `refs/remotes/origin/${branch}`
  await git(
    dir,
    [
      'fetch',
      '--no-tags',
      '--prune',
      'origin',
      `+refs/heads/${config.baseBranch}:refs/remotes/origin/${config.baseBranch}`,
    ],
    { env: auth }
  )
  // --exit-code: 2 means the ref does not exist; anything else non-zero is a failure.
  const listed = await gitExitCode(
    dir,
    ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`],
    auth
  )
  if (listed === 2) {
    log.warn('revision branch no longer exists', { branch })
    return null
  }
  if (listed !== 0) throw new Error(`Checking remote branch ${branch} failed (git exit ${listed})`)
  await git(dir, ['fetch', '--no-tags', 'origin', `+refs/heads/${branch}:${remoteRef}`], {
    env: auth,
  })
  // --verify --quiet: 1 means the commit is not in the fetched history at all.
  const known = await gitExitCode(dir, ['rev-parse', '--verify', '--quiet', `${baseSha}^{commit}`])
  if (known !== 0 && known !== 1) {
    throw new Error(`Looking up commit ${baseSha.slice(0, 7)} failed (git exit ${known})`)
  }
  const onBranch =
    known === 0 ? await gitExitCode(dir, ['merge-base', '--is-ancestor', baseSha, remoteRef]) : 1
  if (onBranch === 1) {
    log.warn('verified revision base is not on the remote branch', { branch, baseSha })
    return null
  }
  if (onBranch !== 0)
    throw new Error(`Checking commit ${baseSha.slice(0, 7)} failed (git exit ${onBranch})`)
  await git(dir, ['reset', '--hard'])
  await git(dir, ['clean', '-ffdx', '-e', '/node_modules'])
  await git(dir, ['checkout', '--force', '-B', branch, baseSha])
  await git(dir, ['clean', '-ffdx', '-e', '/node_modules'])
  return (await git(dir, ['rev-parse', 'HEAD'])).trim()
}

/** Everything the branch changes relative to the base branch (what the PR shows). */
export async function branchDiffNumstat(config: Config): Promise<NumstatEntry[]> {
  return parseNumstat(
    await git(config.workDir, [
      'diff',
      '--numstat',
      '--no-renames',
      `refs/remotes/origin/${config.baseBranch}...HEAD`,
    ])
  )
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

/**
 * Force-push: change-request/* branches are owned by the worker and rebuilt on every run, from main
 * or, for a requested revision, from the verified commit (see prepareRevisionBranch).
 */
export async function pushBranch(config: Config, branch: string): Promise<void> {
  if (!config.githubToken) throw new Error('GITHUB_TOKEN is required to push')
  await git(config.workDir, ['push', '--force', 'origin', `HEAD:refs/heads/${branch}`], {
    env: gitAuthEnv(config.githubToken),
    timeoutMs: 5 * 60_000,
  })
}

/** `git patch-id --stable` of a commit's own change (same id for a rebased copy). */
async function commitPatchId(dir: string, sha: string): Promise<string> {
  const diff = await git(dir, ['show', '--no-color', '--format=', sha])
  const result = await runChecked('git', ['patch-id', '--stable'], {
    cwd: dir,
    env: gitEnv(),
    input: diff,
    timeoutMs: 60_000,
  })
  return result.stdout.trim().split(/\s+/)[0] ?? ''
}

/**
 * Whether main integrated the PR's commits one by one (GitHub rebase-and-merge
 * or a fast-forward): the last `count` first-parent commits ending at
 * `mergeSha` carry the same changes, in order, as the PR's last `count`.
 */
async function integratedCommitByCommit(
  dir: string,
  mergeSha: string,
  prRef: string,
  count: number
): Promise<boolean> {
  const list = async (ref: string) =>
    (await git(dir, ['rev-list', '--reverse', '--first-parent', '-n', String(count), ref]))
      .split('\n')
      .filter(Boolean)
  const [onMain, inPull] = [await list(mergeSha), await list(prRef)]
  if (onMain.length !== count || inPull.length !== count) return false
  for (let i = 0; i < count; i++) {
    if ((await commitPatchId(dir, onMain[i])) !== (await commitPatchId(dir, inPull[i])))
      return false
  }
  return true
}

/**
 * Undo (#363): revert exactly what main integrated from a merged pull request
 * in the working tree and index, with git's tree-level (rename-aware)
 * three-way revert. A merge commit is reverted against main (`-m 1`); a PR
 * integrated commit by commit (rebase-and-merge or fast-forward) has all of
 * its commits reverted; otherwise (a squash) the single merge commit is.
 * Only the merge's own delta is undone, never changes that reached main
 * through other PRs. Returns 'conflict' when later changes touched the same
 * lines and 'empty' when nothing is left to undo.
 */
export async function revertMergedPull(
  config: Config,
  prNumber: number,
  mergeSha: string,
  prCommitCount: number
): Promise<'applied' | 'conflict' | 'empty'> {
  if (!FULL_SHA.test(mergeSha) || !Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error('Invalid pull request or merge commit to undo')
  }
  const dir = config.workDir
  const prRef = `refs/remotes/origin/pr-${prNumber}`
  await git(dir, ['fetch', '--no-tags', 'origin', `+refs/pull/${prNumber}/head:${prRef}`], {
    env: gitAuthEnv(config.githubToken),
  })
  const parents = (await git(dir, ['rev-list', '--parents', '-n', '1', mergeSha])).trim().split(' ')
  let target: string[]
  if (parents.length > 2) target = ['-m', '1', mergeSha]
  else if (
    prCommitCount > 1 &&
    (await integratedCommitByCommit(dir, mergeSha, prRef, prCommitCount))
  ) {
    target = [`${mergeSha}~${prCommitCount}..${mergeSha}`]
  } else target = [mergeSha]

  const code = await gitExitCode(dir, ['revert', '--no-commit', '--no-edit', ...target])
  if (code !== 0) {
    await gitExitCode(dir, ['revert', '--abort'])
    return 'conflict'
  }
  // --quiet exits 0 when nothing is staged.
  return (await gitExitCode(dir, ['diff', '--cached', '--quiet'])) === 0 ? 'empty' : 'applied'
}

/** Staged changes as a tree change set (for the same type/content policy as agent edits). */
export async function stagedTreeChanges(dir: string): Promise<TreeChange[]> {
  const raw = await git(dir, ['diff', '--cached', '--raw', '--no-renames', '-z'])
  const parts = raw.split('\0').filter((part) => part !== '')
  const changes: TreeChange[] = []
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const [oldMode, newMode, , , status] = parts[i].replace(/^:/, '').split(' ')
    const mode = status === 'D' ? oldMode : newMode
    changes.push({
      path: parts[i + 1],
      change: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
      kind: mode === '120000' ? 'symlink' : mode.startsWith('100') ? 'file' : 'other',
    })
  }
  return changes
}
