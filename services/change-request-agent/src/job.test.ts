import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatFiles } from './checks'
import { runClaude, type ClaudeRun } from './claude'
import type { Config } from './config'
import {
  deleteVerificationFiles,
  downloadFile,
  getFiles,
  getMessages,
  getRequest,
  postMessage,
  postMessageSafe,
  updateRequest,
} from './db'
import {
  branchDiffNumstat,
  changedFiles,
  commit,
  ensureClone,
  ensureDependencies,
  git,
  prepareBranch,
  prepareRevisionBranch,
  pushBranch,
  stageAll,
} from './git'
import type { GitHub, GithubCheckRun } from './github'
import {
  countChangedLines,
  evaluateChangeSet,
  evaluateGuardrails,
  unreferencedAttachments,
} from './guardrails'
import { processRequest, type JobContext } from './job'
import { notify } from './notify'
import {
  agentCheckoutDir,
  applyChanges,
  createAgentCheckout,
  diffSnapshots,
  removeAgentCheckout,
  snapshotTree,
} from './sandbox'
import type { ChangeRequest } from './types'
import { verifyPreview } from './verify'
import type { DeploymentWithStatuses } from './preview'

// These modules do real filesystem / process / network work in production;
// every test in this file replaces them with deterministic fakes so the
// orchestration in job.ts (processRequest/runPipeline) can be exercised
// without a real git checkout, a real Claude CLI, a real Supabase project or
// a real browser. Pure modules (prompt.ts, prbody.ts, redact.ts, naming.ts,
// ci-status.ts, preview.ts, guardrails.ts's own logic) are deliberately left
// real: their contracts are what makes assertions like "no private PR body
// content" and "exact pushed SHA" meaningful regression checks instead of
// just re-asserting whatever a mock was told to return.
vi.mock('./checks', () => ({ formatFiles: vi.fn() }))
vi.mock('./claude', () => ({
  EDIT_TOOLS: ['Read', 'Edit', 'Write', 'Glob', 'Grep'],
  runClaude: vi.fn(),
}))
vi.mock('./git', () => ({
  branchDiffNumstat: vi.fn(),
  changedFiles: vi.fn(),
  commit: vi.fn(),
  ensureClone: vi.fn(),
  ensureDependencies: vi.fn(),
  git: vi.fn(),
  prepareBranch: vi.fn(),
  prepareRevisionBranch: vi.fn(),
  pushBranch: vi.fn(),
  stageAll: vi.fn(),
}))
vi.mock('./guardrails', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./guardrails')>()
  return {
    ...actual,
    countChangedLines: vi.fn(),
    evaluateChangeSet: vi.fn(),
    evaluateGuardrails: vi.fn(),
    unreferencedAttachments: vi.fn(),
  }
})
vi.mock('./sandbox', () => ({
  agentCheckoutDir: vi.fn(),
  applyChanges: vi.fn(),
  createAgentCheckout: vi.fn(),
  diffSnapshots: vi.fn(),
  removeAgentCheckout: vi.fn(),
  snapshotTree: vi.fn(),
}))
vi.mock('./db', () => ({
  deleteVerificationFiles: vi.fn(),
  downloadFile: vi.fn(),
  getFiles: vi.fn(),
  getMessages: vi.fn(),
  getRequest: vi.fn(),
  postMessage: vi.fn(),
  postMessageSafe: vi.fn(),
  recordMerge: vi.fn(),
  updateRequest: vi.fn(),
}))
vi.mock('./notify', () => ({ notify: vi.fn() }))
vi.mock('./verify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./verify')>()
  return { ...actual, verifyPreview: vi.fn() }
})

const PRIVATE_MARKER = 'PRIVATE-MARKER-should-never-leak-0123456789'

function fakeConfig(overrides: Partial<Config> = {}): Config {
  return {
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseServiceRoleKey: 'service-role-key-test-0123456789',
    workerId: 'test-worker',
    pollIntervalMs: 15_000,
    prSyncIntervalMs: 300_000,
    liveWaitMs: 600_000,
    staleClaimMinutes: 90,
    orphanMinAgeMinutes: 30,
    maxAttempts: 3,

    githubRepo: 'georgenijo/St-Basils-Rebuild',
    repoUrl: 'https://github.com/georgenijo/St-Basils-Rebuild.git',
    baseBranch: 'main',
    githubToken: 'test-github-token-0123456789',
    workDir: '/tmp/cra-test-workdir',

    fhRunId: null,
    fhAgentId: null,
    fhCredentialUrl: null,
    fhRunCredential: null,
    credentialRefreshIntervalMs: 40 * 60_000,

    ciCheckName: 'Validate',
    ciTimeoutMs: 15 * 60_000,
    ciPollMs: 20_000,

    claudeBin: 'claude',
    claudeModel: 'claude-opus-5-5',
    claudeTimeoutMs: 20 * 60_000,
    claudeSettingsFile: null,

    checkTimeoutMs: 10 * 60_000,
    npmCiTimeoutMs: 15 * 60_000,
    maxDiffLines: 800,

    gitName: 'Test Bot',
    gitEmail: 'test@example.org',

    previewTimeoutMs: 15 * 60_000,
    previewPollMs: 20_000,
    vercelBypassSecret: null,
    baselineUrl: 'https://stbasilsboston.org',

    siteUrl: 'https://stbasilsboston.org',
    resendApiKey: null,
    notifyEmail: null,
    notifyFrom: "St. Basil's Church <noreply@stbasilsboston.org>",

    dryRun: false,
    ...overrides,
  }
}

function fakeRequest(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'abcd1234-5678-90ab-cdef-1234567890ab',
    requester_id: 'user-1',
    title: 'Update the homepage heading',
    description: PRIVATE_MARKER,
    page_path: '/',
    target_selector: null,
    target_text: null,
    status: 'in_progress',
    branch_name: null,
    pr_number: null,
    pr_url: null,
    preview_url: null,
    verification: null,
    revision_base_sha: null,
    claimed_by: 'test-worker',
    claimed_at: '2026-01-01T00:00:00.000Z',
    attempts: 1,
    error: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function claudeRun(result: string): ClaudeRun {
  return { result, isError: false, costUsd: null, numTurns: 1, permissionDenials: [] }
}

function successCheckRun(id: number): GithubCheckRun {
  return { id, name: 'Validate', status: 'completed', conclusion: 'success', html_url: null }
}

function failureCheckRun(id: number): GithubCheckRun {
  return {
    id,
    name: 'Validate',
    status: 'completed',
    conclusion: 'failure',
    html_url: `https://github.com/x/y/actions/runs/${id}`,
  }
}

function readyDeployment(sha: string): DeploymentWithStatuses {
  return {
    id: 1,
    sha,
    environment: 'preview',
    created_at: '2026-01-01T00:00:00.000Z',
    statuses: [
      {
        state: 'success',
        environment_url: 'https://cra-test-preview.vercel.app',
        created_at: '2026-01-01T00:00:01.000Z',
      },
    ],
  }
}

interface FakeGh {
  checkRunsForSha: ReturnType<typeof vi.fn>
  deploymentsForSha: ReturnType<typeof vi.fn>
  openOrUpdatePull: ReturnType<typeof vi.fn>
  markReadyForReview: ReturnType<typeof vi.fn>
  markDraftForBranch: ReturnType<typeof vi.fn>
  pullState: ReturnType<typeof vi.fn>
  comment: ReturnType<typeof vi.fn>
  jobLog: ReturnType<typeof vi.fn>
}

function successfulChecks(id: number): GithubCheckRun[] {
  return ['Validate', 'Unit Tests', 'Change Request Agent Service', 'Browser Flow Tests'].map(
    (name) => ({ ...successCheckRun(id), name })
  )
}

function fakeGh(): FakeGh {
  return {
    checkRunsForSha: vi.fn().mockResolvedValue(successfulChecks(1)),
    deploymentsForSha: vi.fn().mockImplementation(async (sha: string) => [readyDeployment(sha)]),
    openOrUpdatePull: vi.fn().mockResolvedValue({
      number: 12,
      html_url: 'https://github.com/x/y/pull/12',
      created: true,
    }),
    markReadyForReview: vi.fn().mockResolvedValue(undefined),
    markDraftForBranch: vi.fn().mockResolvedValue(undefined),
    pullState: vi.fn().mockResolvedValue({ state: 'open', merged: false }),
    comment: vi.fn().mockResolvedValue(undefined),
    jobLog: vi.fn().mockResolvedValue('fake CI job log output'),
  }
}

function makeCtx(
  overrides: { config?: Partial<Config>; gh?: FakeGh; isShuttingDown?: () => boolean } = {}
) {
  const gh = overrides.gh ?? fakeGh()
  const ctx: JobContext = {
    config: fakeConfig(overrides.config),
    db: {} as JobContext['db'],
    gh: gh as unknown as GitHub,
    secrets: [],
    isShuttingDown: overrides.isShuttingDown ?? vi.fn(() => false),
  }
  return { ctx, gh }
}

beforeEach(() => {
  vi.clearAllMocks()

  // Sandbox / filesystem stand-ins: a single fake added file, never a path
  // job.ts's own TEXT_EXT check would try to really read from disk.
  vi.mocked(agentCheckoutDir).mockReturnValue('/tmp/cra-test-agent-dir')
  vi.mocked(createAgentCheckout).mockResolvedValue(undefined)
  vi.mocked(removeAgentCheckout).mockResolvedValue(undefined)
  vi.mocked(snapshotTree).mockResolvedValue(new Map())
  vi.mocked(diffSnapshots).mockReturnValue([
    { path: 'public/images/requests/abcd1234/photo.png', change: 'added', kind: 'file' },
  ])
  vi.mocked(applyChanges).mockResolvedValue(undefined)

  // Guardrails: default to "everything is fine"; individual tests can
  // override evaluateChangeSet/evaluateGuardrails for a rejection scenario.
  vi.mocked(evaluateChangeSet).mockReturnValue({ ok: true })
  vi.mocked(evaluateGuardrails).mockReturnValue({ ok: true })
  vi.mocked(countChangedLines).mockReturnValue(3)
  vi.mocked(unreferencedAttachments).mockReturnValue([])

  // Git: a blank string is a safe universal default (empty stdout) for every
  // call shape job.ts makes (reset/clean/ls-files/etc.); ls-files parses it
  // as "no ignored files", exactly what a clean apply should produce.
  vi.mocked(git).mockResolvedValue('')
  vi.mocked(ensureClone).mockResolvedValue(undefined)
  vi.mocked(prepareBranch).mockResolvedValue('basesha0000000000000000000000000000000')
  vi.mocked(prepareRevisionBranch).mockImplementation(async (_config, _branch, sha) => sha)
  vi.mocked(branchDiffNumstat).mockResolvedValue([])
  vi.mocked(ensureDependencies).mockResolvedValue(undefined)
  vi.mocked(changedFiles).mockResolvedValue([
    { path: 'public/images/requests/abcd1234/photo.png', status: 'A ' },
  ])
  vi.mocked(stageAll).mockResolvedValue({ numstat: [], patch: 'fake diff content' })
  vi.mocked(commit).mockResolvedValue('deadbeef1111111111111111111111111111111')
  vi.mocked(pushBranch).mockResolvedValue(undefined)

  vi.mocked(formatFiles).mockResolvedValue(undefined)

  vi.mocked(runClaude).mockResolvedValue(claudeRun('Updated the homepage heading as requested.'))

  // Db: attachments/messages empty by default; write calls are spied on.
  vi.mocked(getMessages).mockResolvedValue([])
  vi.mocked(getFiles).mockResolvedValue([])
  vi.mocked(downloadFile).mockResolvedValue(Buffer.from(''))
  vi.mocked(deleteVerificationFiles).mockResolvedValue(0)
  vi.mocked(postMessage).mockResolvedValue(undefined)
  vi.mocked(postMessageSafe).mockResolvedValue(undefined)
  vi.mocked(updateRequest).mockResolvedValue(undefined)
  vi.mocked(getRequest).mockImplementation(async () => fakeRequest())

  vi.mocked(notify).mockResolvedValue(undefined)

  // Verify: pass with a clean evidence check by default; echoes back whatever
  // commit SHA it was asked to verify so it stays correct across repairs.
  vi.mocked(verifyPreview).mockImplementation(async (input) => ({
    verdict: 'pass',
    summary: 'The heading now reads as requested.',
    checks: [
      { name: 'preview responds (desktop)', ok: true },
      { name: 'private evidence recording captured (required)', ok: true },
    ],
    commit_sha: input.commitSha,
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('processRequest: happy path', () => {
  it('waits for CI and the preview on the exact pushed SHA, then marks the draft PR ready for review', async () => {
    const { ctx, gh } = makeCtx()
    const request = fakeRequest()

    await processRequest(ctx, request)

    const headSha = await vi.mocked(commit).mock.results[0].value
    expect(gh.checkRunsForSha).toHaveBeenCalledTimes(1)
    expect(gh.checkRunsForSha).toHaveBeenCalledWith(headSha)
    expect(gh.deploymentsForSha).toHaveBeenCalledTimes(1)
    expect(gh.deploymentsForSha).toHaveBeenCalledWith(headSha)

    expect(gh.markReadyForReview).toHaveBeenCalledTimes(1)
    expect(gh.markReadyForReview).toHaveBeenCalledWith(12)

    // The admin timeline gets a "CI passed" event for the exact commit.
    expect(postMessageSafe).toHaveBeenCalledWith(
      ctx.db,
      request.id,
      'system',
      `CI checks passed on pull request #12 (commit ${headSha.slice(0, 7)}); verifying the preview next.`
    )

    const readyCall = vi
      .mocked(updateRequest)
      .mock.calls.find(([, , patch]) => patch?.status === 'ready_for_review')
    expect(readyCall).toBeTruthy()
    expect(readyCall?.[2].error).toBeNull()

    expect(notify).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notify).mock.calls[0][1]).toMatchObject({
      status: 'ready_for_review',
      headline: expect.stringContaining('Preview verified (pass)'),
    })
  })
})

describe('processRequest: readiness failures', () => {
  it('does not record ready_for_review when GitHub promotion fails', async () => {
    const { ctx, gh } = makeCtx()
    gh.markReadyForReview.mockRejectedValue(new Error('GitHub promotion failed'))
    await processRequest(ctx, fakeRequest())
    const patches = vi.mocked(updateRequest).mock.calls.map(([, , patch]) => patch)
    expect(patches.some((patch) => patch.status === 'ready_for_review')).toBe(false)
    expect(patches.some((patch) => patch.status === 'needs_attention')).toBe(true)
    expect(patches.some((patch) => patch.verification?.commit_sha)).toBe(true)
  })

  it('re-drafts before pushing, and aborts if re-drafting fails', async () => {
    const { ctx, gh } = makeCtx()
    gh.markDraftForBranch.mockRejectedValue(new Error('GitHub draft update failed'))
    await processRequest(ctx, fakeRequest())
    expect(pushBranch).not.toHaveBeenCalled()
    expect(runClaude).not.toHaveBeenCalled()
    expect(gh.markReadyForReview).not.toHaveBeenCalled()
  })

  it('does not change GitHub draft status in a dry run', async () => {
    const { ctx, gh } = makeCtx({ config: { dryRun: true } })
    await processRequest(ctx, fakeRequest())
    expect(gh.markDraftForBranch).not.toHaveBeenCalled()
    expect(pushBranch).not.toHaveBeenCalled()
  })
})

describe('processRequest: CI repair round', () => {
  it('repairs, re-pushes, and re-checks CI on the new SHA when the first attempt fails', async () => {
    const { ctx, gh } = makeCtx()
    vi.mocked(commit)
      .mockResolvedValueOnce('sha0000000000000000000000000000000000001')
      .mockResolvedValueOnce('sha0000000000000000000000000000000000002')
    gh.checkRunsForSha
      .mockResolvedValueOnce([failureCheckRun(1)])
      .mockResolvedValueOnce(successfulChecks(2))
    vi.mocked(runClaude)
      .mockResolvedValueOnce(claudeRun('Updated the homepage heading as requested.'))
      .mockResolvedValueOnce(claudeRun('Fixed the lint error and kept the same change.'))

    await processRequest(ctx, fakeRequest())

    expect(runClaude).toHaveBeenCalledTimes(2)
    expect(vi.mocked(runClaude).mock.calls[0][1].label).toBe('edit')
    expect(vi.mocked(runClaude).mock.calls[1][1].label).toBe('repair')

    expect(commit).toHaveBeenCalledTimes(2)
    expect(pushBranch).toHaveBeenCalledTimes(2)

    expect(gh.checkRunsForSha).toHaveBeenCalledTimes(2)
    expect(gh.checkRunsForSha).toHaveBeenNthCalledWith(
      1,
      'sha0000000000000000000000000000000000001'
    )
    expect(gh.checkRunsForSha).toHaveBeenNthCalledWith(
      2,
      'sha0000000000000000000000000000000000002'
    )

    // It recovered: CI eventually passed, so the PR should still get promoted.
    expect(gh.markReadyForReview).toHaveBeenCalledTimes(1)
  })

  it('leaves the PR draft and reports needs_attention when CI still fails after one repair attempt', async () => {
    const { ctx, gh } = makeCtx()
    gh.checkRunsForSha
      .mockResolvedValueOnce([failureCheckRun(1)])
      .mockResolvedValueOnce([failureCheckRun(2)])

    await processRequest(ctx, fakeRequest())

    expect(gh.checkRunsForSha).toHaveBeenCalledTimes(2)
    expect(gh.markReadyForReview).not.toHaveBeenCalled()

    const attentionCall = vi
      .mocked(updateRequest)
      .mock.calls.find(([, , patch]) => patch?.status === 'needs_attention')
    expect(attentionCall).toBeTruthy()
    expect(attentionCall?.[2].error).toBe('CI checks failed after one repair attempt')

    expect(notify).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notify).mock.calls[0][1].status).toBe('needs_attention')
  })

  it('still emails about needs_attention when reloading the request fails', async () => {
    const { ctx, gh } = makeCtx()
    gh.checkRunsForSha
      .mockResolvedValueOnce([failureCheckRun(1)])
      .mockResolvedValueOnce([failureCheckRun(2)])
    vi.mocked(getRequest).mockRejectedValue(new Error('Loading request failed: network'))

    await processRequest(ctx, fakeRequest())

    expect(notify).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notify).mock.calls[0][1]).toMatchObject({
      status: 'needs_attention',
      request: { id: fakeRequest().id, title: 'request abcd1234', pr_url: null },
    })
  })
})

describe('processRequest: shutdown mid-CI-wait', () => {
  it('requeues (rather than failing) a request interrupted by shutdown while waiting on CI, and still cleans up', async () => {
    // checkpoint(ctx) is called 3 times before the CI wait begins (after the
    // checkouts are ready, after parseAgentResult, and after the final
    // guardrail pass), then once per waitForCi loop iteration. Flipping
    // isShuttingDown to true starting on the 4th call reproduces "shutdown
    // arrives while waiting on CI" deterministically, without fake timers or
    // ever letting the CI poll actually resolve.
    let calls = 0
    const isShuttingDown = vi.fn(() => {
      calls += 1
      return calls > 3
    })
    const { ctx, gh } = makeCtx({ isShuttingDown })

    await processRequest(ctx, fakeRequest({ attempts: 1 }))

    // Never reached CI or later stages.
    expect(gh.checkRunsForSha).not.toHaveBeenCalled()
    expect(gh.markReadyForReview).not.toHaveBeenCalled()

    // Requeued, not failed: attempts (1) < maxAttempts (3).
    const requeueCall = vi
      .mocked(updateRequest)
      .mock.calls.find(([, , patch]) => patch?.status === 'queued')
    expect(requeueCall).toBeTruthy()
    expect(requeueCall?.[2]).toEqual({
      status: 'queued',
      claimed_by: null,
      claimed_at: null,
      error: null,
    })
    expect(
      vi.mocked(updateRequest).mock.calls.some(([, , p]) => p?.status === 'needs_attention')
    ).toBe(false)
    expect(notify).not.toHaveBeenCalled()

    // Cleanup still ran even though the job never finished.
    expect(vi.mocked(git).mock.calls.some(([, args]) => args[0] === 'reset')).toBe(true)
    expect(removeAgentCheckout).toHaveBeenCalledTimes(1)
  })

  it('reports needs_attention and emails when shutdown interrupts the last attempt', async () => {
    let calls = 0
    const isShuttingDown = vi.fn(() => {
      calls += 1
      return calls > 3
    })
    const { ctx } = makeCtx({ isShuttingDown })

    await processRequest(ctx, fakeRequest({ attempts: 3 }))

    const patches = vi.mocked(updateRequest).mock.calls.map(([, , patch]) => patch)
    expect(patches.some((patch) => patch.status === 'queued')).toBe(false)
    expect(patches).toContainEqual({
      status: 'needs_attention',
      error: 'Worker restarted while processing this request',
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notify).mock.calls[0][1]).toMatchObject({
      status: 'needs_attention',
      headline: expect.stringContaining('used all its attempts'),
      // Short enough to finish inside the container's stop grace period.
      timeoutMs: 5_000,
    })
  })

  it('wakes from a CI poll wait within about a second of a shutdown request', async () => {
    let shuttingDown = false
    const { ctx, gh } = makeCtx({ isShuttingDown: () => shuttingDown })
    // CI still running: the worker would normally wait ciPollMs (20 s).
    gh.checkRunsForSha.mockImplementation(async () => {
      setTimeout(() => {
        shuttingDown = true
      }, 50)
      return [{ ...successCheckRun(1), status: 'in_progress', conclusion: null }]
    })

    const started = Date.now()
    await processRequest(ctx, fakeRequest({ attempts: 1 }))

    expect(Date.now() - started).toBeLessThan(5_000)
    expect(gh.checkRunsForSha).toHaveBeenCalledTimes(1)
    const patches = vi.mocked(updateRequest).mock.calls.map(([, , patch]) => patch)
    expect(patches.some((patch) => patch.status === 'queued')).toBe(true)
    expect(removeAgentCheckout).toHaveBeenCalledTimes(1)
  })
})

describe('processRequest: PR body privacy', () => {
  it('never puts the private request description in the (public) pull request body', async () => {
    const { ctx, gh } = makeCtx()
    const request = fakeRequest({ description: PRIVATE_MARKER })

    await processRequest(ctx, request)

    expect(gh.openOrUpdatePull).toHaveBeenCalledTimes(1)
    const body = gh.openOrUpdatePull.mock.calls[0][0].body as string
    expect(body).not.toContain(PRIVATE_MARKER)
    expect(body).toContain(`/admin/requests/${request.id}`)
    expect(body).not.toContain('Updated the homepage heading as requested.')
    expect(gh.openOrUpdatePull.mock.calls[0][0].title).not.toContain(request.title)
  })
})

describe('processRequest: verification evidence gate', () => {
  it('does not mark the PR ready and reports needs_attention when required evidence is missing, even though the verdict passed', async () => {
    const { ctx, gh } = makeCtx()
    vi.mocked(verifyPreview).mockImplementation(async (input) => ({
      verdict: 'pass',
      summary: 'Looks correct, but the recording is missing.',
      checks: [
        { name: 'preview responds (desktop)', ok: true },
        {
          name: 'private evidence recording captured (required)',
          ok: false,
          detail:
            'The desktop preview pass was not recorded, or the recording could not be read; see the worker log.',
        },
      ],
      commit_sha: input.commitSha,
    }))

    await processRequest(ctx, fakeRequest())

    expect(gh.markReadyForReview).not.toHaveBeenCalled()
    const attentionCall = vi
      .mocked(updateRequest)
      .mock.calls.find(([, , patch]) => patch?.status === 'needs_attention')
    expect(attentionCall).toBeTruthy()
    expect(attentionCall?.[2].error).toContain('private evidence recording captured (required)')
    expect(gh.comment.mock.calls[0][1]).toContain('Preview verification: FAIL')
    expect(gh.comment.mock.calls[0][1]).not.toContain(
      'Looks correct, but the recording is missing.'
    )
  })
})

describe('processRequest: cleanup on an unexpected error', () => {
  it('still discards the working tree and removes the agent checkout when a step throws', async () => {
    const { ctx, gh } = makeCtx()
    gh.openOrUpdatePull.mockRejectedValue(new Error('GitHub 500'))

    await processRequest(ctx, fakeRequest())

    const attentionCall = vi
      .mocked(updateRequest)
      .mock.calls.find(([, , patch]) => patch?.status === 'needs_attention')
    expect(attentionCall).toBeTruthy()

    expect(vi.mocked(git).mock.calls.some(([, args]) => args[0] === 'reset')).toBe(true)
    expect(removeAgentCheckout).toHaveBeenCalledTimes(1)
  })
})

describe('processRequest: revision of a verified change', () => {
  const VERIFIED = 'a'.repeat(40)
  const revisionRequest = (overrides: Partial<ChangeRequest> = {}) =>
    fakeRequest({
      branch_name: 'change-request/abcd1234-website-update',
      pr_number: 12,
      pr_url: 'https://github.com/x/y/pull/12',
      revision_base_sha: VERIFIED,
      attempts: 2,
      ...overrides,
    })

  it('builds on the verified commit of the same branch and PR, then re-verifies the new commit', async () => {
    const { ctx, gh } = makeCtx()
    gh.openOrUpdatePull.mockResolvedValue({
      number: 12,
      html_url: 'https://github.com/x/y/pull/12',
      created: false,
    })
    vi.mocked(branchDiffNumstat).mockResolvedValue([
      { path: 'src/app/(public)/page.tsx', added: 4, deleted: 1, binary: false },
      { path: 'src/components/features/HomeHero.tsx', added: 2, deleted: 2, binary: false },
    ])
    vi.mocked(countChangedLines).mockImplementation((entries) =>
      entries.reduce((sum, e) => sum + e.added + e.deleted, 0)
    )

    await processRequest(ctx, revisionRequest())

    expect(prepareRevisionBranch).toHaveBeenCalledWith(
      ctx.config,
      'change-request/abcd1234-website-update',
      VERIFIED
    )
    expect(prepareBranch).not.toHaveBeenCalled()
    expect(createAgentCheckout).toHaveBeenCalledWith(ctx.config, expect.any(String), VERIFIED)
    expect(gh.markDraftForBranch).toHaveBeenCalledWith('change-request/abcd1234-website-update')
    expect(vi.mocked(gh.markDraftForBranch).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(runClaude).mock.invocationCallOrder[0]
    )

    const prompt = vi.mocked(runClaude).mock.calls[0][1].prompt
    expect(prompt).toContain('REVISION OF AN EXISTING CHANGE')

    // Same branch, same PR; the body lists the whole branch diff, not just the revision.
    expect(gh.openOrUpdatePull.mock.calls[0][0].branch).toBe(
      'change-request/abcd1234-website-update'
    )
    const body = gh.openOrUpdatePull.mock.calls[0][0].body as string
    expect(body).toContain('2 files, 9 lines')
    expect(body).toContain('src/components/features/HomeHero.tsx')
    expect(vi.mocked(commit).mock.calls[0][1]).toContain('Revision requested via /admin/requests')

    const headSha = await vi.mocked(commit).mock.results[0].value
    expect(gh.checkRunsForSha).toHaveBeenCalledWith(headSha)
    expect(verifyPreview).toHaveBeenCalledWith(expect.objectContaining({ commitSha: headSha }))
    expect(gh.markReadyForReview).toHaveBeenCalledWith(12)

    const systemMessages = vi
      .mocked(postMessage)
      .mock.calls.filter(([, , kind]) => kind === 'system')
      .map(([, , , body]) => body)
    expect(systemMessages[0]).toContain('revising pull request #12')
    expect(systemMessages.some((m) => m.includes('Pushed the requested changes'))).toBe(true)
  })

  it('rebuilds from the base branch with a notice when the verified commit is gone', async () => {
    const { ctx } = makeCtx()
    vi.mocked(prepareRevisionBranch).mockResolvedValue(null)

    await processRequest(ctx, revisionRequest())

    expect(prepareBranch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(runClaude).mock.calls[0][1].prompt).not.toContain(
      'REVISION OF AN EXISTING CHANGE'
    )
    expect(branchDiffNumstat).not.toHaveBeenCalled()
    expect(
      vi
        .mocked(postMessage)
        .mock.calls.some(([, , , body]) => body.includes('is no longer on the branch'))
    ).toBe(true)
  })

  it('does not revise a PR that was merged or closed meanwhile', async () => {
    const { ctx, gh } = makeCtx()
    gh.pullState.mockResolvedValue({ state: 'closed', merged: true })

    await processRequest(ctx, revisionRequest())

    expect(runClaude).not.toHaveBeenCalled()
    expect(pushBranch).not.toHaveBeenCalled()
    expect(gh.markDraftForBranch).not.toHaveBeenCalled()
    expect(updateRequest).toHaveBeenCalledWith(ctx.db, expect.any(String), {
      status: 'merged',
      error: null,
    })
  })

  it('treats a request without a PR as a normal attempt even if a revision base is set', async () => {
    const { ctx, gh } = makeCtx()
    await processRequest(ctx, fakeRequest({ revision_base_sha: VERIFIED }))
    expect(gh.pullState).not.toHaveBeenCalled()
    expect(prepareRevisionBranch).not.toHaveBeenCalled()
    expect(prepareBranch).toHaveBeenCalledTimes(1)
  })

  it('updates only the recorded PR, and stops before pushing if it was closed meanwhile', async () => {
    const { ctx, gh } = makeCtx()
    gh.pullState
      .mockResolvedValueOnce({ state: 'open', merged: false })
      .mockResolvedValueOnce({ state: 'closed', merged: false })

    await processRequest(ctx, revisionRequest())

    expect(runClaude).toHaveBeenCalledTimes(1)
    expect(pushBranch).not.toHaveBeenCalled()
    expect(gh.openOrUpdatePull).not.toHaveBeenCalled()
    expect(updateRequest).toHaveBeenCalledWith(ctx.db, expect.any(String), {
      status: 'closed',
      error: null,
    })
    // The terminal status is never overwritten by the generic failure path.
    expect(
      vi.mocked(updateRequest).mock.calls.some(([, , patch]) => patch.status === 'needs_attention')
    ).toBe(false)
    expect(postMessageSafe).toHaveBeenCalledWith(
      ctx.db,
      expect.any(String),
      'system',
      expect.stringContaining('was closed on GitHub')
    )
  })

  it('keeps a modification of a file the verified change had published', async () => {
    const { ctx } = makeCtx()
    const modified = {
      path: 'public/images/requests/abcd1234/flyer.png',
      change: 'modified' as const,
      kind: 'file' as const,
    }
    vi.mocked(getFiles).mockResolvedValue([
      {
        id: 'f1',
        request_id: 'abcd1234-5678-90ab-cdef-1234567890ab',
        kind: 'attachment',
        storage_path: 'requests/abcd1234/attachments/flyer.png',
        filename: 'flyer.png',
        content_type: 'image/png',
        size_bytes: 1,
        label: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ])
    vi.mocked(diffSnapshots).mockReturnValue([modified])

    await processRequest(ctx, revisionRequest())

    expect(unreferencedAttachments).toHaveBeenCalledWith([], expect.any(Map))
    expect(applyChanges).toHaveBeenCalledWith(expect.any(String), ctx.config.workDir, [modified])
  })

  it('passes the recorded PR number so a replacement PR is never opened', async () => {
    const { ctx, gh } = makeCtx()
    await processRequest(ctx, revisionRequest())
    expect(gh.openOrUpdatePull.mock.calls[0][0].existingNumber).toBe(12)
  })

  it('keeps the deletion of an image the verified change had published', async () => {
    const { ctx } = makeCtx()
    const deleted = {
      path: 'public/images/requests/abcd1234/flyer.png',
      change: 'deleted' as const,
      kind: 'file' as const,
    }
    vi.mocked(getFiles).mockResolvedValue([
      {
        id: 'f1',
        request_id: 'abcd1234-5678-90ab-cdef-1234567890ab',
        kind: 'attachment',
        storage_path: 'requests/abcd1234/attachments/flyer.png',
        filename: 'flyer.png',
        content_type: 'image/png',
        size_bytes: 1,
        label: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ])
    vi.mocked(diffSnapshots).mockReturnValue([deleted])

    await processRequest(ctx, revisionRequest())

    expect(unreferencedAttachments).toHaveBeenCalledWith([], expect.any(Map))
    expect(applyChanges).toHaveBeenCalledWith(expect.any(String), ctx.config.workDir, [deleted])
  })
})

describe('processRequest: CI repair on a closed PR', () => {
  it('does not push a repair to a PR that was closed while CI ran', async () => {
    const { ctx, gh } = makeCtx()
    gh.checkRunsForSha.mockResolvedValueOnce([failureCheckRun(1)])
    gh.pullState.mockResolvedValue({ state: 'closed', merged: false })

    await processRequest(ctx, fakeRequest())

    expect(runClaude).toHaveBeenCalledTimes(2)
    expect(pushBranch).toHaveBeenCalledTimes(1)
    expect(gh.pullState).toHaveBeenCalledWith(12)
    expect(gh.markReadyForReview).not.toHaveBeenCalled()
    expect(updateRequest).toHaveBeenCalledWith(ctx.db, expect.any(String), {
      status: 'closed',
      error: null,
    })
  })
})

describe('processRequest: CI repair rebuilds from the base tree', () => {
  it('resets the trusted tree to the agent base before applying the repaired sandbox', async () => {
    const { ctx, gh } = makeCtx()
    gh.checkRunsForSha
      .mockResolvedValueOnce([failureCheckRun(1)])
      .mockResolvedValueOnce(successfulChecks(2))

    await processRequest(ctx, fakeRequest())

    const readTrees = vi
      .mocked(git)
      .mock.calls.filter(([, args]) => args[0] === 'read-tree')
      .map(([, args]) => args)
    // Once for the first attempt and once for the repair, both from the base commit.
    expect(readTrees).toEqual([
      ['read-tree', '--reset', '-u', 'basesha0000000000000000000000000000000'],
      ['read-tree', '--reset', '-u', 'basesha0000000000000000000000000000000'],
    ])
    expect(applyChanges).toHaveBeenCalledTimes(2)
  })
})
