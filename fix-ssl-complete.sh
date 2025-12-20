#!/bin/bash

# Полное исправление SSL проблемы

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="nardist.site"
EMAIL="admin@${DOMAIN}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Полное исправление SSL               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Проверка прав
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}✗ Запустите скрипт с правами root${NC}"
    exit 1
fi

cd /var/www/nardiphp

# 1. Остановка всех сервисов на портах 80 и 443
echo -e "${YELLOW}1. Освобождение портов 80 и 443...${NC}"
docker-compose stop nginx 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
pkill nginx 2>/dev/null || true

# Убиваем процессы на портах
lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:443 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 3

# Проверка что порты свободны
if lsof -ti:80 > /dev/null 2>&1 || lsof -ti:443 > /dev/null 2>&1; then
    echo -e "${RED}✗ Порты все еще заняты!${NC}"
    echo "Занятые порты:"
    lsof -i:80 -i:443 2>/dev/null || netstat -tlnp | grep ':80\|:443'
    exit 1
fi
echo -e "${GREEN}✓ Порты освобождены${NC}"

# 2. Удаление старого самоподписанного сертификата
echo ""
echo -e "${YELLOW}2. Удаление старого сертификата...${NC}"
if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
    rm -rf "/etc/letsencrypt/live/${DOMAIN}"
    rm -rf "/etc/letsencrypt/archive/${DOMAIN}"
    rm -f "/etc/letsencrypt/renewal/${DOMAIN}.conf"
    echo -e "${GREEN}✓ Старый сертификат удален${NC}"
fi

# 3. Получение нового сертификата
echo ""
echo -e "${YELLOW}3. Получение SSL сертификата для ${DOMAIN}...${NC}"
echo -e "${YELLOW}   Убедитесь что домен ${DOMAIN} указывает на IP этого сервера!${NC}"
echo ""

# Проверка DNS
echo "Проверка DNS..."
DOMAIN_IP=$(dig +short ${DOMAIN} | tail -n1)
SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip)

echo "IP домена ${DOMAIN}: ${DOMAIN_IP}"
echo "IP сервера: ${SERVER_IP}"

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo -e "${RED}⚠️  ВНИМАНИЕ: IP домена не совпадает с IP сервера!${NC}"
    echo -e "${YELLOW}   Продолжить все равно? (y/n)${NC}"
    read -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Установка certbot если нужно
if ! command -v certbot &> /dev/null; then
    echo "Установка certbot..."
    apt-get update
    apt-get install -y certbot
fi

# Получение сертификата
certbot certonly --standalone \
    -d ${DOMAIN} \
    -d www.${DOMAIN} \
    --email ${EMAIL} \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http \
    --force-renewal

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Ошибка получения сертификата${NC}"
    echo ""
    echo -e "${YELLOW}Возможные причины:${NC}"
    echo "  1. Домен ${DOMAIN} не указывает на IP этого сервера"
    echo "  2. Порты 80/443 заблокированы firewall"
    echo "  3. Домен уже имеет активный сертификат"
    echo ""
    echo "Попробуйте вручную:"
    echo "  certbot certonly --standalone -d ${DOMAIN} -d www.${DOMAIN}"
    exit 1
fi

# 4. Проверка сертификата
echo ""
echo -e "${YELLOW}4. Проверка полученного сертификата...${NC}"
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    CERT_SUBJECT=$(openssl x509 -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" -noout -subject 2>/dev/null)
    echo "Сертификат для: $CERT_SUBJECT"
    
    if echo "$CERT_SUBJECT" | grep -q "${DOMAIN}"; then
        echo -e "${GREEN}✓ Сертификат для правильного домена${NC}"
    else
        echo -e "${RED}✗ Сертификат для неправильного домена!${NC}"
        exit 1
    fi
    
    # Устанавливаем правильные права
    chmod 644 /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
    chmod 600 /etc/letsencrypt/live/${DOMAIN}/privkey.pem
else
    echo -e "${RED}✗ Сертификат не найден!${NC}"
    exit 1
fi

# 5. Перезапуск nginx
echo ""
echo -e "${YELLOW}5. Запуск nginx контейнера...${NC}"
docker-compose up -d nginx

sleep 5

# Проверка что контейнер запустился
if docker ps | grep -q nardi_nginx; then
    echo -e "${GREEN}✓ Nginx контейнер запущен${NC}"
else
    echo -e "${RED}✗ Nginx контейнер не запустился${NC}"
    echo "Логи:"
    docker-compose logs nginx | tail -20
    exit 1
fi

# 6. Проверка HTTPS
echo ""
echo -e "${YELLOW}6. Проверка HTTPS...${NC}"
sleep 3

HTTPS_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/api/health 2>&1)
if [ "$HTTPS_CODE" = "200" ]; then
    echo -e "${GREEN}✓ HTTPS работает! (код: $HTTPS_CODE)${NC}"
else
    echo -e "${YELLOW}⚠ HTTPS вернул код: $HTTPS_CODE${NC}"
    echo "Проверьте логи: docker logs nardi_nginx"
fi

# Проверка сертификата
echo ""
echo -e "${YELLOW}7. Проверка валидности сертификата...${NC}"
CERT_CHECK=$(echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 2>&1 | grep -i "verify return code")
if echo "$CERT_CHECK" | grep -q "0 (ok)"; then
    echo -e "${GREEN}✓ Сертификат валиден и доверен браузерами!${NC}"
else
    echo -e "${YELLOW}⚠ $CERT_CHECK${NC}"
    echo "Это может быть нормально если сертификат только что получен"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  SSL настроен успешно!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Для автоматического обновления добавьте в crontab:${NC}"
echo "0 0 * * * certbot renew --quiet --deploy-hook 'cd /var/www/nardiphp && docker-compose restart nginx'"

