#!/bin/bash

# Скрипт для получения SSL сертификата через certbot

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="nardist.site"
EMAIL="admin@${DOMAIN}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Получение SSL сертификата           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Проверка прав
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}✗ Запустите скрипт с правами root (sudo)${NC}"
    exit 1
fi

# Проверка наличия certbot
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Установка certbot...${NC}"
    apt-get update
    apt-get install -y certbot
fi

# Остановка nginx контейнера
echo -e "${YELLOW}1. Остановка nginx контейнера...${NC}"
cd /var/www/nardiphp
docker-compose stop nginx 2>/dev/null || true

# Освобождение портов
echo -e "${YELLOW}2. Освобождение портов 80 и 443...${NC}"
lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:443 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

# Получение сертификата
echo -e "${YELLOW}3. Получение SSL сертификата для ${DOMAIN}...${NC}"
echo -e "${YELLOW}   Убедитесь что домен ${DOMAIN} указывает на IP этого сервера${NC}"
echo ""

certbot certonly --standalone \
    -d ${DOMAIN} \
    -d www.${DOMAIN} \
    --email ${EMAIL} \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ SSL сертификат успешно получен!${NC}"
    echo -e "${GREEN}  Сертификат находится в: /etc/letsencrypt/live/${DOMAIN}/${NC}"
    
    # Проверяем права доступа
    chmod 644 /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
    chmod 600 /etc/letsencrypt/live/${DOMAIN}/privkey.pem
    
    # Запускаем nginx
    echo ""
    echo -e "${YELLOW}4. Запуск nginx контейнера...${NC}"
    docker-compose up -d nginx
    
    sleep 3
    
    # Проверка
    echo ""
    echo -e "${YELLOW}5. Проверка работы HTTPS...${NC}"
    if curl -k -s https://${DOMAIN}/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ HTTPS работает!${NC}"
    else
        echo -e "${RED}✗ HTTPS не работает, проверьте логи: docker logs nardi_nginx${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Настройка SSL завершена!${NC}"
    echo ""
    echo -e "${YELLOW}Для автоматического обновления сертификата добавьте в crontab:${NC}"
    echo "0 0 * * * certbot renew --quiet --deploy-hook 'cd /var/www/nardiphp && docker-compose restart nginx'"
else
    echo ""
    echo -e "${RED}✗ Ошибка получения сертификата${NC}"
    echo -e "${YELLOW}Проверьте:${NC}"
    echo "  1. Домен ${DOMAIN} указывает на IP этого сервера"
    echo "  2. Порты 80 и 443 открыты в firewall"
    echo "  3. Нет других сервисов на портах 80 и 443"
    exit 1
fi

