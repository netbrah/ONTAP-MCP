# NetApp ONTAP Key Manager MCP Server - Docker Image
# Simplified FastMCP implementation for key manager commands only
# Multi-stage build for minimal production image size

ARG NODE_VERSION=20-alpine

# ============================================================================
# Stage 1: Builder - Compile TypeScript and install dependencies
# ============================================================================
FROM node:${NODE_VERSION} AS builder

WORKDIR /build

# Copy package files for dependency installation
COPY package*.json tsconfig.json ./

# Install ALL dependencies (including devDependencies for TypeScript compilation)
RUN npm ci --production=false

# Copy source code
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# ============================================================================
# Stage 2: Runtime - Minimal production image
# ============================================================================
FROM node:${NODE_VERSION}

# Metadata labels
LABEL maintainer="NetApp ONTAP Key Manager MCP"
LABEL description="NetApp ONTAP Key Manager MCP Server - FastMCP for Key Management"
LABEL version="2.0.0"

# Install curl for health checks (if needed, alpine node image may already have it)
# Commenting out to avoid network dependency issues during build
# RUN apk add --no-cache curl || echo "curl may already be installed"

WORKDIR /opt/ontap-mcp

# Copy compiled JavaScript and production dependencies from builder
COPY --from=builder /build/build ./build
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3000

# Expose HTTP port (configurable via PORT env var)
EXPOSE ${PORT}

# Health check for container orchestration (Docker, Kubernetes, etc.)
# Disabled by default due to tool dependency - can be enabled in docker-compose.yml
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Run as non-root user for security
USER node

# Start MCP server with FastMCP SSE transport
# Uses PORT env var for flexibility (default: 3000)
ENTRYPOINT ["node", "build/index.js"]
