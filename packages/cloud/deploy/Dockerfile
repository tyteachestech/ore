# Ore Cloud's server (#550). Built from the repo root: docker build -f packages/cloud/deploy/Dockerfile .
# Bun is the one version the repo uses everywhere (CLAUDE.md). No yt-dlp, Python or ML tools go in: the
# server refuses what needs them (#549), and a source that needs one says "Add it on your Mac".
FROM oven/bun:1.4.4-slim
# git: a library is a git repository (ore init), and the import makes one per job.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/cloud/package.json packages/cloud/
COPY apps/desktop/package.json apps/desktop/
RUN bun install --frozen-lockfile --production --ignore-scripts --filter '@ore/cloud'
COPY packages/core packages/core
COPY packages/cloud/src packages/cloud/src
# Never root: an import reads files strangers send. The accounts file is the one thing it may write.
RUN mkdir /data && chown bun:bun /data
USER bun
ENV HOST=0.0.0.0 PORT=8787 ORE_BEHIND_PROXY=1 ORE_CLOUD_DB=/data/accounts.db
EXPOSE 8787
CMD ["bun", "packages/cloud/src/server.ts"]
