FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm install
RUN pnpm --filter @construction/shared build
RUN pnpm --filter @construction/api prisma:generate
RUN pnpm --filter @construction/api build

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main.js"]
