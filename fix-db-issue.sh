#!/bin/bash

# Скрипт для исправления проблемы с базой данных
# Создает правильную БД nardi_db если её нет

set -e

echo "🔧 Исправление проблемы с базой данных..."

POSTGRES_USER=${POSTGRES_USER:-nardi}
POSTGRES_DB=${POSTGRES_DB:-nardi_db}

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

# Проверяем, существует ли база данных nardi_db
echo "🔍 Проверка базы данных $POSTGRES_DB..."
DB_EXISTS=$(docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'" 2>/dev/null || echo "")

if [ -z "$DB_EXISTS" ] || [ "$DB_EXISTS" != "1" ]; then
    echo "📦 База данных $POSTGRES_DB не существует, создаём..."
    docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres <<EOF
CREATE DATABASE $POSTGRES_DB;
GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;
EOF
    echo "✅ База данных $POSTGRES_DB создана!"
else
    echo "✅ База данных $POSTGRES_DB уже существует"
fi

echo "✅ Проверка завершена!"
