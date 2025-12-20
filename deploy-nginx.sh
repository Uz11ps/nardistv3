#!/bin/bash

set -e

echo "🚀 Деплой nginx контейнера для nardist.site"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка что мы в правильной директории
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Ошибка: docker-compose.yml не найден. Убедитесь что вы в корне проекта.${NC}"
    exit 1
fi

# Проверка наличия SSL сертификата
if [ ! -f "/etc/letsencrypt/live/nardist.site/fullchain.pem" ]; then
    echo -e "${RED}⚠️  SSL сертификат не найден!${NC}"
    echo -e "${YELLOW}Запустите сначала: ./setup-ssl.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}🛑 Остановка системного nginx (если запущен)...${NC}"
sudo systemctl stop nginx 2>/dev/null || sudo service nginx stop 2>/dev/null || true
sudo systemctl disable nginx 2>/dev/null || true

echo -e "${YELLOW}🛑 Остановка старого nginx контейнера...${NC}"
docker-compose stop nginx 2>/dev/null || true
docker-compose rm -f nginx 2>/dev/null || true

# Проверка что порты 80 и 443 свободны
if sudo lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}⚠️  Порт 80 занят! Освободите порт перед продолжением.${NC}"
    sudo lsof -Pi :80 -sTCP:LISTEN
    exit 1
fi

if sudo lsof -Pi :443 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}⚠️  Порт 443 занят! Освободите порт перед продолжением.${NC}"
    sudo lsof -Pi :443 -sTCP:LISTEN
    exit 1
fi

echo -e "${YELLOW}🏗️  Сборка nginx образа...${NC}"
docker-compose build nginx

echo -e "${YELLOW}🚀 Запуск nginx контейнера...${NC}"
docker-compose up -d nginx

echo -e "${YELLOW}⏳ Ожидание запуска nginx (3 секунды)...${NC}"
sleep 3

echo -e "${YELLOW}📊 Проверка статуса контейнеров...${NC}"
docker-compose ps nginx

echo -e "${YELLOW}📝 Проверка логов nginx...${NC}"
docker-compose logs --tail=30 nginx

echo -e "${YELLOW}🔍 Проверка доступности сервиса...${NC}"
if curl -s -o /dev/null -w "%{http_code}" https://nardist.site | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅ HTTPS работает!${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS может быть еще не настроен или есть проблемы${NC}"
fi

if curl -s -o /dev/null -w "%{http_code}" http://nardist.site | grep -q "301\|302"; then
    echo -e "${GREEN}✅ HTTP редирект работает!${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP редирект может быть не настроен${NC}"
fi

echo -e "${GREEN}✅ Деплой nginx завершен!${NC}"
echo -e "${GREEN}🌐 Сайт доступен по адресу: https://nardist.site${NC}"
echo -e "${GREEN}📝 Админ-панель: https://nardist.site/admin${NC}"

