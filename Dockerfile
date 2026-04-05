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

# Build frontend and backend
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
