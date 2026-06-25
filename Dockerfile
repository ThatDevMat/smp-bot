# Multi-stage Dockerfile
#
# Stage 1 — deps:    production dependencies only (for the production stage)
# Stage 2 — dev:      all dependencies + nodemon for hot reload (local dev)
# Stage 3 — prod:     minimal image with production deps

# ------------------------------------------------------------------ #
# Stage 1 — production dependencies
# ------------------------------------------------------------------ #
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ------------------------------------------------------------------ #
# Stage 2 — development (hot reload)
# ------------------------------------------------------------------ #
FROM node:20-alpine AS dev
WORKDIR /app
RUN npm install -g nodemon
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
CMD ["npx", "nodemon", "--legacy-watch", "src/index.js"]

# ------------------------------------------------------------------ #
# Stage 3 — production
# ------------------------------------------------------------------ #
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json ./
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
