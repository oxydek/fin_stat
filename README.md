# FinStat — приложение для учета финансов

Современное веб‑приложение для управления личными финансами с акцентом на удобный интерфейс и простоту. Фронтенд — SPA на React/Vite, бэкенд — Express API, база данных — PostgreSQL (Prisma ORM). В production сборке SPA обслуживается через Nginx и проксирует API по пути `/api`.

## 🚀 Возможности

- 💳 Управление счетами (карты, наличные, вклады, криптовалюты)
- 🎯 Цели накоплений (с прогрессом и взносами)
- 📊 Базовая статистика расходов/доходов
- 📄 Импорт файлов (CSV/XLSX)
- 🌙 Темная/светлая тема

## 🛠 Технологии

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js (Express)
- **Database**: PostgreSQL (Prisma ORM)
- **Runtime**: Nginx (SPA + reverse proxy `/api`)
- **Containerization**: Docker, Docker Compose

## 🐳 Быстрый старт (Docker)

```bash
# Клонировать репозиторий
git clone <repository-url>
cd fin_stat

# Сборка и запуск всего стека
docker-compose up -d --build

# Открыть приложение
# SPA: http://localhost:3000
# API: доступно через прокси по пути /api, например http://localhost:3000/api/health
```

### Сервисы в docker-compose

- `finstat-app`: Nginx, отдает собранный фронтенд и проксирует `/api` → `finstat-api:4000`
- `finstat-api`: Express API на порту 4000; при старте выполняет `prisma generate` и `prisma db push`
- `finstat-db`: PostgreSQL 15 с кредами по умолчанию (`finstat/finstat`)

### Переменные окружения

- `DATABASE_URL`: используется API для подключения к БД (по умолчанию `postgresql://finstat:finstat@db:5432/finstat` из `docker-compose.yml`)
- `NODE_ENV`: `production` в контейнерах

### Volumes

- `postgres_data` — данные PostgreSQL

## 💻 Локальная разработка

Быстрее всего разрабатывать, запустив БД и API через Docker, а фронтенд — локально с Vite (HMR).

```bash
# Установить зависимости фронтенда
npm ci

# Запустить БД и API в Docker (без фронтенда)
docker-compose up -d db api

# Запустить фронтенд с HMR (локально)
npx vite --port 5173
# Открыть: http://localhost:5173
```

Примечание:
- Dev‑сервер Vite по умолчанию отправляет запросы на тот же origin. Для работы с API из dev‑окружения:
  - либо добавьте прокси в `vite.config.ts` (раздел `server.proxy`) на `http://localhost:<порт api>` и пробросьте порт API из compose,
  - либо разрабатывайте целиком в Docker (`docker-compose up -d --build`) без HMR.
- Скрипт `npm run api:dev` рассчитан на запуск внутри Docker‑сети (использует хост `db`). Для запуска API на хост‑машине потребуется собственный `DATABASE_URL`.

### Доступные npm‑скрипты

```bash
npm run build:frontend   # Сборка SPA в папку dist (Vite)
npm run api:dev         # Запуск API (требует доступного DATABASE_URL; в репо настроен на docker host 'db')
```

## 🔌 REST API (сжатая справка)

Базовый путь: `/api`

- `GET /api/health` — проверка доступности

Токен (настройки):
- `GET /api/token` — получить сохранённый токен
- `POST /api/token` — сохранить токен `{ token: string }`

Счета:
- `GET /api/accounts?includeInactive=true|false`
- `POST /api/accounts` — создать счёт `{ name, type, balance?, currency?, icon?, color? }`
- `PATCH /api/accounts/:id` — обновить поля счёта

Транзакции:
- `GET /api/transactions?accountId=...`
- `POST /api/transactions` — `{ amount:number, description?, type, date?, accountId, categoryId? }`

Цели:
- `GET /api/goals?includeInactive=true|false`
- `POST /api/goals` — `{ name, targetAmount:number, description?, targetDate?, icon?, color? }`
- `PATCH /api/goals/:id` — обновление полей цели
- `POST /api/goals/:id/contributions` — взнос в цель `{ amount:number, fromAccountId }`

## 🗃 База данных

Проект использует PostgreSQL. Схема описана в `prisma/schema.prisma` (модели: `Account`, `Category`, `Transaction`, `Goal`, `GoalContribution`, `Reminder`, `Settings`). Генерация клиента и применение схемы выполняются автоматически в контейнере API.

### Бэкап БД (PostgreSQL)

```bash
# Dump БД из контейнера PostgreSQL
docker exec finstat-db pg_dump -U finstat finstat > backup.sql
```

## 🧱 Сборка фронтенда

- Конфиг Vite: `vite.config.ts` (`base: './'`, сборка в `dist/`)
- TailwindCSS: `tailwind.config.js`, `postcss.config.js`
- В production SPA обслуживается Nginx (см. `nginx.conf`)

## 🤝 Участие

1. Форкните репозиторий
2. Создайте ветку фичи
3. Внесите изменения
4. Откройте Pull Request

## 📄 Лицензия

MIT 