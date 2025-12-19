#!/bin/bash

set -e

echo "🚀 Начало деплоя..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Ошибка: docker-compose.yml не найден. Убедитесь что вы в корне проекта.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Обновление кода из репозитория...${NC}"
git pull origin main

echo -e "${YELLOW}🔨 Остановка контейнеров...${NC}"
docker-compose down

echo -e "${YELLOW}🏗️  Сборка образов (без кэша для чистоты)...${NC}"
docker-compose build --no-cache

echo -e "${YELLOW}🚀 Запуск контейнеров...${NC}"
docker-compose up -d

echo -e "${YELLOW}⏳ Ожидание запуска сервисов (10 секунд)...${NC}"
sleep 10

echo -e "${YELLOW}📊 Проверка статуса контейнеров...${NC}"
docker-compose ps

echo -e "${YELLOW}📝 Последние логи backend...${NC}"
docker-compose logs --tail=20 backend

echo -e "${YELLOW}📝 Последние логи frontend...${NC}"
docker-compose logs --tail=20 frontend

echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo -e "${GREEN}Проверьте логи выше на наличие ошибок.${NC}"
echo -e "${GREEN}Админ-панель доступна по адресу: https://nardist.site/admin${NC}"
