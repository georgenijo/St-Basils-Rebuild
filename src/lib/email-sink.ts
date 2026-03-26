import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface MockEmailRecord {
  id: string
  from: string
  to: string[]
  subject: string
  html?: string
  text?: string
  metadata: Record<string, string | null>
  createdAt: string
}

interface ListMockEmailsFilters {
  to?: string
  subject?: string
  template?: string
}

function getEmailSinkDir(): string {
  return path.resolve(process.cwd(), process.env.EMAIL_SINK_DIR || '.e2e/mailbox')
}

async function ensureEmailSinkDir(): Promise<string> {
  const sinkDir = getEmailSinkDir()
  await mkdir(sinkDir, { recursive: true })
  return sinkDir
}

export async function storeMockEmail(
  payload: Omit<MockEmailRecord, 'id' | 'createdAt'>
): Promise<MockEmailRecord> {
  const sinkDir = await ensureEmailSinkDir()
  const record: MockEmailRecord = {
    ...payload,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  }

  const filename = `${record.createdAt.replace(/[:.]/g, '-')}-${record.id}.json`
  await writeFile(path.join(sinkDir, filename), JSON.stringify(record, null, 2), 'utf8')

  return record
}

export async function listMockEmails(
  filters: ListMockEmailsFilters = {}
): Promise<MockEmailRecord[]> {
  const sinkDir = await ensureEmailSinkDir()
  const files = (await readdir(sinkDir)).filter((file) => file.endsWith('.json')).sort()

  const emails = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(path.join(sinkDir, file), 'utf8')
      return JSON.parse(raw) as MockEmailRecord
    })
  )

  return emails
    .filter((email) => {
      if (filters.to && !email.to.includes(filters.to)) {
        return false
      }

      if (filters.subject && !email.subject.includes(filters.subject)) {
        return false
      }

      if (filters.template && email.metadata.template !== filters.template) {
        return false
      }

      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function clearMockEmails(): Promise<void> {
  const sinkDir = getEmailSinkDir()
  await rm(sinkDir, { recursive: true, force: true })
  await mkdir(sinkDir, { recursive: true })
}
