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

# Copy server package files
COPY --from=builder /app/server/package*.json ./server/

# Install only production deps inside server directory
RUN cd server && npm ci --only=production --ignore-scripts

# Copy built server files
COPY --from=builder /app/server/dist ./server/dist

# Copy entire frontend directory (with .next, public, app, etc.)
COPY --from=builder /app/frontend ./server/dist/frontend

# Expose port
EXPOSE 5000

CMD ["node", "server/dist/index.js"]
