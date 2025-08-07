# ---------- Builder stage: build SPA with Vite ----------
FROM node:20-alpine AS builder

# System deps for building native modules if needed
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
# Use npm ci if lockfile exists, otherwise npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy sources
COPY . .

# Build Vite app
ENV NODE_ENV=production
RUN npm run build

# ---------- Production stage: serve via nginx ----------
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 