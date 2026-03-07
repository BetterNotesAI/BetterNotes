FROM node:20-bookworm-slim

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends tectonic ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/latex-worker ./services/latex-worker

RUN pnpm install --filter @betternotes/shared --filter latex-worker --frozen-lockfile=false
RUN pnpm --filter latex-worker build

WORKDIR /app/services/latex-worker

EXPOSE 8080
CMD ["pnpm", "start"]
