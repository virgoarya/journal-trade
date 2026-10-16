FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

# Install Python + MCP dependencies (Debian glibc — playwright compatible)
RUN apt-get update && apt-get install -y python3 python3-pip curl && \
    rm -rf /var/lib/apt/lists/* && \
    pip3 install --break-system-packages --no-cache-dir finance-mcp finance-trading-ai-agents-mcp flowllm==0.2.0.8 && \
    pip3 install --break-system-packages --no-cache-dir --no-deps --force-reinstall pathspec==0.11.2

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production --ignore-scripts

# Copy server TypeScript source
COPY server/src ./server/src

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["/app/server/node_modules/.bin/tsx", "/app/server/src/index.ts"]
