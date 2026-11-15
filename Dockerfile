# ==============================================================================
# ASTRA – Astronaut Health Intelligence System
# Production Dockerfile (Single-Container / Edge Web + Ground Bridge)
# ==============================================================================
FROM node:20-alpine AS runner

# Install wget for health checks
RUN apk add --no-cache wget

WORKDIR /app

# Ensure production environment
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

# Copy application manifests and scripts
COPY package.json server.mjs ./
COPY web/ ./web/

# Run as non-root user for container security
USER node

# Expose default application port
EXPOSE 8080

# Container healthcheck for orchestrators (Kubernetes, AWS ECS, GCP Cloud Run, Docker Swarm)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

# Launch application
CMD ["node", "server.mjs"]
