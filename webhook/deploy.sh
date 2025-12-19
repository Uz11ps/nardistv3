#!/bin/bash

# GitHub Webhook скрипт для автоматического деплоя
# Используйте этот скрипт с GitHub Webhook или простым HTTP сервером

set -e

# Цвета для логов
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Логирование
LOG_FILE="/var/log/nardist-deploy.log"
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "${YELLOW}🚀 Начало автоматического деплоя...${NC}"

# Путь к проекту на сервере
PROJECT_PATH="${DEPLOY_PATH:-/var/www/nardistv3}"

# Переходим в директорию проекта
if [ ! -d "$PROJECT_PATH" ]; then
    log "${RED}❌ Директория проекта не найдена: $PROJECT_PATH${NC}"
    exit 1
fi

cd "$PROJECT_PATH"

# Проверка наличия docker-compose.yml
if [ ! -f "docker-compose.yml" ]; then
    log "${RED}❌ docker-compose.yml не найден!${NC}"
    exit 1
fi

# Обновление кода из GitHub
log "${YELLOW}📦 Обновление кода из GitHub...${NC}"
git fetch origin

# Проверка изменений
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "${YELLOW}ℹ️  Нет изменений для деплоя${NC}"
    exit 0
fi

# Переключение на последнюю версию
git reset --hard origin/main
git clean -fd

log "${GREEN}✅ Код обновлен${NC}"

# Остановка контейнеров
log "${YELLOW}🛑 Остановка контейнеров...${NC}"
docker-compose down || true

# Пересборка и запуск
log "${YELLOW}🔨 Пересборка и запуск контейнеров...${NC}"
docker-compose up -d --build

# Ожидание запуска
log "${YELLOW}⏳ Ожидание запуска сервисов (15 секунд)...${NC}"
sleep 15

# Проверка статуса
log "${YELLOW}📊 Проверка статуса контейнеров...${NC}"
docker-compose ps

# Проверка логов на ошибки
log "${YELLOW}📝 Проверка логов...${NC}"
if docker-compose logs --tail=50 backend | grep -i "error\|fatal\|exception" > /dev/null; then
    log "${RED}⚠️  Обнаружены ошибки в логах backend!${NC}"
    docker-compose logs --tail=50 backend | grep -i "error\|fatal\|exception"
fi

if docker-compose logs --tail=50 frontend | grep -i "error\|fatal\|exception" > /dev/null; then
    log "${RED}⚠️  Обнаружены ошибки в логах frontend!${NC}"
    docker-compose logs --tail=50 frontend | grep -i "error\|fatal\|exception"
fi

# Очистка старых образов (опционально)
log "${YELLOW}🧹 Очистка неиспользуемых образов...${NC}"
docker image prune -f > /dev/null 2>&1 || true

log "${GREEN}✅ Деплой успешно завершен!${NC}"
exit 0

