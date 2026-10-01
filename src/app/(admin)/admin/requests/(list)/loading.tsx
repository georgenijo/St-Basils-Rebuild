import { ChangeRequestListSkeleton } from '@/components/features/ChangeRequestSkeletons'

// Scoped to the list through the (list) route group, so opening a request or
// "New request" shows its own placeholder instead of this table.
export default function ChangeRequestsLoading() {
  return <ChangeRequestListSkeleton />
}
