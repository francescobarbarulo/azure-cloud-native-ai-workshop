# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Runtime stage
FROM nginx:alpine

WORKDIR /app

# Copy nginx config for SPA routing
# COPY nginx.conf /etc/nginx
COPY nginx.template.conf /etc/nginx/
COPY docker-entrypoint.sh /usr/local/bin/

# Make the script executable
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy built app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -s http://localhost:8080/ || exit 1

# Use the custom script as the entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Run Nginx
CMD ["nginx", "-g", "daemon off;"]
