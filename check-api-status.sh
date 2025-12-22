#!/bin/bash

# Скрипт для проверки статуса API и контейнеров

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Проверка статуса контейнеров ===${NC}"
docker-compose ps

echo ""
echo -e "${BLUE}=== Проверка логов backend ===${NC}"
docker-compose logs --tail=20 backend

echo ""
echo -e "${BLUE}=== Проверка доступности API ===${NC}"

# Проверка локального API (внутри Docker сети)
echo -e "${YELLOW}1. Локальный API (localhost:3000):${NC}"
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Доступен${NC}"
  curl -s http://localhost:3000/api/health | head -3
else
  echo -e "${RED}✗ Недоступен${NC}"
fi

echo ""
echo -e "${YELLOW}2. API через Docker контейнер:${NC}"
if docker-compose exec -T backend curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Доступен из контейнера${NC}"
  docker-compose exec -T backend curl -s http://localhost:3000/api/health
else
  echo -e "${RED}✗ Недоступен из контейнера${NC}"
fi

echo ""
echo -e "${YELLOW}3. Внешний API (https://nardist.site/api):${NC}"
if curl -s -k https://nardist.site/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Доступен${NC}"
  curl -s -k https://nardist.site/api/health | head -3
else
  echo -e "${RED}✗ Недоступен${NC}"
  echo -e "${YELLOW}Проверьте настройки Nginx и проксирование${NC}"
fi

echo ""
echo -e "${BLUE}=== Проверка портов ===${NC}"
echo "Порт 3000 (backend):"
netstat -tlnp | grep :3000 || ss -tlnp | grep :3000 || echo "Порт не слушается"

echo ""
echo "Порт 443 (HTTPS):"
netstat -tlnp | grep :443 || ss -tlnp | grep :443 || echo "Порт не слушается"

echo ""
echo -e "${BLUE}=== Рекомендации ===${NC}"
echo "Если локальный API недоступен:"
echo "  1. Проверьте что контейнер backend запущен: docker-compose ps"
echo "  2. Проверьте логи: docker-compose logs backend"
echo "  3. Перезапустите: docker-compose restart backend"
echo ""
echo "Если внешний API недоступен:"
echo "  1. Проверьте Nginx: systemctl status nginx"
echo "  2. Проверьте конфигурацию: nginx -t"
echo "  3. Проверьте проксирование на порт 3000"


