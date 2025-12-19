# Быстрый старт

## Локальная разработка

1. Установите зависимости:
```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Запустите через Docker:
```bash
docker-compose up -d
```

3. Backend будет доступен на http://localhost:3000
4. Frontend будет доступен на http://localhost:5173

## Настройка переменных окружения

Создайте `.env` файл в корне проекта:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_SECRET_KEY=your_secret_key
POSTGRES_PASSWORD=secure_password
JWT_SECRET=your_jwt_secret_min_32_chars
DOMAIN=localhost
```

## Первый запуск

1. Запустите миграции (если нужно):
```bash
docker-compose exec backend npm run migration:run
```

2. Инициализируйте скины:
```bash
docker-compose exec backend npm run start:dev
# В консоли выполните инициализацию скинов через API или создайте seed скрипт
```

## Проверка работы

- Health check: http://localhost:3000/health
- API документация: http://localhost:3000 (если настроена)

