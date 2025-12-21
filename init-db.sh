#!/bin/bash

# Скрипт для создания базы данных, если её нет

set -e

POSTGRES_USER=${POSTGRES_USER:-nardi}
POSTGRES_DB=${POSTGRES_DB:-nardi_db}
CONTAINER_NAME=${CONTAINER_NAME:-nardi_postgres}

echo "🔍 Проверка существования базы данных $POSTGRES_DB..."

# Проверяем, существует ли база данных
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

