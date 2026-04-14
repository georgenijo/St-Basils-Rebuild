#!/usr/bin/env bash
# Pipeline event tracker — sends stage events to PostHog
# Usage: pipeline-track.sh <event> <issue> <stage> [status] [extra_json]
#
# Examples:
#   pipeline-track.sh pipeline_started 149 assess
#   pipeline-track.sh stage_completed 149 context pass
#   pipeline-track.sh stage_completed 149 architect reject '{"iteration":2}'
#   pipeline-track.sh pipeline_completed 149 done pass '{"pr":187,"duration_s":1200}'

POSTHOG_KEY="phc_Cv8Cqv7sUBcukfw3vcXtL3TqxVGEPAp4y94zPLG5cvUd"
POSTHOG_HOST="https://us.i.posthog.com"

EVENT="$1"
ISSUE="$2"
STAGE="$3"
STATUS="${4:-}"
EXTRA="${5:-}"

if [ -z "$EVENT" ] || [ -z "$ISSUE" ]; then
  exit 1
fi

# Build base properties
REPO=$(git remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]//' | sed 's/.git$//')
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
TIMESTAMP=$(date -Iseconds)
MACHINE=$(hostname)

# Merge extra properties if provided
EXTRA_FIELDS=""
if [ -n "$EXTRA" ] && [ "$EXTRA" != "{}" ]; then
  # Strip outer braces and add as additional fields
  EXTRA_FIELDS=", $(echo "$EXTRA" | sed 's/^{//;s/}$//')"
fi

PAYLOAD=$(cat <<EOF
{
  "api_key": "${POSTHOG_KEY}",
  "event": "${EVENT}",
  "distinct_id": "pipeline-agent",
  "properties": {
    "issue": ${ISSUE},
    "stage": "${STAGE}",
    "status": "${STATUS}",
    "repo": "${REPO}",
    "branch": "${BRANCH}",
    "timestamp": "${TIMESTAMP}",
    "machine": "${MACHINE}"${EXTRA_FIELDS}
  }
}
EOF
)

# Send to PostHog (fire-and-forget, don't block the pipeline)
curl -sL -o /dev/null "${POSTHOG_HOST}/capture/" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" &

exit 0
