# ---------- Builder stage: build SPA with Vite ----------
FROM node:20-alpine AS builder

# System deps for building native modules if needed
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install full dependencies (include dev for build tools like vite)
COPY package.json ./
RUN npm install

# Copy sources
COPY . .

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