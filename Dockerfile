# Базовый образ для сборки
FROM node:18-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаем переменную окружения для базы данных
ENV DATABASE_URL="file:./dev.db"

# Генерируем Prisma Client
RUN npx prisma generate

# Создаем базу данных и применяем миграции
RUN npx prisma db push

# Собираем приложение для production
RUN npm run build

# Production образ
FROM nginx:alpine AS production

# Копируем собранное приложение из builder этапа
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Открываем порт 80
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"] 