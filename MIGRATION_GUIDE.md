# Инструкция по применению миграции для поля isGuest

## Способ 1: Автоматическая синхронизация (уже включена)

Если в `backend/src/config/database.config.ts` установлено `synchronize: true`, то TypeORM автоматически добавит поле `isGuest` при следующем запуске backend.

Просто перезапустите backend:
```bash
docker-compose restart backend
```

## Способ 2: Ручное применение SQL миграции

Если хотите применить миграцию вручную:

```bash
# Подключиться к контейнеру PostgreSQL
docker-compose exec postgres psql -U nardi -d nardi_db

# В консоли psql выполнить:
\i /path/to/backend/migrations/add-is-guest-field.sql

# Или скопировать содержимое файла и выполнить вручную:
```

Или выполнить SQL напрямую:

```bash
docker-compose exec -T postgres psql -U nardi -d nardi_db <<EOF
-- Добавляем поле isGuest если его еще нет
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'isGuest'
    ) THEN
        ALTER TABLE users ADD COLUMN "isGuest" BOOLEAN DEFAULT false;
        UPDATE users SET "isGuest" = false WHERE "isGuest" IS NULL;
    END IF;
END \$\$;

-- Создаем индекс для быстрого поиска гостевых пользователей
CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users("isGuest") WHERE "isGuest" = true;
EOF
```

## Способ 3: Через TypeORM CLI (если настроено)

```bash
docker-compose exec backend npm run migration:run
```

## Проверка применения миграции

После применения миграции проверьте:

```bash
docker-compose exec postgres psql -U nardi -d nardi_db -c "\d users"
```

Должно быть видно поле `isGuest` типа `boolean`.

## Откат миграции (если нужно)

```bash
docker-compose exec -T postgres psql -U nardi -d nardi_db <<EOF
ALTER TABLE users DROP COLUMN IF EXISTS "isGuest";
DROP INDEX IF EXISTS idx_users_is_guest;
EOF
```

