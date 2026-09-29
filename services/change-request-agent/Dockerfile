# change-request-agent — public image for Family Host managed agents.
# Build context: this directory (services/change-request-agent).
# /data is job-owned scratch, not guaranteed to persist between runs (see
# managed-agents-contract.md); the same image also runs on a Coolify
# deployment with a persistent /data volume when argv omits --once.
# The default is one-shot. NODE_OPTIONS carries the tsx loader so it survives
# a LAUNCH.argv override, which fully replaces CMD rather than appending to it.

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-bookworm-slim

ARG CLAUDE_CODE_VERSION=2.1.283
ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    WORK_DIR=/data/repo \
    NODE_OPTIONS=--import=tsx \
    npm_config_update_notifier=false \
    DISABLE_AUTOUPDATER=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
 && npm cache clean --force

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
 && npx playwright install --with-deps chromium \
 && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src

# Non-root runtime user owning the persistent volume and a writable HOME
# (Claude Code keeps its config under $HOME/.claude).
RUN groupadd --system worker \
 && useradd --system --gid worker --create-home --home-dir /home/worker worker \
 && mkdir -p /data \
 && chown -R worker:worker /data /home/worker
USER worker
ENV HOME=/home/worker
VOLUME ["/data"]

ENTRYPOINT ["/usr/bin/tini", "--"]
# A managed-agent LAUNCH sets argv to exactly this (see managed-agents-contract.md);
# this default also makes `docker run` do the right thing on scratch storage.
CMD ["node", "src/worker.ts", "--once"]
