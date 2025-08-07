# ---------- Builder stage: build SPA with Vite ----------
FROM node:20-alpine AS builder

# System deps for building native modules if needed
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install deps (use lockfile for caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy only necessary project files
COPY tsconfig.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY src ./src

# Build Vite app
ENV NODE_ENV=production
RUN npx vite build

# ---------- Production stage: serve via nginx ----------
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 