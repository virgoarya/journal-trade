# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm ci

# Copy frontend files
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy source
COPY server/ ./server/
COPY frontend/ ./frontend/

# Build
RUN cd server && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server dependencies
COPY server/package*.json ./
# Install only production deps, ignore scripts to skip postinstall
RUN npm ci --only=production --ignore-scripts

# Copy built assets
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/next.config.ts ./frontend/
COPY --from=builder /app/frontend/tsconfig.json ./frontend/
COPY --from=builder /app/frontend/package.json ./frontend/

# Expose port
EXPOSE 5000

# Start
CMD ["node", "server/dist/index.js"]
