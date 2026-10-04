#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration="$repo_root/supabase/migrations/20261003160000_announcement_email_claims.sql"
checks="$repo_root/scripts/tests/announcement-email-claims.sql"
head_before="$(git -C "$repo_root" rev-parse HEAD)"

if [[ ! "$head_before" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'FAIL: git rev-parse HEAD did not return one 40-character commit hash\n' >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required to run this synthetic PostgreSQL 17 integration harness.\n' >&2
  exit 2
fi
if [[ ! -f "$migration" || ! -f "$checks" ]]; then
  printf 'FAIL: required migration or SQL checks file is missing\n' >&2
  exit 1
fi

suffix="$(date +%s)-$$-${RANDOM}"
container="announcement-email-claims-${suffix}"
if docker container inspect "$container" >/dev/null 2>&1; then
  printf 'FAIL: generated container name already exists; refusing to touch it\n' >&2
  exit 1
fi
scratch="$(mktemp -d "${TMPDIR:-/tmp}/announcement-email-claims.XXXXXX")"
container_id=""
cleanup() {
  if [[ -n "$container_id" ]]; then
    current_id="$(docker inspect --format '{{.Id}}' "$container" 2>/dev/null || true)"
    if [[ "$current_id" == "$container_id" ]]; then
      docker rm -fv "$container_id" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT INT TERM

printf 'Synthetic PostgreSQL integration harness\n'
printf 'git HEAD: %s\n' "$head_before"
container_id="$(docker run --detach --name "$container" --network none \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17)"

ready=0
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  printf 'FAIL: disposable PostgreSQL 17 container did not become ready\n' >&2
  exit 1
fi

# Synthetic-only foundation: the migration sees only the columns referenced by
# its foreign key and the announcement lifecycle SQL.
cat <<'SQL' | docker exec -i "$container" psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 --quiet
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL,
  body jsonb,
  send_email boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  published_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.announcements TO service_role;
SQL

docker exec -i "$container" psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 --quiet < "$migration"
docker exec -i "$container" psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 < "$checks"

# Hold the first request inside a trigger after it has locked its announcement
# row. The second psql process is a separate TCP-less container connection and
# reaches the real row-lock/unique-claim race while the first is in flight.
cat <<'SQL' | docker exec -i "$container" psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 --quiet
INSERT INTO public.announcements (id, title, slug, body, send_email, published_at)
VALUES ('10000000-0000-0000-0000-000000000006', 'Synthetic concurrent', 'synthetic-concurrent', '{"type":"doc"}', TRUE, now());
CREATE FUNCTION public.synthetic_pause_claim_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_sleep(1);
  RETURN NEW;
END;
$$;
CREATE TRIGGER synthetic_pause_claim_insert
BEFORE INSERT ON public.announcement_email_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.synthetic_pause_claim_insert();
SQL

claim_query() {
  local attempt="$1"
  docker exec -i "$container" psql --username postgres --dbname postgres --no-align --tuples-only --quiet --set ON_ERROR_STOP=1 <<SQL
SET ROLE service_role;
SELECT pg_backend_pid() || '|' || (public.claim_announcement_email(
  '10000000-0000-0000-0000-000000000006', '$attempt', 4) ->> 'outcome');
SQL
}

claim_query 20000000-0000-0000-0000-000000000007 > "$scratch/claim-one.out" &
first_pid=$!
in_trigger=0
for _ in $(seq 1 40); do
  in_trigger="$(docker exec "$container" psql --username postgres --dbname postgres --no-align --tuples-only --quiet \
    --command "SELECT count(*) FROM pg_stat_activity WHERE query LIKE '%claim_announcement_email%' AND wait_event = 'PgSleep'" 2>/dev/null || true)"
  if [[ "$in_trigger" == 1 ]]; then break; fi
  sleep 0.05
done
if [[ "$in_trigger" != 1 ]]; then
  printf 'FAIL: first independent claim did not enter its concurrency hold\n' >&2
  exit 1
fi
claim_query 20000000-0000-0000-0000-000000000008 > "$scratch/claim-two.out" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

claim_one="$(cat "$scratch/claim-one.out")"
claim_two="$(cat "$scratch/claim-two.out")"
if [[ -z "$claim_one" || -z "$claim_two" || "$claim_one" == *$'\n'* || "$claim_two" == *$'\n'* ]]; then
  printf 'FAIL: concurrent claim connections did not each return one result\n' >&2
  exit 1
fi
backend_one="${claim_one%%|*}"
outcome_one="${claim_one#*|}"
backend_two="${claim_two%%|*}"
outcome_two="${claim_two#*|}"
if [[ "$backend_one" == "$backend_two" || ! "$backend_one" =~ ^[0-9]+$ || ! "$backend_two" =~ ^[0-9]+$ ]]; then
  printf 'FAIL: claim requests did not use distinct PostgreSQL connections\n' >&2
  exit 1
fi
if ! { [[ "$outcome_one" == claimed && "$outcome_two" == blocked ]] || [[ "$outcome_one" == blocked && "$outcome_two" == claimed ]]; }; then
  printf 'FAIL: concurrent outcomes were not exactly one claimed and one blocked\n' >&2
  exit 1
fi
printf 'PASS concurrency: two independent connections returned exactly one claimed and one blocked\n'

head_after="$(git -C "$repo_root" rev-parse HEAD)"
if [[ "$head_after" != "$head_before" ]]; then
  printf 'FAIL: git HEAD changed during integration harness\n' >&2
  exit 1
fi
printf 'PASS repository: git HEAD remained exactly %s\n' "$head_after"
printf 'All announcement email database checks passed.\n'
