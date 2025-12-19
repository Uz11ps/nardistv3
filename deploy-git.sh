#!/bin/bash

# Скрипт для деплоя через Git на сервере

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"
GIT_REPO="https://github.com/Uz11ps/nardistv3.git"

echo "🚀 Деплой через Git..."

ssh $SERVER << ENDSSH
cd $SERVER_PATH

# Проверка наличия Git репозитория
if [ ! -d .git ]; then
    echo "📥 Клонирование репозитория..."
    cd /var/www
    rm -rf nardiphp
    git clone $GIT_REPO nardiphp
    cd nardiphp
else
    echo "🔄 Обновление из Git..."
    git pull origin main
fi

# Проверка наличия .env
if [ ! -f .env ]; then
    echo "⚠️  Создание .env файла..."
    cat > .env << EOF
TELEGRAM_BOT_TOKEN=8283196243:AAHScPWoLwr-UtrT71YXf0y8XKim_slIg5w
TELEGRAM_SECRET_KEY=
POSTGRES_USER=nardi
POSTGRES_PASSWORD=secure_password_change
POSTGRES_DB=nardi_db
JWT_SECRET=change_this_secret_key
DOMAIN=nardist.site
VITE_API_URL=https://nardist.site
VITE_WS_URL=wss://nardist.site
VITE_TELEGRAM_BOT_NAME=
NODE_ENV=production
BACKEND_PORT=3000
FRONTEND_PORT=5173
EOF
fi

echo "🛑 Остановка контейнеров..."
docker-compose down

echo "🔨 Пересборка образов..."
docker-compose build --no-cache backend frontend

echo "▶️ Запуск сервисов..."
docker-compose up -d

echo "⏳ Ожидание готовности..."
sleep 15

echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "📝 Последние логи backend:"
docker-compose logs --tail=20 backend

echo ""
echo "📝 Последние логи frontend:"
docker-compose logs --tail=20 frontend
ENDSSH

echo ""
echo "✅ Деплой завершен!"
echo "🌐 Проверьте: https://nardist.site"

