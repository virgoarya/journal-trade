FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# (MCP servers skipped on Docker — local .venv-mcp has Python deps)

# Install server npm dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production --ignore-scripts

# Copy server TypeScript source (tsx runs directly)
COPY server/src ./server/src

CMD ["/app/server/node_modules/.bin/tsx", "/app/server/src/index.ts"]
