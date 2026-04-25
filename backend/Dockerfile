# ============================================================
# Circuit Fit TV — Backend Dockerfile (multi-stage)
# ============================================================

# ---------- Stage 1 : dépendances ----------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

RUN npm ci --workspaces --include-workspace-root

# ---------- Stage 2 : build ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY backend ./backend

RUN npm run build --workspace=@cfitv/backend

# ---------- Stage 3 : runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache ffmpeg tini
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs packages/shared/package.json ./packages/shared/
COPY --chown=nodejs:nodejs backend/package.json ./backend/

RUN npm ci --workspaces --include-workspace-root --omit=dev && \
    npm cache clean --force && \
    chown -R nodejs:nodejs /app/node_modules

COPY --from=build --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/src ./packages/shared/src

USER nodejs
EXPOSE 3000

ENV NODE_ENV=production
ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/dist/server.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"