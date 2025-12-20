#!/bin/bash

set -e

echo "🔐 Настройка SSL сертификата для nardist.site"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка наличия certbot
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}📦 Установка certbot...${NC}"
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Проверка наличия сертификата
if [ -d "/etc/letsencrypt/live/nardist.site" ]; then
    echo -e "${YELLOW}ℹ️  SSL сертификат уже существует${NC}"
    echo -e "${YELLOW}📋 Проверка срока действия...${NC}"
    sudo certbot certificates
    read -p "Обновить сертификат? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo certbot renew --dry-run
        echo -e "${GREEN}✅ Тест обновления прошел успешно${NC}"
        echo -e "${YELLOW}ℹ️  Для реального обновления запустите: sudo certbot renew${NC}"
    fi
else
    echo -e "${YELLOW}🔐 Получение SSL сертификата...${NC}"
    echo -e "${RED}⚠️  Убедитесь что:${NC}"
    echo -e "${RED}   1. Домен nardist.site указывает на IP этого сервера${NC}"
    echo -e "${RED}   2. Порты 80 и 443 открыты в firewall${NC}"
    echo ""
    read -p "Продолжить? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    
    # Получаем сертификат
    sudo certbot certonly --standalone \
        -d nardist.site \
        -d www.nardist.site \
        --email admin@nardist.site \
        --agree-tos \
        --non-interactive \
        --preferred-challenges http
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ SSL сертификат успешно получен!${NC}"
        echo -e "${GREEN}📁 Сертификат находится в: /etc/letsencrypt/live/nardist.site/${NC}"
    else
        echo -e "${RED}❌ Ошибка получения сертификата${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Настройка SSL завершена!${NC}"
echo -e "${YELLOW}ℹ️  Настройте автоматическое обновление в crontab:${NC}"
echo -e "${YELLOW}   0 0 * * * certbot renew --quiet --deploy-hook 'docker-compose -f /path/to/docker-compose.yml restart nginx'${NC}"

