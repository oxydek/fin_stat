# FinStat - Приложение для учета финансов

Современное приложение для управления личными финансами с красивым iOS-стилем интерфейсом.

## 🚀 Функции

- 💳 **Управление счетами** - Карты, наличные, вклады, криптовалюты
- 🎯 **Цели накоплений** - С прогресс-барами и уведомлениями
- 📊 **Статистика и аналитика** - Графики трат по категориям
- 📄 **Импорт выписок** - CSV/Excel файлы из банков
- ⏰ **Напоминания** - О целях и платежах
- 🌙 **Темная/светлая тема** - Адаптивный дизайн
- 📱 **PWA готовность** - Для будущего мобильного приложения

## 🛠 Технологии

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Desktop**: Electron
- **Database**: SQLite (Prisma ORM)
- **Containerization**: Docker, Docker Compose
- **State Management**: React hooks
- **File Processing**: PapaParse, XLSX

## 🐳 Docker развертывание

### Production (рекомендуется)

```bash
# Клонируем репозиторий
git clone <repository-url>
cd fin_stat

# Запускаем production версию
docker-compose up -d

# Приложение доступно на http://localhost:3000
```

### Development

```bash
# Запуск в режиме разработки с hot reload
docker-compose -f docker-compose.dev.yml up -d

# Приложение доступно на http://localhost:5173
# Mailhog (тестирование email) на http://localhost:8025
```

### Отдельные сервисы

```bash
# Только основное приложение
docker-compose up finstat-app

# С базой данных PostgreSQL
docker-compose up finstat-app postgres

# Полный стек (приложение + БД + Redis + Proxy)
docker-compose up
```

## 💻 Локальная разработка

### Требования

- Node.js 18+
- npm или yarn

### Установка

```bash
# Установка зависимостей
npm install

# Настройка базы данных
npx prisma generate
npx prisma db push

# Запуск в режиме разработки
npm run dev
```

### Доступные команды

```bash
npm run dev          # Запуск с Electron
npm run build        # Production сборка
npm run preview      # Предпросмотр сборки
npm run start        # Запуск только Electron
```

## 🗃 База данных

Приложение использует SQLite для локального хранения с возможностью миграции на PostgreSQL в production.

### Модели данных

- **Account** - Счета пользователя
- **Transaction** - Транзакции и операции
- **Goal** - Цели накоплений
- **Category** - Категории трат
- **Reminder** - Напоминания и уведомления
- **Settings** - Настройки приложения

## 📊 Мониторинг

### Docker Compose включает:

- **nginx-proxy** - Балансировщик нагрузки
- **postgres** - Основная база данных
- **redis** - Кэширование и сессии
- **mailhog** - Тестирование email (dev)

### Логи

```bash
# Просмотр логов приложения
docker-compose logs -f finstat-app

# Логи всех сервисов
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs postgres
```

## 🔧 Конфигурация

### Environment переменные

```bash
# Production
NODE_ENV=production
DATABASE_URL=file:./dev.db

# Development
NODE_ENV=development
DATABASE_URL=file:./dev.db
VITE_HMR_HOST=localhost
```

### Volumes

- `finstat_data` - Данные приложения
- `postgres_data` - База данных PostgreSQL
- `redis_data` - Данные Redis
- `nginx_logs` - Логи Nginx

## 🚀 Deployment

### Production сборка

```bash
# Сборка и запуск
docker-compose -f docker-compose.yml up -d --build

# Обновление приложения
docker-compose pull
docker-compose up -d --build finstat-app
```

### Backup базы данных

```bash
# SQLite backup
docker exec finstat-app cp /app/dev.db /app/data/backup_$(date +%Y%m%d).db

# PostgreSQL backup
docker exec finstat-postgres pg_dump -U finstat_user finstat > backup.sql
```

## 📱 PWA (будущее)

Приложение готово для преобразования в PWA:
- Service Worker (запланировано)
- Manifest файл (запланировано)
- Оффлайн режим (запланировано)
- Push уведомления (запланировано)

## 🤝 Участие в разработке

1. Fork репозитория
2. Создайте feature branch
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

MIT License

## 🐛 Баги и предложения

Используйте GitHub Issues для сообщения о багах и предложений по улучшению. 