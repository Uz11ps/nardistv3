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

echo -e "${YELLOW}🛑 Остановка системных веб-серверов (nginx, apache2)...${NC}"
sudo systemctl stop nginx 2>/dev/null || sudo service nginx stop 2>/dev/null || true
sudo systemctl stop apache2 2>/dev/null || sudo service apache2 stop 2>/dev/null || true
sudo systemctl stop httpd 2>/dev/null || sudo service httpd stop 2>/dev/null || true

echo -e "${YELLOW}🛑 Остановка и удаление старых контейнеров...${NC}"
docker-compose down --remove-orphans

# Принудительная остановка (на случай если down не сработал)
docker-compose ps -q | xargs -r docker stop || true
docker-compose ps -q | xargs -r docker rm -f || true

# Задержка для освобождения портов
sleep 2

echo -e "${YELLOW}🔨 Пересборка и запуск контейнеров...${NC}"
docker-compose up -d --build --force-recreate

echo -e "${YELLOW}⏳ Ожидание запуска (5 секунд)...${NC}"
sleep 5

echo -e "${GREEN}✅ Готово!${NC}"
docker-compose ps

