#!/bin/bash

set -e

echo "🚀 Начало деплоя Telegram Mini App Нарды..."

SERVER_IP="91.229.9.80"
SERVER_USER="root"
SERVER_PASS="ksOVrfa4yeQEb3cR"
DOMAIN="nardist.site"

echo "📦 Подготовка файлов для загрузки..."

# Создаем временную директорию для исключений
cat > .deployignore << EOF
node_modules
.git
.env.local
*.log
logs
dist
build
.DS_Store
.vscode
.idea
*.swp
EOF

echo "📤 Загрузка файлов на сервер через SCP..."

# Используем sshpass для автоматической передачи пароля
if ! command -v sshpass &> /dev/null; then
    echo "⚠️  sshpass не установлен. Установите его или используйте SSH ключи."
    echo "Для Windows: choco install sshpass или используйте WSL"
    exit 1
fi

# Загружаем файлы
sshpass -p "$SERVER_PASS" scp -r -o StrictHostKeyChecking=no \
    --exclude-from=.deployignore \
    . "$SERVER_USER@$SERVER_IP:/var/www/nardiphp"

echo "✅ Файлы загружены"

echo "🔧 Подключение к серверу и настройка..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
cd /var/www/nardiphp

# Установка Docker если не установлен
if ! command -v docker &> /dev/null; then
    echo "📦 Установка Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Установка Docker Compose если не установлен
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Установка Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Остановка существующих контейнеров
echo "🛑 Остановка существующих контейнеров..."
docker-compose down || true

# Сборка и запуск
echo "🔨 Сборка образов..."
docker-compose build --no-cache

echo "▶️  Запуск сервисов..."
docker-compose up -d

# Ожидание готовности БД
echo "⏳ Ожидание готовности базы данных..."
sleep 15

echo "✅ Деплой завершен!"
echo "📝 Проверьте логи: docker-compose logs -f"
ENDSSH

rm -f .deployignore

echo ""
echo "✅ Деплой завершен!"
echo "🌐 Проверьте работу:"
echo "   - Backend: http://$DOMAIN:3000/health"
echo "   - Frontend: http://$DOMAIN:5173"

