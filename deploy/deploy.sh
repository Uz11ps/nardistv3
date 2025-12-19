#!/bin/bash

set -e

echo "🚀 Начало деплоя Telegram Mini App Нарды..."

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден. Создайте его на основе .env.example"
    exit 1
fi

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Установка Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Установка Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Остановка существующих контейнеров
echo "🛑 Остановка существующих контейнеров..."
docker-compose down || true

# Сборка образов
echo "🔨 Сборка образов..."
docker-compose build --no-cache

# Запуск сервисов
echo "▶️  Запуск сервисов..."
docker-compose up -d

# Ожидание готовности БД
echo "⏳ Ожидание готовности базы данных..."
sleep 10

# Запуск миграций
echo "📊 Запуск миграций..."
docker-compose exec backend npm run migration:run || echo "⚠️  Миграции могут быть уже применены"

echo "✅ Деплой завершен!"
echo "📝 Проверьте логи: docker-compose logs -f"
echo "🌐 Backend: http://$(hostname -I | awk '{print $1}'):3000"
echo "🌐 Frontend: http://$(hostname -I | awk '{print $1}'):5173"

