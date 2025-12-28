#!/bin/bash

# Скрипт для миграции старых значений payment method в БД
# Обновляет 'ton' и 'usdt' на 'telegram_stars' или 'tribute'

set -e

echo "🔄 Миграция payment methods в базе данных..."

POSTGRES_USER=${POSTGRES_USER:-nardi}
POSTGRES_DB=${POSTGRES_DB:-nardi_db}
CONTAINER_NAME=${CONTAINER_NAME:-nardi_postgres}

# Ждем пока PostgreSQL запустится
echo "⏳ Ожидание запуска PostgreSQL..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; then
        echo "✅ PostgreSQL готов!"
        break
    fi
    echo "   Попытка $i/30..."
    sleep 1
done

echo "📊 Обновление старых значений method..."

# Обновляем все записи с method = 'ton' на 'telegram_stars'
docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOF
-- Обновляем все записи с method = 'ton' на 'telegram_stars'
UPDATE payment_transactions 
SET method = 'telegram_stars' 
WHERE method = 'ton';

-- Обновляем все записи с method = 'usdt' на 'telegram_stars'
UPDATE payment_transactions 
SET method = 'telegram_stars' 
WHERE method = 'usdt';

-- Проверяем результат
SELECT method, COUNT(*) as count 
FROM payment_transactions 
GROUP BY method;
EOF

echo "✅ Миграция завершена!"
echo "🔄 Теперь можно перезапустить backend для синхронизации схемы"

