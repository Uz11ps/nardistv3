#!/bin/bash

# Скрипт для исправления проблемы с базой данных

set -e

echo "🔧 Исправление проблемы с базой данных..."

POSTGRES_USER=${POSTGRES_USER:-nardi}
POSTGRES_DB=${POSTGRES_DB:-nardi_db}

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

# Проверяем, есть ли база данных "nardi" (без _db)
echo "🔍 Проверка базы данных nardi..."
NARDI_EXISTS=$(docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='nardi'" 2>/dev/null || echo "")

if [ "$NARDI_EXISTS" = "1" ]; then
    echo "⚠️  Найдена база данных 'nardi' (без _db). Это может быть проблемой."
    echo "💡 Убедитесь, что в .env файле указано: POSTGRES_DB=nardi_db"
fi

echo "✅ Проверка завершена!"

