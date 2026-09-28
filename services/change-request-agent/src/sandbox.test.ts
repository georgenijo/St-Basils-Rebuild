import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { applyChanges, diffSnapshots, snapshotTree, type Snapshot } from './sandbox'

let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cra-sandbox-test-'))
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

async function write(dir: string, rel: string, content: string) {
  await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true })
  await fs.writeFile(path.join(dir, rel), content)
}

describe('diffSnapshots', () => {
  it('reports added, modified and deleted entries including kind changes', () => {
    const before: Snapshot = new Map([
      ['a.tsx', { kind: 'file', hash: '1' }],
      ['b.tsx', { kind: 'file', hash: '2' }],
      ['c.css', { kind: 'file', hash: '3' }],
    ])
    const after: Snapshot = new Map([
      ['a.tsx', { kind: 'file', hash: '1' }],
      ['b.tsx', { kind: 'file', hash: 'changed' }],
      ['c.css', { kind: 'symlink', hash: '3' }],
      ['d.png', { kind: 'file', hash: '4' }],
    ])
    before.set('gone.ts', { kind: 'file', hash: '5' })
    expect(diffSnapshots(before, after)).toEqual([
      { path: 'b.tsx', change: 'modified', kind: 'file' },
      { path: 'c.css', change: 'modified', kind: 'symlink' },
      { path: 'd.png', change: 'added', kind: 'file' },
      { path: 'gone.ts', change: 'deleted', kind: 'file' },
    ])
  })
})

describe('snapshotTree + applyChanges', () => {
  it('detects every file including dotfiles and node_modules, and symlinks without following', async () => {
    const agent = path.join(root, 'agent')
    await write(agent, 'src/components/A.tsx', 'a')
    const base = await snapshotTree(agent)
    await write(agent, 'src/components/A.tsx', 'b')
    await write(agent, 'src/components/.prettierrc', '{}')
    await write(agent, 'node_modules/prettier/index.js', 'evil')
    await fs.symlink('/etc/passwd', path.join(agent, 'src/components/link.tsx'))
    const changes = diffSnapshots(base, await snapshotTree(agent))
    expect(changes).toEqual([
      { path: 'node_modules/prettier/index.js', change: 'added', kind: 'file' },
      { path: 'src/components/.prettierrc', change: 'added', kind: 'file' },
      { path: 'src/components/A.tsx', change: 'modified', kind: 'file' },
      { path: 'src/components/link.tsx', change: 'added', kind: 'symlink' },
    ])
  })

  it('copies files as regular files, deletes removals, and refuses non-files and escapes', async () => {
    const agent = path.join(root, 'agent')
    const trusted = path.join(root, 'trusted')
    await write(agent, 'public/new/x.txt', 'hello')
    await write(trusted, 'src/components/Old.tsx', 'old')
    await applyChanges(agent, trusted, [
      { path: 'public/new/x.txt', change: 'added', kind: 'file' },
      { path: 'src/components/Old.tsx', change: 'deleted', kind: 'file' },
    ])
    expect(await fs.readFile(path.join(trusted, 'public/new/x.txt'), 'utf8')).toBe('hello')
    expect((await fs.stat(path.join(trusted, 'public/new/x.txt'))).mode & 0o777).toBe(0o644)
    await expect(fs.stat(path.join(trusted, 'src/components/Old.tsx'))).rejects.toThrow()
    await expect(
      applyChanges(agent, trusted, [{ path: 'public/l.txt', change: 'added', kind: 'symlink' }])
    ).rejects.toThrow(/non-file/)
    await expect(
      applyChanges(agent, trusted, [{ path: '../escape.txt', change: 'added', kind: 'file' }])
    ).rejects.toThrow(/Refusing/)
  })
})
