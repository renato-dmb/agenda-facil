FROM node:20-slim AS deps

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/bot/package.json apps/bot/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter @agenda-facil/dashboard...


FROM node:20-slim AS builder

RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard ./apps/dashboard
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared

ENV NEXT_TELEMETRY_DISABLED=1
# JWT_SECRET e DATABASE_URL são necessárias só em runtime; setadas dummy no build
ENV JWT_SECRET=build-time-placeholder-build-time-placeholder
ENV DATABASE_URL=postgres://build@localhost/build

WORKDIR /app/apps/dashboard
RUN pnpm build


FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002

# Next standalone output já inclui server.js + node_modules mínimos
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

EXPOSE 3002

WORKDIR /app/apps/dashboard
CMD ["node", "server.js"]
