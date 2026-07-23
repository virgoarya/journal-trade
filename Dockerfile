# Build stage — only install deps & copy source (no tsc, avoids OOM on Railway)
FROM node:20-slim AS builder

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

WORKDIR /app
COPY server/ ./server/

ENV NODE_ENV=production

# Production stage — Alpine
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install Python + MCP dependencies
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir finance-mcp finance-trading-ai-agents-mcp flowllm==0.2.0.8 pathspec==0.11.2

# Install server deps (incl tsx — runtime TS runner)
COPY --from=builder /app/server/package*.json ./server/
RUN cd server && npm ci --only=production --ignore-scripts

# Copy server TypeScript source (no build step — tsx runs directly)
COPY --from=builder /app/server/src ./server/src

CMD ["npx", "tsx", "server/src/index.ts"]
