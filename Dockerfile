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
COPY public ./public

# Build Vite app
ENV NODE_ENV=production
RUN npx vite build

# ---------- Production stage: serve via nginx ----------
FROM nginx:alpine AS production

# Install openssl and generate self-signed cert
ARG SSL_IP=192.168.88.156
ARG SSL_DNS=localhost
ENV SSL_IP=${SSL_IP}
ENV SSL_DNS=${SSL_DNS}
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    cp /etc/ssl/openssl.cnf /tmp/openssl.cnf && \
    echo "" >> /tmp/openssl.cnf && \
    echo "[v3_req]" >> /tmp/openssl.cnf && \
    echo "subjectAltName=@alt_names" >> /tmp/openssl.cnf && \
    echo "[alt_names]" >> /tmp/openssl.cnf && \
    echo "IP.1=${SSL_IP}" >> /tmp/openssl.cnf && \
    echo "DNS.1=${SSL_DNS}" >> /tmp/openssl.cnf && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -subj "/CN=${SSL_IP}" \
      -keyout /etc/nginx/certs/server.key \
      -out /etc/nginx/certs/server.crt \
      -extensions v3_req -config /tmp/openssl.cnf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"] 