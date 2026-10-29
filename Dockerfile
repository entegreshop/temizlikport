FROM node:20-alpine

WORKDIR /app

# Set production environment (Coolify default port 3000)
ENV NODE_ENV=production
ENV PORT=3000

# Copy application files
COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY admin.html ./
COPY astro.config.mjs ./
COPY tailwind.config.mjs ./
COPY images/ ./images/
COPY data/ ./data/
COPY src/ ./src/

# Ensure data and uploads directories exist inside the container
RUN mkdir -p /app/data/uploads

# Expose HTTP port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
