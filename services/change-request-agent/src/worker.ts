import { loadConfig, secretValues, type Config } from './config'
import { claimNext, createDb, listByStatus, postMessageSafe, updateIfStatus, type Db } from './db'
import { killAllChildren } from './exec'
import { GitHub, resolveGithubToken } from './github'
import { processRequest, type JobContext } from './job'
import { log, registerRedactions } from './log'
import { staleClaimAction } from './stale'

let shuttingDown = false
let wake: (() => void) | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    wake = () => {
      clearTimeout(timer)
      resolve()
    }
  })
}

export async function recoverStaleClaims(db: Db, config: Config): Promise<void> {
  const rows = await listByStatus(db, ['in_progress', 'verifying'])
  for (const row of rows) {
    const action = staleClaimAction(row, {
      workerId: config.workerId,
      now: new Date(),
      staleMinutes: config.staleClaimMinutes,
      maxAttempts: config.maxAttempts,
    })
    if (action === 'skip') continue
    const changed =
      action === 'requeue'
        ? await updateIfStatus(db, row.id, row.status, {
            status: 'queued',
            claimed_by: null,
            claimed_at: null,
          })
        : await updateIfStatus(db, row.id, row.status, {
            status: 'needs_attention',
            error: `Worker stopped while processing (attempt ${row.attempts} of ${config.maxAttempts})`,
          })
    if (!changed) continue
    log.warn('recovered stale claim', { requestId: row.id, action, attempts: row.attempts })
    await postMessageSafe(
      db,
      row.id,
      'system',
      action === 'requeue'
        ? 'The worker stopped before finishing this request; it has been queued again.'
        : `The worker stopped before finishing this request and it has used all ${config.maxAttempts} attempts.`
    )
  }
}

export async function syncPullRequests(db: Db, gh: GitHub): Promise<void> {
  const rows = await listByStatus(db, ['ready_for_review', 'needs_attention'])
  for (const row of rows) {
    if (!row.pr_number) continue
    try {
      const pr = await gh.pullState(row.pr_number)
      if (pr.state !== 'closed') continue
      const next = pr.merged ? 'merged' : 'closed'
      if (await updateIfStatus(db, row.id, row.status, { status: next, error: null })) {
        log.info('pull request state synced', {
          requestId: row.id,
          pr: row.pr_number,
          status: next,
        })
        await postMessageSafe(
          db,
          row.id,
          'system',
          pr.merged
            ? `Pull request #${row.pr_number} was merged. Vercel deploys it to the live site shortly.`
            : `Pull request #${row.pr_number} was closed without merging.`
        )
      }
    } catch (error) {
      log.warn('pull request sync failed', {
        requestId: row.id,
        pr: row.pr_number,
        error: String(error),
      })
    }
  }
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once')
  const config = loadConfig()
  config.githubToken = await resolveGithubToken(config)
  registerRedactions(secretValues(config))
  if (!config.githubToken && !config.dryRun) {
    log.warn('no GitHub token: pushing and opening pull requests will fail')
  }

  const db = createDb(config)
  const gh = new GitHub(config.githubRepo, config.githubToken)
  const ctx: JobContext = {
    config,
    db,
    gh,
    secrets: secretValues(config),
    isShuttingDown: () => shuttingDown,
  }

  const onSignal = (signal: string) => {
    if (shuttingDown) {
      log.warn('second signal; exiting now', { signal })
      killAllChildren()
      process.exit(1)
    }
    log.info('shutdown requested', { signal })
    shuttingDown = true
    // Abort the running step; the job catches ShutdownError and requeues.
    killAllChildren()
    wake?.()
  }
  process.on('SIGTERM', () => onSignal('SIGTERM'))
  process.on('SIGINT', () => onSignal('SIGINT'))

  log.info('worker started', {
    workerId: config.workerId,
    once,
    dryRun: config.dryRun,
    repo: config.githubRepo,
    workDir: config.workDir,
    model: config.claudeModel,
  })

  let lastMaintenance = 0
  while (!shuttingDown) {
    if (Date.now() - lastMaintenance >= config.prSyncIntervalMs || lastMaintenance === 0) {
      lastMaintenance = Date.now()
      await recoverStaleClaims(db, config).catch((error) =>
        log.error('stale recovery failed', { error })
      )
      await syncPullRequests(db, gh).catch((error) => log.error('pr sync failed', { error }))
    }

    let claimed = null
    try {
      claimed = await claimNext(db, config.workerId)
    } catch (error) {
      log.error('claim failed', { error })
    }
    if (claimed) {
      await processRequest(ctx, claimed)
      if (once) break
      continue
    }
    if (once) {
      log.info('no queued requests')
      break
    }
    await sleep(config.pollIntervalMs)
  }
  log.info('worker stopped')
}

main().then(
  () => process.exit(0),
  (error) => {
    log.error('worker crashed', { error })
    process.exit(1)
  }
)
