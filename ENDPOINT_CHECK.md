# Проверка эндпоинтов API

## Скрипты проверки

Созданы два скрипта для проверки работоспособности API эндпоинтов:

### 1. `check-endpoints.sh` - Базовый скрипт

Быстрая проверка основных эндпоинтов с кратким выводом.

**Использование:**
```bash
# Проверка production API
./check-endpoints.sh

# Проверка локального API
API_URL=http://localhost:3000/api ./check-endpoints.sh

# Проверка с кастомными учетными данными
ADMIN_LOGIN=admin ADMIN_PASSWORD=pass123 ./check-endpoints.sh
```

### 2. `check-endpoints-detailed.sh` - Детальный скрипт

Подробная проверка с выводом времени ответа и превью ответов.

**Использование:**
```bash
# Проверка production API
./check-endpoints-detailed.sh

# Проверка локального API
API_URL=http://localhost:3000/api ./check-endpoints-detailed.sh
```

## Что проверяется

### Базовые эндпоинты (без авторизации)
- `GET /api/health` - Health check
- `GET /api/` - Root endpoint
- `GET /api/skins` - Список всех скинов

### Админ-эндпоинты (требуют админ-токен)
- `POST /api/admin/login` - Авторизация админа
- `GET /api/admin/stats` - Статистика
- `GET /api/admin/users` - Список пользователей
- `GET /api/admin/games` - Список игр
- `GET /api/admin/tournaments` - Список турниров
- `GET /api/admin/academy` - Список материалов
- `GET /api/admin/city/rewards` - Настройки города

## Переменные окружения

- `API_URL` - URL API (по умолчанию: `https://nardist.site/api`)
- `ADMIN_LOGIN` - Логин админа (по умолчанию: `123`)
- `ADMIN_PASSWORD` - Пароль админа (по умолчанию: `123123`)

## Примеры использования

### Проверка на сервере
```bash
cd /var/www/nardiphp
chmod +x check-endpoints.sh check-endpoints-detailed.sh
./check-endpoints.sh
```

### Проверка локально
```bash
API_URL=http://localhost:3000/api ./check-endpoints-detailed.sh
```

### Проверка после деплоя
```bash
cd /var/www/nardiphp
git pull origin main
docker-compose up -d
sleep 10  # Ждем запуска контейнеров
./check-endpoints.sh
```

## Интерпретация результатов

- ✅ **Успешно** - Эндпоинт отвечает с ожидаемым HTTP кодом
- ✗ **Ошибка** - Эндпоинт вернул неожиданный HTTP код или ошибку
- ⊘ **Пропущено** - Эндпоинт требует специальных данных (например, Telegram initData)

## Все доступные эндпоинты

### Публичные
- `GET /api/health`
- `GET /api/`
- `GET /api/skins`
- `POST /api/auth/login` (требует Telegram initData)

### Админ
- `POST /api/admin/login`
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `POST /api/admin/users/:id/ban`
- `POST /api/admin/users/:id/unban`
- `GET /api/admin/games`
- `GET /api/admin/games/:id`
- `POST /api/admin/games/create`
- `GET /api/admin/tournaments`
- `POST /api/admin/tournaments/create`
- `GET /api/admin/academy`
- `POST /api/admin/academy/create`
- `PUT /api/admin/academy/:id`
- `DELETE /api/admin/academy/:id`
- `GET /api/admin/city/rewards`
- `PUT /api/admin/city/rewards`
- `POST /api/admin/notifications`

### Пользовательские (требуют JWT токен)
- `GET /api/auth/me`
- `GET /api/users/me`
- `PUT /api/users/me`
- `GET /api/users/:id`
- `GET /api/games/:id`
- `POST /api/games/create-bot`
- `GET /api/skins/my`
- `GET /api/skins/user/:userId`
- `POST /api/skins/select`
- `POST /api/skins/purchase`
- `GET /api/city`
- `GET /api/city/districts`
- `GET /api/city/buildings`
- `POST /api/city/buildings/:id/collect`
- `POST /api/city/districts/:id/capture`
- `POST /api/city/upgrade/:id`
- `GET /api/clans`
- `GET /api/clans/:id`
- `POST /api/clans/create`
- `POST /api/clans/:id/join`
- `GET /api/tournaments`
- `GET /api/tournaments/:id`
- `GET /api/academy`
- `GET /api/academy/:id`
- `GET /api/history`
- `GET /api/quests`
- `GET /api/ratings`
- `POST /api/payment/ton/create`
- `GET /api/payment/ton/status/:id`
- `POST /api/upload/image`

