# Oracle Property Intelligence — Next.js standalone production image
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=postgres://localhost:5432/postgres
RUN npm run build

# One-shot seeder: pushes schema, loads the dataset, builds embeddings, then exits.
FROM builder AS seeder
CMD ["sh", "-c", "npx drizzle-kit push --force && node --import tsx src/db/load.ts && node --import tsx src/db/embed.ts"]

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
