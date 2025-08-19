# FinStat — приложение для учета финансов

Современное веб‑приложение для управления личными финансами с акцентом на удобный интерфейс и простоту. Фронтенд — SPA на React/Vite, бэкенд — Express API, база данных — PostgreSQL (Prisma ORM). В production сборке SPA обслуживается через Nginx и проксирует API по пути `/api`.

## 🚀 Возможности

- 💳 Управление счетами (карты, наличные, вклады, криптовалюты)
- 🎯 Цели накоплений (с прогрессом и взносами)
- 📊 Базовая статистика расходов/доходов
- 📄 Импорт файлов (CSV/XLSX)
- 🌙 Темная/светлая тема
- PWA офлайн + пуши: Web Push по напоминаниям, биометрическая блокировка.



## 🚀 Идеи фич для FinStat
- Бюджеты по категориям: месячные лимиты, предупреждения при 80/100%, отчет по отклонениям.
- Повторяющиеся транзакции: автосписание/начисление (аренда, ЗП), связка с Reminder и лог ошибок.
- Автокатегоризация по правилам: по описанию/сумме/МСС; обучаемые правила с ручной корректировкой.
- Импорт чеков с OCR: фото/скан → позиции чека → транзакции с автокатегориями.
- Мультивалютность и FX: хранить валюту транзакции, курсы ЦБ/ECB, сверка в базовой валюте, P&L по валютам.
- Кэшфло-прогноз и “what-if”: граф на 3–6 мес., сценарии “если сократить X на 10%”.
- Округление в цели (“round-up”): округлять расходы до 10/50/100 ₽ и разницу переводить в выбранную цель.
- Долги и кредиты: график аннуитетов/диф., разбиение платежа на тело/проценты, досрочка.
- Совместные бюджеты: шаринг дома/семьи, роли (владелец/редактор/читатель), аудит действий.
- Инвестиции+: доходность портфеля/бумаг, дивидендный календарь, аллокация, ребаланс-алерты.
- Аналитика подписок: авто‑поиск регулярных списаний, прогноз затрат, напоминания о продлении.
- Кастомный дашборд: виджеты (цели, бюджеты, подписки, долг), перетаскивание, быстрые действия.
- Экспорт/бэкапы: авто‑бэкап в Google Drive/WebDAV, версии, шифрование.
- Налоги: учет вычетов/дивидендов, дедлайны, черновик отчетов по операциям.
- Интеграции: импорт из e‑mail/банковских CSV/XLSX по шаблонам, вебхуки на события.
- Метрики финансового здоровья: savings rate, runway, индекс диверсификации.

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
# SPA: https://finstat.test
# API: доступно через прокси по пути /api, например https://finstat.test/api/health
```

### Сервисы в docker-compose

- `finstat-app`: Nginx, отдает собранный фронтенд и проксирует `/api` → `finstat-api:4000` (порты: 80 и 443)
- `finstat-api`: Express API на порту 4000; при старте выполняет `prisma generate` и `prisma db push`
- `finstat-db`: PostgreSQL 15 с кредами по умолчанию (`finstat/finstat`)

### Переменные окружения

- `DATABASE_URL`: используется API для подключения к БД (по умолчанию `postgresql://finstat:finstat@db:5432/finstat` из `docker-compose.yml`)
- `NODE_ENV`: `production` в контейнерах

### Volumes

- `postgres_data` — данные PostgreSQL

## 🔒 TLS и сертификаты

Для корректной работы на iPhone/Safari используйте доверенный сертификат.

- Ожидаемые файлы и путь:
  - `./certs/server.crt` — X.509 сертификат с полной цепочкой (fullchain)
  - `./certs/server.key` — приватный ключ
  - Папка `./certs` уже монтируется в контейнер по пути `/etc/nginx/certs` (см. `docker-compose.yml`).

### Домен и DNS
- Используется домен `finstat.test`. Добавьте в hosts или локальный DNS запись, указывающую на IP сервера.
  - Windows (от имени администратора): откройте `C:\Windows\System32\drivers\etc\hosts` и добавьте строку: `<ВАШ_IP> finstat.test`
  - Или настройте запись в локальном DNS/роутере.
- Для iPhone важно доменное имя, иначе WebAuthn/FaceID может не работать.

### Вариант: локально через mkcert (для тестов в LAN)
1) Установите mkcert (Windows):
   ```powershell
   choco install mkcert -y
   mkcert -install
   mkcert -CAROOT
   ```
2) Сгенерируйте сертификат прямо в папку `certs` для домена `finstat.test` (при желании добавьте ваш IP как SAN):
   ```powershell
   mkdir certs 2>$null
   mkcert -cert-file certs/server.crt -key-file certs/server.key finstat.test 192.168.88.156
   ```
3) Установите корневой сертификат mkcert на iPhone:
   - Отправьте файл из папки CAROOT на устройство, установите профиль
   - Включите полное доверие: Настройки → Основные → Об этом устройстве → Доверие сертификатам
4) Пересоберите/перезапустите контейнеры:
   ```powershell
   docker-compose up -d --force-recreate
   ```

#### Какой файл устанавливать на iPhone
- На iPhone устанавливается и доверяется ТОЛЬКО корневой сертификат mkcert (Root CA), а не серверные `server.crt`/`server.key`.
- Где взять корневой сертификат mkcert:
  ```powershell
  mkcert -CAROOT
  ```
  В открывшейся папке найдите файл `rootCA.pem`.
- Для удобства iOS можно переименовать `rootCA.pem` в `rootCA.cer` или сконвертировать в DER:
  ```powershell
  openssl x509 -in rootCA.pem -out rootCA.cer -outform der
  ```
- Передайте файл на устройство (AirDrop/Почта/Файлы), установите профиль и включите доверие: Настройки → Основные → Об этом устройстве → Доверие сертификатам (включить «Полное доверие» для установленного корня).
- Файлы сервера (`certs/server.crt` и `certs/server.key`) используются ТОЛЬКО на сервере. Приватный ключ никому не передавайте.

### Если у вас уже есть private_key.pem и public_key.pem
- Откройте `public_key.pem` и проверьте первую строку:
  - Если там `-----BEGIN CERTIFICATE-----`, это сертификат — можно переименовать файлы и использовать:
    ```powershell
    mkdir certs 2>$null
    copy public_key.pem certs/server.crt
    copy private_key.pem certs/server.key
    ```
  - Если там `-----BEGIN PUBLIC KEY-----`, это не сертификат X.509. Такой файл Nginx не примет. Выпустите сертификат заново через mkcert:
    ```powershell
    mkcert -install
    mkcert -cert-file certs/server.crt -key-file certs/server.key <ваш-домен-или-IP> localhost
    ```

### Production: Let's Encrypt
- Используйте валидный домен и получите файлы от LE:
  - `fullchain.pem` → положите/скопируйте как `certs/server.crt`
  - `privkey.pem`   → положите/скопируйте как `certs/server.key`
- Либо адаптируйте пути в `nginx.conf` под ваши имена файлов.
- Убедитесь, что открыт 443 и включён редирект 80 → 443 (в конфиге уже настроено, без указания нестандартного порта).

### Временный доступ по HTTP
- Для быстрой проверки UI можно открыть приложение по `http://finstat.test` (без HTTPS). В этом режиме PWA‑функции, требующие HTTPS (например, Push), работать не будут. Чтобы вернуть принудительный HTTPS, оставьте редирект с 80 на 443 в `nginx.conf`.

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