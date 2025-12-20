#!/bin/bash

# Проверка статуса nginx и диагностика проблем

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Диагностика Nginx                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 1. Статус контейнера
echo -e "${YELLOW}1. Статус контейнера nginx:${NC}"
docker ps -a | grep nardi_nginx || echo -e "${RED}✗ Контейнер не найден${NC}"

echo ""

# 2. Проверка портов
echo -e "${YELLOW}2. Проверка портов 80 и 443:${NC}"
if netstat -tlnp 2>/dev/null | grep -E ':80 |:443 ' || ss -tlnp 2>/dev/null | grep -E ':80 |:443 '; then
    echo -e "${GREEN}✓ Порты слушаются${NC}"
else
    echo -e "${RED}✗ Порты не слушаются${NC}"
fi

echo ""

# 3. Логи nginx
echo -e "${YELLOW}3. Последние логи nginx (последние 30 строк):${NC}"
docker logs nardi_nginx 2>&1 | tail -30

echo ""

# 4. Проверка сертификатов в контейнере
echo -e "${YELLOW}4. Проверка сертификатов в контейнере:${NC}"
if docker exec nardi_nginx test -f /etc/nginx/ssl/fullchain.pem 2>/dev/null; then
    echo -e "${GREEN}✓ fullchain.pem найден${NC}"
    docker exec nardi_nginx ls -lh /etc/nginx/ssl/fullchain.pem 2>/dev/null
else
    echo -e "${RED}✗ fullchain.pem НЕ найден в контейнере!${NC}"
fi

if docker exec nardi_nginx test -f /etc/nginx/ssl/privkey.pem 2>/dev/null; then
    echo -e "${GREEN}✓ privkey.pem найден${NC}"
    docker exec nardi_nginx ls -lh /etc/nginx/ssl/privkey.pem 2>/dev/null
else
    echo -e "${RED}✗ privkey.pem НЕ найден в контейнере!${NC}"
fi

echo ""

# 5. Проверка конфигурации nginx
echo -e "${YELLOW}5. Проверка конфигурации nginx:${NC}"
if docker exec nardi_nginx nginx -t 2>&1; then
    echo -e "${GREEN}✓ Конфигурация валидна${NC}"
else
    echo -e "${RED}✗ Ошибка в конфигурации${NC}"
fi

echo ""

# 6. Проверка доступности из контейнера
echo -e "${YELLOW}6. Проверка доступности backend из nginx:${NC}"
if docker exec nardi_nginx curl -s http://backend:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend доступен из nginx${NC}"
else
    echo -e "${RED}✗ Backend недоступен из nginx${NC}"
fi

echo ""

# 7. Проверка локального подключения
echo -e "${YELLOW}7. Проверка локального подключения:${NC}"
if curl -s http://localhost/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTP работает локально${NC}"
else
    echo -e "${RED}✗ HTTP не работает локально${NC}"
fi

if curl -k -s https://localhost/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTPS работает локально${NC}"
else
    echo -e "${RED}✗ HTTPS не работает локально${NC}"
fi

echo ""

# 8. Проверка firewall
echo -e "${YELLOW}8. Проверка firewall:${NC}"
if command -v ufw &> /dev/null; then
    ufw status | grep -E '80|443' || echo "UFW не показывает правила для 80/443"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --list-ports 2>/dev/null || echo "Firewall-cmd не доступен"
else
    echo "Firewall не найден или не настроен"
fi

