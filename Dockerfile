# ============================
# 1️⃣ Build Stage
# ============================
FROM node:24.16.0-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy only package files first (for better caching)
COPY package*.json ./

RUN npm ci

# Copy source code
COPY . .

# Build TypeScript and copy static files
RUN npm run build

# ============================
# 2️⃣ Production Stage
# ============================
FROM node:24.16.0-alpine AS production

WORKDIR /app

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --no-audit && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist/

# Create writable dirs with correct ownership
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Use non-root user
USER nodejs

# Expose application port
EXPOSE 8020

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run app
CMD ["npm", "start"]
