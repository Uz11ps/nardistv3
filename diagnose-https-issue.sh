#!/bin/bash

# Скрипт для диагностики проблемы с HTTPS

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔍 Диагностика проблемы с HTTPS для ${DOMAIN}"
echo "=========================================="
echo ""

# 1. Проверка конфигурационного файла
echo "1️⃣ Проверка конфигурационного файла nginx..."
if [ -f "$CONFIG_FILE" ]; then
    echo "   ✅ Файл найден: $CONFIG_FILE"
else
    echo "   ❌ Файл не найден: $CONFIG_FILE"
    echo "   Попробуйте найти конфигурацию:"
    echo "   find /etc/nginx -name '*${DOMAIN}*' -type f"
    exit 1
fi
echo ""

# 2. Проверка SSL сертификата
echo "2️⃣ Проверка SSL сертификата..."
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
if [ -f "${CERT_PATH}/fullchain.pem" ] && [ -f "${CERT_PATH}/privkey.pem" ]; then
    echo "   ✅ Сертификат найден: ${CERT_PATH}"
    echo "   Информация о сертификате:"
    openssl x509 -in ${CERT_PATH}/fullchain.pem -noout -subject -dates 2>/dev/null | sed 's/^/      /'
else
    echo "   ❌ Сертификат не найден в ${CERT_PATH}"
    echo "   Установите сертификат: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
fi
echo ""

# 3. Проверка HTTPS server блока
echo "3️⃣ Проверка HTTPS server блока (listen 443)..."
if grep -q "listen.*443" "$CONFIG_FILE"; then
    echo "   ✅ HTTPS server блок найден"
    HTTPS_LINES=$(grep -n "listen.*443" "$CONFIG_FILE")
    echo "   Строки с listen 443:"
    echo "$HTTPS_LINES" | sed 's/^/      /'
else
    echo "   ❌ HTTPS server блок не найден!"
    echo "   Нужно добавить server блок с listen 443"
fi
echo ""

# 4. Проверка SSL директив в HTTPS блоке
echo "4️⃣ Проверка SSL директив..."
if grep -q "ssl_certificate" "$CONFIG_FILE"; then
    echo "   ✅ SSL директивы найдены:"
    grep "ssl_certificate" "$CONFIG_FILE" | sed 's/^/      /'
else
    echo "   ❌ SSL директивы не найдены!"
    echo "   Нужно добавить ssl_certificate и ssl_certificate_key"
fi
echo ""

# 5. Проверка location блоков в HTTPS
echo "5️⃣ Проверка location блоков в HTTPS блоке..."
HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1 2>/dev/null)

if [ -n "$HTTPS_BLOCK_START" ]; then
    # Находим server блок
    SERVER_START=$HTTPS_BLOCK_START
    while [ "$SERVER_START" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_START}p" "$CONFIG_FILE" 2>/dev/null); then
            break
        fi
        SERVER_START=$((SERVER_START - 1))
    done
    
    # Находим конец блока
    SERVER_END=$SERVER_START
    INDENT=$(sed -n "${SERVER_START}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
    INDENT=$((INDENT - 1))
    
    TOTAL_LINES=$(wc -l < "$CONFIG_FILE")
    for i in $(seq $((SERVER_START + 1)) $TOTAL_LINES); do
        line=$(sed -n "${i}p" "$CONFIG_FILE")
        line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
        line_indent=$((line_indent - 1))
        
        if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
            SERVER_END=$i
            break
        fi
    done
    
    HTTPS_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")
    
    if echo "$HTTPS_BLOCK" | grep -q "location /api"; then
        echo "   ✅ Location блоки найдены в HTTPS блоке"
        echo "   Найденные location блоки:"
        echo "$HTTPS_BLOCK" | grep "location " | sed 's/^/      /'
    else
        echo "   ❌ Location блоки НЕ найдены в HTTPS блоке!"
        echo "   Это основная причина ошибки 502!"
        echo "   Нужно добавить location блоки для проксирования"
    fi
else
    echo "   ⚠️ Не удалось найти HTTPS блок для анализа"
fi
echo ""

# 6. Проверка работы контейнеров
echo "6️⃣ Проверка Docker контейнеров..."
if command -v docker &> /dev/null; then
    if docker ps | grep -q "nardi_backend"; then
        echo "   ✅ Backend контейнер запущен"
    else
        echo "   ❌ Backend контейнер не запущен!"
    fi
    
    if docker ps | grep -q "nardi_frontend"; then
        echo "   ✅ Frontend контейнер запущен"
    else
        echo "   ❌ Frontend контейнер не запущен!"
    fi
else
    echo "   ⚠️ Docker не установлен или недоступен"
fi
echo ""

# 7. Проверка портов
echo "7️⃣ Проверка портов 3000 и 5173..."
if command -v netstat &> /dev/null; then
    if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
        echo "   ✅ Порт 3000 (backend) слушается"
    else
        echo "   ❌ Порт 3000 не слушается!"
    fi
    
    if netstat -tlnp 2>/dev/null | grep -q ":5173"; then
        echo "   ✅ Порт 5173 (frontend) слушается"
    else
        echo "   ❌ Порт 5173 не слушается!"
    fi
elif command -v ss &> /dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":3000"; then
        echo "   ✅ Порт 3000 (backend) слушается"
    else
        echo "   ❌ Порт 3000 не слушается!"
    fi
    
    if ss -tlnp 2>/dev/null | grep -q ":5173"; then
        echo "   ✅ Порт 5173 (frontend) слушается"
    else
        echo "   ❌ Порт 5173 не слушается!"
    fi
else
    echo "   ⚠️ netstat и ss недоступны"
fi
echo ""

# 8. Проверка доступности через localhost
echo "8️⃣ Проверка доступности через localhost..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null | grep -q "200"; then
    echo "   ✅ Backend доступен на http://localhost:3000"
else
    echo "   ❌ Backend недоступен на http://localhost:3000"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null | grep -q "200"; then
    echo "   ✅ Frontend доступен на http://localhost:5173"
else
    echo "   ❌ Frontend недоступен на http://localhost:5173"
fi
echo ""

# 9. Проверка синтаксиса nginx
echo "9️⃣ Проверка синтаксиса nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис nginx корректен"
else
    echo "   ❌ Ошибки в синтаксисе nginx:"
    nginx -t 2>&1 | sed 's/^/      /'
fi
echo ""

# 10. Тестирование HTTP и HTTPS
echo "🔟 Тестирование HTTP и HTTPS..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${DOMAIN} 2>/dev/null)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "   ✅ HTTP работает (код: $HTTP_CODE)"
else
    echo "   ⚠️ HTTP вернул код: $HTTP_CODE"
fi

HTTPS_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN} 2>/dev/null)
if [ "$HTTPS_CODE" = "200" ] || [ "$HTTPS_CODE" = "301" ] || [ "$HTTPS_CODE" = "302" ]; then
    echo "   ✅ HTTPS работает (код: $HTTPS_CODE)"
elif [ "$HTTPS_CODE" = "502" ]; then
    echo "   ❌ HTTPS возвращает 502 Bad Gateway"
    echo "   Это означает, что nginx не может проксировать запросы"
else
    echo "   ⚠️ HTTPS вернул код: $HTTPS_CODE"
fi
echo ""

# Итоговые рекомендации
echo "=========================================="
echo "📋 Рекомендации:"
echo ""

if [ ! -f "${CERT_PATH}/fullchain.pem" ]; then
    echo "   1. Установите SSL сертификат:"
    echo "      certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
    echo ""
fi

if ! grep -q "listen.*443" "$CONFIG_FILE"; then
    echo "   2. Добавьте HTTPS server блок в конфигурацию nginx"
    echo ""
fi

if [ -n "$HTTPS_BLOCK_START" ] && ! echo "$HTTPS_BLOCK" | grep -q "location /api"; then
    echo "   3. Добавьте location блоки в HTTPS server блок для проксирования"
    echo "      Запустите скрипт исправления: ./fix-https-502.sh"
    echo ""
fi

if [ "$HTTPS_CODE" = "502" ]; then
    echo "   4. Для исправления ошибки 502 запустите:"
    echo "      chmod +x fix-https-502.sh"
    echo "      ./fix-https-502.sh"
    echo ""
fi

echo "✅ Диагностика завершена!"

