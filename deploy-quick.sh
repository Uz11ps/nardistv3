#!/bin/bash

set -e

echo "🚀 Быстрый деплой (с кэшем)..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Ошибка: docker-compose.yml не найден.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Обновление кода...${NC}"
git pull origin main

echo -e "${YELLOW}🔨 Перезапуск контейнеров...${NC}"
docker-compose down
docker-compose up -d --build

echo -e "${YELLOW}⏳ Ожидание запуска (5 секунд)...${NC}"
sleep 5

echo -e "${GREEN}✅ Готово!${NC}"
docker-compose ps

