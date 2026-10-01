import { checkMergeReadiness } from '@/lib/change-request-github'
import { ChangeRequestMergeButton } from '@/components/features/ChangeRequestMergeButton'

/** Server-side readiness (PR head = verified commit, required checks passed) for the button. */
export async function ChangeRequestMergePanel({
  requestId,
  prNumber,
  verifiedSha,
}: {
  requestId: string
  prNumber: number
  verifiedSha: string | null | undefined
}) {
  if (!verifiedSha) return null
  const readiness = await checkMergeReadiness({ prNumber, verifiedSha })
  return (
    <ChangeRequestMergeButton
      requestId={requestId}
      verifiedSha={verifiedSha}
      blockedReason={readiness.ok ? null : readiness.reason}
    />
  )
}
