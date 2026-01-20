# Build stage for client
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install dependencies
RUN npm ci

# Copy client source
COPY client/ ./

# Build client
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy server package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Remove build dependencies
RUN apk del python3 make g++

# Copy server source
COPY server/ ./server/

# Copy built client from builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create data directory
RUN mkdir -p /app/data/uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/deck.db
ENV UPLOAD_PATH=/app/data/uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/me || exit 1

# Start server
CMD ["node", "server/index.js"]
