#!/bin/bash

# Скрипт для диагностики и исправления проблем с SSL

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="nardist.site"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Диагностика SSL сертификата         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# 1. Проверка наличия сертификатов на хосте
echo -e "${YELLOW}1. Проверка сертификатов на хосте:${NC}"
if [ -f "${CERT_PATH}/fullchain.pem" ] && [ -f "${CERT_PATH}/privkey.pem" ]; then
    echo -e "${GREEN}✓ Сертификаты найдены${NC}"
    
    # Проверяем срок действия
    EXPIRY=$(openssl x509 -enddate -noout -in "${CERT_PATH}/fullchain.pem" 2>/dev/null | cut -d= -f2)
    if [ -n "$EXPIRY" ]; then
        echo -e "  Срок действия: $EXPIRY"
        
        # Проверяем не истек ли
        EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y" "$EXPIRY" +%s 2>/dev/null)
        NOW_EPOCH=$(date +%s)
        if [ "$EXPIRY_EPOCH" -lt "$NOW_EPOCH" ]; then
            echo -e "${RED}✗ Сертификат истек!${NC}"
            NEED_RENEW=true
        else
            DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
            echo -e "${GREEN}✓ Сертификат действителен еще $DAYS_LEFT дней${NC}"
            NEED_RENEW=false
        fi
    fi
else
    echo -e "${RED}✗ Сертификаты не найдены в ${CERT_PATH}${NC}"
    NEED_RENEW=true
fi

echo ""

# 2. Проверка nginx контейнера
echo -e "${YELLOW}2. Проверка nginx контейнера:${NC}"
if docker ps | grep -q nardi_nginx; then
    echo -e "${GREEN}✓ Nginx контейнер запущен${NC}"
    
    # Проверяем что сертификаты видны внутри контейнера
    if docker exec nardi_nginx test -f /etc/nginx/ssl/fullchain.pem 2>/dev/null; then
        echo -e "${GREEN}✓ Сертификаты видны в контейнере${NC}"
    else
        echo -e "${RED}✗ Сертификаты НЕ видны в контейнере!${NC}"
        echo -e "${YELLOW}  Проблема с монтированием volumes${NC}"
    fi
    
    # Проверяем логи nginx
    echo ""
    echo -e "${YELLOW}3. Последние ошибки nginx:${NC}"
    docker logs nardi_nginx 2>&1 | grep -i "ssl\|cert\|error" | tail -5 || echo "Нет ошибок SSL в логах"
else
    echo -e "${RED}✗ Nginx контейнер не запущен${NC}"
    echo -e "${YELLOW}  Попытка запуска...${NC}"
    docker-compose up -d nginx
    sleep 3
fi

echo ""

# 4. Проверка доступности HTTPS
echo -e "${YELLOW}4. Проверка HTTPS соединения:${NC}"
HTTPS_RESPONSE=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/api/health 2>&1)
if [ "$HTTPS_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ HTTPS работает (код: $HTTPS_RESPONSE)${NC}"
else
    echo -e "${RED}✗ HTTPS не работает (код: $HTTPS_RESPONSE)${NC}"
fi

# Проверка сертификата через openssl
echo ""
echo -e "${YELLOW}5. Проверка сертификата через openssl:${NC}"
CERT_INFO=$(echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 2>/dev/null | openssl x509 -noout -dates -subject 2>/dev/null)
if [ -n "$CERT_INFO" ]; then
    echo "$CERT_INFO"
    echo ""
    VERIFY_RESULT=$(echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 2>&1 | grep -i "verify return code")
    if echo "$VERIFY_RESULT" | grep -q "0 (ok)"; then
        echo -e "${GREEN}✓ Сертификат валиден${NC}"
    else
        echo -e "${RED}✗ Проблема с сертификатом:${NC}"
        echo "$VERIFY_RESULT"
    fi
else
    echo -e "${RED}✗ Не удалось получить информацию о сертификате${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Рекомендации                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

if [ "$NEED_RENEW" = true ]; then
    echo ""
    echo -e "${YELLOW}Для получения/обновления SSL сертификата:${NC}"
    echo ""
    echo "1. Остановите nginx контейнер:"
    echo "   docker-compose stop nginx"
    echo ""
    echo "2. Освободите порты 80 и 443:"
    echo "   sudo lsof -ti:80 | xargs kill -9 2>/dev/null || true"
    echo "   sudo lsof -ti:443 | xargs kill -9 2>/dev/null || true"
    echo ""
    echo "3. Получите сертификат:"
    echo "   sudo certbot certonly --standalone \\"
    echo "       -d ${DOMAIN} \\"
    echo "       -d www.${DOMAIN} \\"
    echo "       --email admin@${DOMAIN} \\"
    echo "       --agree-tos \\"
    echo "       --non-interactive"
    echo ""
    echo "4. Запустите nginx:"
    echo "   docker-compose up -d nginx"
    echo ""
    echo "Или используйте готовый скрипт:"
    echo "   ./setup-ssl.sh"
else
    echo ""
    echo -e "${GREEN}Сертификат в порядке. Если проблема сохраняется:${NC}"
    echo ""
    echo "1. Перезапустите nginx:"
    echo "   docker-compose restart nginx"
    echo ""
    echo "2. Проверьте что порты 80 и 443 не заняты:"
    echo "   sudo netstat -tlnp | grep ':80\|:443'"
    echo ""
    echo "3. Проверьте логи nginx:"
    echo "   docker logs nardi_nginx"
fi

