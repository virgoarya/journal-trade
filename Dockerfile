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

WORKDIR /app/server

# Copy server package files FIRST
COPY server/package*.json ./

# Install only production deps (no postinstall scripts)
RUN npm ci --only=production --ignore-scripts

# Copy built server files from builder
COPY --from=builder /app/server/dist ./dist

# Copy entire frontend build (including .next directory with all required files)
COPY --from=builder /app/frontend/.next ./dist/_next/
COPY --from=builder /app/frontend/public ./dist/public/
COPY --from=builder /app/frontend/next.config.ts ./dist/
COPY --from=builder /app/frontend/tsconfig.json ./dist/
COPY --from=builder /app/frontend/package.json ./dist/

# Expose port
EXPOSE 5000

# Start server from /app/server directory
WORKDIR /app/server
CMD ["node", "dist/index.js"]
