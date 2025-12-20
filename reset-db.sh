#!/bin/bash

# Скрипт для полной очистки базы данных

set -e

echo "⚠️  ВНИМАНИЕ: Это удалит ВСЕ данные из базы данных!"
read -p "Вы уверены? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Операция отменена"
    exit 1
fi

# Получаем переменные окружения из docker-compose
POSTGRES_USER=${POSTGRES_USER:-nardi}
POSTGRES_DB=${POSTGRES_DB:-nardi_db}
CONTAINER_NAME=${CONTAINER_NAME:-nardi_postgres}

echo "🔄 Подключение к базе данных..."

# Подключаемся к контейнеру PostgreSQL и выполняем команды
docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOF
-- Отключаем все активные соединения
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$POSTGRES_DB'
  AND pid <> pg_backend_pid();

-- Удаляем схему public
DROP SCHEMA IF EXISTS public CASCADE;

-- Создаем схему public заново
CREATE SCHEMA public;

-- Восстанавливаем права доступа
GRANT ALL ON SCHEMA public TO $POSTGRES_USER;
GRANT ALL ON SCHEMA public TO public;
EOF

echo "✅ База данных очищена!"
echo "🔄 Теперь нужно применить миграции:"
echo "   docker-compose exec backend npm run migration:run"
echo "   или перезапустить контейнер backend"

