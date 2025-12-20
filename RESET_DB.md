# Как обнулить базу данных

## Быстрый способ (через скрипт)

```bash
chmod +x reset-db.sh
./reset-db.sh
```

## Ручной способ

### Вариант 1: Подключение к контейнеру PostgreSQL

```bash
# Подключиться к контейнеру PostgreSQL
docker-compose exec postgres psql -U nardi -d nardi_db

# В консоли psql выполнить:
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO nardi;
GRANT ALL ON SCHEMA public TO public;
\q
```

### Вариант 2: Одна команда без входа в консоль

```bash
docker-compose exec -T postgres psql -U nardi -d nardi_db <<EOF
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO nardi;
GRANT ALL ON SCHEMA public TO public;
EOF
```

### Вариант 3: Полное удаление и пересоздание контейнера (самый радикальный)

```bash
# Остановить контейнеры
docker-compose down

# Удалить volume с данными PostgreSQL
docker volume rm nardistv3_postgres_data

# Запустить заново
docker-compose up -d

# Применить миграции (если они есть)
docker-compose exec backend npm run migration:run
```

## Переменные окружения

По умолчанию используются:
- **USER:** `nardi`
- **DATABASE:** `nardi_db`
- **CONTAINER:** `nardi_postgres`

Если используются другие значения, замените их в командах выше.

## После очистки

После очистки базы данных нужно применить миграции:

```bash
docker-compose exec backend npm run migration:run
```

Или просто перезапустить контейнер backend, если миграции применяются автоматически при старте.

