FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
COPY services ./services

RUN pnpm install --frozen-lockfile --ignore-scripts --filter auth-service...

RUN pnpm --filter auth-service build

EXPOSE 5001

CMD ["pnpm", "--filter", "auth-service", "start"]
