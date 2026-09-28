# change-request-agent — Family Host (Coolify) image.
# Build context: this directory (services/change-request-agent).
# Persistent volume: /data (the website clone lives in /data/repo).

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-bookworm-slim

ARG CLAUDE_CODE_VERSION=2.1.283
ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    WORK_DIR=/data/repo \
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
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--import", "tsx", "src/worker.ts"]
