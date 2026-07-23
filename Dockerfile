FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install Python + MCP dependencies
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --break-system-packages --no-cache-dir finance-mcp finance-trading-ai-agents-mcp flowllm==0.2.0.8 && \
    pip3 install --break-system-packages --no-cache-dir --no-deps --force-reinstall pathspec==0.11.2

# Install server npm dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production --ignore-scripts

# Copy server TypeScript source (tsx runs directly)
COPY server/src ./server/src

CMD ["npx", "tsx", "server/src/index.ts"]
