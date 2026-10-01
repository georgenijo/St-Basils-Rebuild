import { loadConfig, secretValues, type Config } from './config'
import { cleanupAbandonedSubmissions, sweepOrphanFolders, type SweepState } from './abandoned'
import { cleanupClosedRequests } from './closed'
import { confirmLiveDeployments } from './live'
import { startCredentialRefresh, type CredentialRefreshHandle } from './credential-refresh'
import { cleanupDeps, claimNext, createDb, type Db } from './db'
import { killAllChildren } from './exec'
import { createGitHub, resolveGithubToken } from './github'
import { processRequest, type JobContext } from './job'
import { syncPullRequests } from './pr-sync'
import { log, registerRedactions } from './log'
import { recoverStaleClaims } from './stale'

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

/** Rotating orphan-sweep cursor, kept in memory across maintenance cycles. */
const orphanSweepState: SweepState = { cursor: 0 }

export async function cleanupStorage(db: Db, config: Config): Promise<void> {
  const deps = cleanupDeps(db)
  const warn = (msg: string, fields: Record<string, unknown>) => log.warn(msg, fields)
  const abandoned = await cleanupAbandonedSubmissions(deps, new Date(), undefined, warn)
  if (abandoned.found > 0) log.info('abandoned submissions cleaned up', { ...abandoned })
  const orphans = await sweepOrphanFolders(deps, new Date(), {
    minAgeMs: config.orphanMinAgeMinutes * 60_000,
    state: orphanSweepState,
    warn,
  })
  if (orphans.orphanFolders > 0 || orphans.foldersSkipped > 0 || orphans.foldersClaimed > 0) {
    log.info('orphan storage sweep', { ...orphans })
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
  const secrets = secretValues(config)
  const gh = createGitHub(config)
  const ctx: JobContext = {
    config,
    db,
    gh,
    secrets,
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
    fhRunId: config.fhRunId,
    fhAgentId: config.fhAgentId,
    // Which half is missing, never the values: see README "Email notifications".
    emailNotifications:
      config.resendApiKey && config.notifyEmail
        ? 'enabled'
        : `disabled (missing ${[
            !config.resendApiKey && 'RESEND_API_KEY',
            !config.notifyEmail && 'CHANGE_REQUEST_NOTIFY_EMAIL',
          ]
            .filter(Boolean)
            .join(', ')})`,
  })

  // Long single-repo runs (Family Host managed agents) can outlive the
  // GITHUB_TOKEN minted at claim time; only set up when the platform gave us
  // a refresh endpoint (FH_CREDENTIAL_URL/FH_RUN_CREDENTIAL — see
  // managed-agents-contract.md). Off in every other deployment mode.
  let credentialRefresh: CredentialRefreshHandle | null = null
  if (config.fhCredentialUrl && config.fhRunCredential) {
    credentialRefresh = startCredentialRefresh({
      url: config.fhCredentialUrl,
      runCredential: config.fhRunCredential,
      intervalMs: config.credentialRefreshIntervalMs,
      expectedRepository: config.githubRepo,
      onRefreshed: (token) => {
        config.githubToken = token
        gh.setToken(token)
      },
    })
    log.info('github credential refresh enabled', {
      intervalMs: config.credentialRefreshIntervalMs,
    })
  }

  try {
    let lastMaintenance = 0
    while (!shuttingDown) {
      if (Date.now() - lastMaintenance >= config.prSyncIntervalMs || lastMaintenance === 0) {
        lastMaintenance = Date.now()
        await recoverStaleClaims(db, config).catch((error) =>
          log.error('stale recovery failed', { error })
        )
        await syncPullRequests(db, gh).catch((error) => log.error('pr sync failed', { error }))
        await cleanupClosedRequests(db, gh, { dryRun: config.dryRun }).catch((error) =>
          log.error('closed request cleanup failed', { error })
        )
        await confirmLiveDeployments(db, gh, config, { dryRun: config.dryRun }).catch((error) =>
          log.error('live check failed', { error })
        )
        await cleanupStorage(db, config).catch((error) =>
          log.error('storage cleanup failed', { error })
        )
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
    // A one-shot run has no later sweep: before exiting, wait (bounded) for
    // just-merged changes to reach production so "Live on site" is posted.
    if (once && !shuttingDown) {
      await confirmLiveDeployments(db, gh, config, {
        dryRun: config.dryRun,
        waitMs: config.liveWaitMs,
      }).catch((error) => log.error('live check failed', { error }))
    }
  } finally {
    credentialRefresh?.stop()
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
