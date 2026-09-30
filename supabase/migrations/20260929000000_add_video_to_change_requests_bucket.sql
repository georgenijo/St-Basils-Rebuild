-- Allow the change-request-agent worker to store private Playwright screen
-- recordings (verification video) alongside the existing before/after
-- screenshots in the change-requests bucket. Recordings reuse the existing
-- change_request_files.kind = 'verification' value (distinguished from
-- screenshots by content_type/label) rather than adding a new kind, so no
-- CHECK constraint change is needed. See docs/change-requests.md.
--
-- Bucket stays private with no storage.objects policies: only the service
-- role reads/writes, and the admin UI uses server-minted signed URLs (see
-- src/app/(admin)/admin/requests/[id]/page.tsx and
-- services/change-request-agent/src/db.ts's uploadVerificationShot).
--
-- Raises file_size_limit from 10 MiB to 50 MiB: short verification clips in
-- webm are usually well under that, but a single screenshot never was.
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'video/webm'
  ],
  file_size_limit = 52428800
WHERE id = 'change-requests';
