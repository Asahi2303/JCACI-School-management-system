# Multi-stage Dockerfile for website-backend service
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies using the backend's manifests
COPY website-backend/package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY website-backend/ ./

# Expose the port expected by server-fixed.js (defaults to 3000)
EXPOSE 3000

# Environment defaults (can be overridden by Render env)
ENV NODE_ENV=production

CMD ["node", "server-fixed.js"]
