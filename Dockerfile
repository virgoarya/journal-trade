# Build stage - use Debian slim for reliable native module builds (lightningcss, sharp, etc.)
FROM node:20-slim AS builder

# Install minimal build tools for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install frontend dependencies
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

# Copy all source and build
WORKDIR /app
COPY server/ ./server/
COPY frontend/ ./frontend/

ENV NODE_ENV=production
RUN cd server && npm run build

# Production stage - Alpine for smaller final image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install Python + MCP dependencies (clean install — .venv-mcp is dockerignored)
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir finance-mcp finance-trading-ai-agents-mcp flowllm==0.2.0.8 pathspec==0.11.2

# Copy server package files
COPY --from=builder /app/server/package*.json ./server/

# Install only production deps
RUN cd server && npm ci --only=production --ignore-scripts

# Copy built files
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/frontend ./server/dist/frontend

CMD ["node", "server/dist/index.js"]
