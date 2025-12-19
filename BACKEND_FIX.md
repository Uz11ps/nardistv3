# Исправление проблемы с Backend

## Проблема

Backend контейнер постоянно перезапускается (`Restarting (1)`), что означает что процесс падает с ошибкой.

## Диагностика

Выполните на сервере:

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp

# Посмотреть логи ошибок
docker-compose logs --tail=100 backend | grep -i error

# Или все логи
docker-compose logs --tail=100 backend
```

## Возможные причины и решения

### 1. Ошибка подключения к БД

**Симптомы:** `ECONNREFUSED`, `Connection refused`, `Unable to connect to database`

**Решение:**
```bash
# Проверить что PostgreSQL запущен
docker-compose ps postgres

# Проверить переменные окружения
docker-compose exec backend env | grep POSTGRES

# Если переменные неверные, обновите .env файл
nano .env
# Убедитесь что:
# POSTGRES_HOST=postgres (не localhost!)
# POSTGRES_USER=nardi
# POSTGRES_PASSWORD=ваш_пароль
# POSTGRES_DB=nardi_db

# Перезапустить
docker-compose restart backend
```

### 2. Ошибка подключения к Redis

**Симптомы:** `ECONNREFUSED` к Redis

**Решение:**
```bash
# Проверить Redis
docker-compose ps redis

# Проверить переменные
docker-compose exec backend env | grep REDIS

# Исправить в .env если нужно:
# REDIS_HOST=redis (не localhost!)
# REDIS_PORT=6379
```

### 3. Отсутствует dist/main.js

**Симптомы:** `Cannot find module`, `ENOENT`

**Решение:**
```bash
# Проверить что файлы собраны
docker-compose exec backend ls -la /app/dist/

# Если файлов нет, пересобрать
docker-compose build --no-cache backend
docker-compose up -d backend
```

### 4. Ошибка в коде (TypeScript/JavaScript)

**Симптомы:** `SyntaxError`, `TypeError`, `ReferenceError`

**Решение:**
```bash
# Посмотреть полные логи
docker-compose logs backend

# Проверить код на ошибки локально
cd backend
npm run build

# Если есть ошибки, исправить и закоммитить
git add .
git commit -m "Fix backend errors"
git push origin main

# На сервере обновить
cd /var/www/nardiphp
git pull origin main
docker-compose build --no-cache backend
docker-compose up -d backend
```

### 5. Отсутствуют переменные окружения

**Симптомы:** `undefined`, `process.env.XXX is undefined`

**Решение:**
```bash
# Проверить .env файл
cat .env

# Убедитесь что все переменные заполнены:
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_SECRET_KEY
# - JWT_SECRET
# - POSTGRES_PASSWORD
# и т.д.

# Перезапустить
docker-compose restart backend
```

## Быстрое исправление

Если не знаете причину, выполните полную пересборку:

```bash
cd /var/www/nardiphp

# Остановить все
docker-compose down

# Обновить код
git pull origin main

# Пересобрать backend
docker-compose build --no-cache backend

# Запустить
docker-compose up -d

# Проверить логи
docker-compose logs --tail=50 backend
```

## Проверка после исправления

```bash
# Статус должен быть "Up" (не "Restarting")
docker-compose ps backend

# Backend должен отвечать
curl http://localhost:3000/health

# Должен вернуть JSON с статусом
```

## Если ничего не помогает

1. Проверьте логи полностью:
```bash
docker-compose logs backend > backend.log
cat backend.log
```

2. Попробуйте запустить backend в интерактивном режиме:
```bash
docker-compose run --rm backend sh
# Внутри контейнера:
cd /app
node dist/main.js
# Посмотрите ошибку
```

3. Проверьте что все зависимости установлены:
```bash
docker-compose exec backend npm list --depth=0
```

