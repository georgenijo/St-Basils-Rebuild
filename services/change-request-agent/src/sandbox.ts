/**
 * The agent never touches the trusted checkout (the one with node_modules
 * where Prettier/ESLint/tsc run). It edits a plain export of the base commit
 * — no .git, no node_modules — and the worker diffs that directory against a
 * snapshot taken before the run. Only changes that pass the guardrails are
 * copied (as regular 0644 files) into the trusted checkout.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { Config } from './config'
import { runChecked } from './exec'
import { git } from './git'
import type { EntryKind, TreeChange } from './guardrails'

/** Paths left out of the agent's copy (large legacy archive; never editable). */
export const AGENT_EXPORT_EXCLUDES = ['archive']

export interface SnapshotEntry {
  kind: EntryKind
  /** sha256 of file content or symlink target; '' for other kinds. */
  hash: string
}

export type Snapshot = Map<string, SnapshotEntry>

export function agentCheckoutDir(config: Config, id8: string): string {
  return path.join(path.dirname(config.workDir), `agent-${id8}`)
}

/** Fresh plain-file export of `sha` from the trusted repo into `dir`. */
export async function createAgentCheckout(config: Config, dir: string, sha: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
  const tarball = path.join(os.tmpdir(), `cra-export-${process.pid}-${Date.now()}.tar`)
  try {
    await git(config.workDir, [
      'archive',
      '--format=tar',
      '-o',
      tarball,
      sha,
      '--',
      '.',
      ...AGENT_EXPORT_EXCLUDES.map((p) => `:(exclude)${p}`),
    ])
    await runChecked('tar', ['-xf', tarball, '-C', dir, '--no-same-owner'], {
      timeoutMs: 5 * 60_000,
    })
  } finally {
    await fs.rm(tarball, { force: true })
  }
}

export async function removeAgentCheckout(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true })
}

/** Walk `root` without following symlinks; hash every entry. */
export async function snapshotTree(root: string): Promise<Snapshot> {
  const out: Snapshot = new Map()
  async function walk(rel: string): Promise<void> {
    const abs = path.join(root, rel)
    const entries = await fs.readdir(abs, { withFileTypes: true })
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      const childAbs = path.join(root, childRel)
      const stat = await fs.lstat(childAbs)
      if (stat.isDirectory()) {
        await walk(childRel)
      } else if (stat.isSymbolicLink()) {
        const target = await fs.readlink(childAbs)
        out.set(childRel, {
          kind: 'symlink',
          hash: createHash('sha256').update(target).digest('hex'),
        })
      } else if (stat.isFile()) {
        const content = await fs.readFile(childAbs)
        out.set(childRel, {
          kind: 'file',
          hash: createHash('sha256').update(content).digest('hex'),
        })
      } else {
        out.set(childRel, { kind: 'other', hash: '' })
      }
    }
  }
  await walk('')
  return out
}

/** Added, modified and deleted entries between two snapshots, sorted by path. */
export function diffSnapshots(before: Snapshot, after: Snapshot): TreeChange[] {
  const changes: TreeChange[] = []
  for (const [p, entry] of after) {
    const prev = before.get(p)
    if (!prev) changes.push({ path: p, change: 'added', kind: entry.kind })
    else if (prev.kind !== entry.kind || prev.hash !== entry.hash) {
      changes.push({ path: p, change: 'modified', kind: entry.kind })
    }
  }
  for (const [p, entry] of before) {
    if (!after.has(p)) changes.push({ path: p, change: 'deleted', kind: entry.kind })
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Copy validated changes into the trusted checkout. Callers must have run
 * evaluateChangeSet first; paths are re-checked here to stay inside `to`.
 */
export async function applyChanges(from: string, to: string, changes: TreeChange[]): Promise<void> {
  const root = path.resolve(to)
  for (const change of changes) {
    const target = path.resolve(root, change.path)
    if (!target.startsWith(`${root}${path.sep}`))
      throw new Error(`Refusing to write ${change.path}`)
    if (change.change === 'deleted') {
      await fs.rm(target, { force: true })
      continue
    }
    if (change.kind !== 'file') throw new Error(`Refusing to copy non-file ${change.path}`)
    const content = await fs.readFile(path.join(from, change.path))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.rm(target, { force: true })
    await fs.writeFile(target, content, { mode: 0o644 })
  }
}
