#!/bin/bash

# Скрипт для выполнения на сервере после загрузки файлов

cd /var/www/nardiphp

echo "🔧 Настройка сервера..."

# Установка Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Установка Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Установка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Установка Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Проверка .env файла
if [ ! -f .env ]; then
    echo "⚠️  Создание .env файла..."
    cat > .env << 'EOF'
TELEGRAM_BOT_TOKEN=8283196243:AAHScPWoLwr-UtrT71YXf0y8XKim_slIg5w
TELEGRAM_SECRET_KEY=change_this_after_bot_setup
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=nardi
POSTGRES_PASSWORD=NardiSecure2024!Pass
POSTGRES_DB=nardi_db
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=NardiJWTSecretKey2024!ChangeThisInProductionMin32Chars
NODE_ENV=production
BACKEND_PORT=3000
FRONTEND_PORT=5173
DOMAIN=nardist.site
VITE_API_URL=https://nardist.site/api
VITE_WS_URL=wss://nardist.site
VITE_TELEGRAM_BOT_NAME=nardist_bot
EOF
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
sleep 15

echo "✅ Деплой завершен!"
echo "📝 Проверьте логи: docker-compose logs -f"
echo "🌐 Backend: http://nardist.site:3000/health"
echo "🌐 Frontend: http://nardist.site:5173"

