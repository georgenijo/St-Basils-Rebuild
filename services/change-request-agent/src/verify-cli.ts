/**
 * Run only the preview verification step for an existing request:
 *
 *   tsx src/verify-cli.ts --request <id> --preview <https://*.vercel.app> [--sha <commit>]
 *     [--summary "..."] [--record]
 *
 * Captures before/after screenshots (BASELINE_URL vs preview), uploads them as
 * verification files, asks Claude for a verdict and prints the result. With
 * --record it also stores preview_url + verification on the request (status
 * is left unchanged).
 */
import { loadConfig, secretValues } from './config'
import { createDb, getMessages, getRequest, updateRequest } from './db'
import { log, registerRedactions } from './log'
import { validatePreviewUrl } from './preview'
import { verifyPreview } from './verify'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function main(): Promise<void> {
  const requestId = arg('request')
  const previewUrl = validatePreviewUrl(arg('preview') ?? '')
  if (!requestId || !previewUrl) {
    throw new Error(
      'Usage: verify-cli --request <id> --preview <https://*.vercel.app> [--sha <commit>] [--summary text] [--record]'
    )
  }
  const config = loadConfig()
  registerRedactions(secretValues(config))
  const db = createDb(config)
  const request = await getRequest(db, requestId)
  const messages = await getMessages(db, requestId)
  const agentSummary =
    arg('summary') ??
    [...messages].reverse().find((m) => m.author_kind === 'agent')?.body ??
    '(no agent summary available)'

  const verification = await verifyPreview({
    config,
    db,
    request,
    messages,
    agentSummary,
    previewUrl,
    commitSha: arg('sha') ?? null,
  })
  log.info('verification result', { requestId, verification })
  if (process.argv.includes('--record')) {
    await updateRequest(db, requestId, { preview_url: previewUrl, verification })
    log.info('verification recorded on request', { requestId })
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    log.error('verify failed', { error })
    process.exit(1)
  }
)
