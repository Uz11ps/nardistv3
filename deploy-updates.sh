#!/bin/bash

# Скрипт для деплоя обновлений на сервер

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"
LOCAL_PATH="."

echo "🚀 Начинаем деплой обновлений..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
info() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Проверка подключения к серверу
info "Проверка подключения к серверу..."
ssh -o ConnectTimeout=5 $SERVER "echo 'Подключение успешно'" || {
    error "Не удалось подключиться к серверу"
    exit 1
}

# Создание резервной копии на сервере
info "Создание резервной копии..."
ssh $SERVER "cd $SERVER_PATH && tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz backend/src frontend/src 2>/dev/null || true"

# Загрузка обновленных файлов
info "Загрузка файлов на сервер..."

# Backend файлы
info "Загрузка backend..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '*.log' \
    --exclude '.env' \
    backend/ $SERVER:$SERVER_PATH/backend/

# Frontend файлы
info "Загрузка frontend..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.env' \
    --exclude 'build' \
    frontend/ $SERVER:$SERVER_PATH/frontend/

# Конфигурационные файлы
info "Загрузка конфигурации..."
scp docker-compose.yml $SERVER:$SERVER_PATH/
scp *.md $SERVER:$SERVER_PATH/ 2>/dev/null || true

# Выполнение команд на сервере
info "Пересборка и перезапуск контейнеров..."
ssh $SERVER << 'ENDSSH'
cd /var/www/nardiphp

echo "🛑 Остановка контейнеров..."
docker-compose down

echo "🔨 Пересборка образов..."
docker-compose build --no-cache backend frontend

echo "▶️ Запуск сервисов..."
docker-compose up -d

echo "⏳ Ожидание готовности сервисов..."
sleep 10

echo "📊 Статус контейнеров:"
docker-compose ps

echo "📝 Последние логи backend:"
docker-compose logs --tail=20 backend

echo "📝 Последние логи frontend:"
docker-compose logs --tail=20 frontend
ENDSSH

info "✅ Деплой завершен!"
info "🌐 Проверьте приложение: https://nardist.site"

