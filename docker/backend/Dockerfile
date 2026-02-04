# Runtime image (uses tsx directly because current project isn't tsc-clean in CI)
# Use Debian slim to avoid Alpine OpenSSL/Prisma engine incompatibilities.
FROM public.ecr.aws/docker/library/node:20-bookworm-slim AS runner
WORKDIR /app

ENV PORT=3000

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production

RUN groupadd -g 1001 nodejs \
  && useradd -m -u 1001 -g nodejs nodejs

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npx", "tsx", "src/server.ts"]
