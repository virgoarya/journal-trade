# Build stage
FROM node:20-alpine AS builder

# Install frontend dependencies
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

# Copy all source
WORKDIR /app
COPY server/ ./server/
COPY frontend/ ./frontend/

# Build frontend and backend (production)
ENV NODE_ENV=production
RUN cd server && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server package files FIRST (from builder stage location)
COPY --from=builder /app/server/package*.json ./server/

# Install only production deps (no postinstall scripts)
RUN npm ci --only=production --ignore-scripts --prefix server

# Copy built server files from builder
COPY --from=builder /app/server/dist ./server/dist

# Copy entire frontend build (including .next directory with all required files)
COPY --from=builder /app/frontend/.next ./server/dist/_next/
COPY --from=builder /app/frontend/public ./server/dist/public/
COPY --from=builder /app/frontend/next.config.ts ./server/dist/
COPY --from=builder /app/frontend/tsconfig.json ./server/dist/
COPY --from=builder /app/frontend/package.json ./server/dist/

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server/dist/index.js"]
