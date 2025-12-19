#!/bin/bash

# Проверка CDN, прокси и других сервисов

DOMAIN="nardist.site"
SERVER_IP=$(dig +short ${DOMAIN} | head -1)

echo "🔍 Проверка CDN, прокси и других сервисов..."
echo ""

# 1. Проверяем DNS
echo "1️⃣ Проверка DNS..."
echo "   Домен ${DOMAIN} указывает на IP: $SERVER_IP"
echo ""

# Проверяем, есть ли CDN (Cloudflare, etc)
if dig +short ${DOMAIN} | grep -q "cloudflare\|fastly\|amazonaws\|cloudfront"; then
    echo "   ⚠️ Обнаружен CDN в DNS записях!"
    dig +short ${DOMAIN} | sed 's/^/      /'
else
    echo "   ✅ CDN не обнаружен в DNS"
fi

# Проверяем A записи
echo "   A записи:"
dig +short ${DOMAIN} A | sed 's/^/      /'
echo ""

# 2. Проверяем заголовки HTTP
echo "2️⃣ Проверка HTTP заголовков..."
echo "   Заголовки от сервера:"
HTTP_HEADERS=$(curl -k -I https://${DOMAIN} 2>&1 | head -20)
echo "$HTTP_HEADERS" | sed 's/^/      /'
echo ""

# Проверяем, есть ли заголовки CDN
if echo "$HTTP_HEADERS" | grep -qi "cloudflare\|cf-\|x-served-by\|via\|x-cache"; then
    echo "   ⚠️ Обнаружены заголовки CDN/прокси!"
    echo "$HTTP_HEADERS" | grep -i "cloudflare\|cf-\|x-served-by\|via\|x-cache" | sed 's/^/      /'
else
    echo "   ✅ Заголовков CDN/прокси не обнаружено"
fi

echo ""

# 3. Проверяем, что слушает порт 443 на сервере
echo "3️⃣ Проверка, что слушает порт 443..."
if command -v netstat &> /dev/null; then
    PORT_443_LISTENERS=$(netstat -tlnp 2>/dev/null | grep ":443")
    echo "   Процессы на порту 443:"
    echo "$PORT_443_LISTENERS" | sed 's/^/      /'
elif command -v ss &> /dev/null; then
    PORT_443_LISTENERS=$(ss -tlnp 2>/dev/null | grep ":443")
    echo "   Процессы на порту 443:"
    echo "$PORT_443_LISTENERS" | sed 's/^/      /'
fi

echo ""

# 4. Проверяем, нет ли других веб-серверов
echo "4️⃣ Проверка других веб-серверов..."
if pgrep -x apache2 >/dev/null 2>&1 || pgrep -x httpd >/dev/null 2>&1; then
    echo "   ⚠️ Apache запущен!"
    ps aux | grep -E "apache2|httpd" | grep -v grep | head -5 | sed 's/^/      /'
else
    echo "   ✅ Apache не запущен"
fi

if pgrep -x nginx >/dev/null 2>&1; then
    echo "   ✅ Nginx запущен"
    NGINX_COUNT=$(pgrep -x nginx | wc -l)
    echo "      Процессов nginx: $NGINX_COUNT"
else
    echo "   ❌ Nginx не запущен!"
fi

echo ""

# 5. Проверяем, нет ли других конфигов nginx
echo "5️⃣ Поиск других конфигураций nginx для ${DOMAIN}..."
OTHER_CONFIGS=$(find /etc/nginx -type f -name "*.conf" 2>/dev/null | xargs grep -l "server_name.*${DOMAIN}" 2>/dev/null)
if [ -n "$OTHER_CONFIGS" ]; then
    echo "   ⚠️ Найдены другие конфиги:"
    echo "$OTHER_CONFIGS" | sed 's/^/      /'
    echo ""
    echo "   Проверяю их содержимое..."
    while IFS= read -r config; do
        echo "      Файл: $config"
        grep -n "server_name\|listen\|root\|location" "$config" | head -10 | sed 's/^/         /'
        echo ""
    done <<< "$OTHER_CONFIGS"
else
    echo "   ✅ Других конфигов не найдено"
fi

echo ""

# 6. Проверяем ISPmanager (может быть прокси)
echo "6️⃣ Проверка ISPmanager..."
if [ -d "/usr/local/ispmgr" ] || [ -d "/usr/local/mgr5" ]; then
    echo "   ⚠️ ISPmanager установлен!"
    echo "   ISPmanager может иметь свой прокси/nginx"
    
    # Проверяем, есть ли конфиги ISPmanager
    if [ -d "/usr/local/ispmgr/etc" ]; then
        echo "   Проверяю конфиги ISPmanager..."
        find /usr/local/ispmgr/etc -name "*nginx*" -o -name "*vhost*" 2>/dev/null | head -5 | sed 's/^/      /'
    fi
else
    echo "   ✅ ISPmanager не обнаружен"
fi

echo ""

# 7. Проверяем, что реально отвечает на запросы
echo "7️⃣ Тест прямого подключения к IP..."
if [ -n "$SERVER_IP" ]; then
    echo "   Подключение напрямую к IP $SERVER_IP:443..."
    DIRECT_RESPONSE=$(curl -k -s -H "Host: ${DOMAIN}" https://${SERVER_IP}/ 2>&1 | head -10)
    if echo "$DIRECT_RESPONSE" | grep -qi "Website.*ready"; then
        echo "   ❌ Даже напрямую к IP возвращается заглушка!"
        echo "   Первые строки:"
        echo "$DIRECT_RESPONSE" | head -5 | sed 's/^/      /'
    else
        echo "   ✅ Напрямую к IP правильный контент"
    fi
fi

echo ""

# 8. Проверяем кэш браузера (тест с разными User-Agent)
echo "8️⃣ Тест с разными User-Agent..."
echo "   С User-Agent браузера:"
BROWSER_RESPONSE=$(curl -k -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" https://${DOMAIN}/ 2>&1 | head -10)
if echo "$BROWSER_RESPONSE" | grep -qi "Website.*ready"; then
    echo "      ❌ Заглушка с User-Agent браузера"
else
    echo "      ✅ Правильный контент с User-Agent браузера"
fi

echo "   С User-Agent curl:"
CURL_RESPONSE=$(curl -k -s -A "curl/7.0" https://${DOMAIN}/ 2>&1 | head -10)
if echo "$CURL_RESPONSE" | grep -qi "Website.*ready"; then
    echo "      ❌ Заглушка с User-Agent curl"
else
    echo "      ✅ Правильный контент с User-Agent curl"
fi

echo ""

# 9. Проверяем логи nginx в реальном времени
echo "9️⃣ Проверка последних запросов в логах nginx..."
ACCESS_LOG="/var/log/nginx/access.log"
if [ -f "$ACCESS_LOG" ]; then
    echo "   Последние 10 запросов:"
    tail -10 "$ACCESS_LOG" | sed 's/^/      /'
else
    echo "   ⚠️ Лог файл не найден"
fi

echo ""

# 10. Итоговые рекомендации
echo "=========================================="
echo "📋 Рекомендации:"
echo ""

if echo "$HTTP_HEADERS" | grep -qi "cloudflare\|cf-\|x-served-by"; then
    echo "⚠️ Обнаружен CDN/прокси!"
    echo "   Решение:"
    echo "   1. Очистите кэш CDN (если это Cloudflare - Purge Cache)"
    echo "   2. Отключите прокси в настройках CDN"
    echo "   3. Подождите несколько минут для обновления кэша"
    echo ""
fi

if [ -d "/usr/local/ispmgr" ] || [ -d "/usr/local/mgr5" ]; then
    echo "⚠️ ISPmanager установлен!"
    echo "   Решение:"
    echo "   1. Проверьте настройки проксирования в ISPmanager"
    echo "   2. Отключите проксирование в ISPmanager для ${DOMAIN}"
    echo "   3. Убедитесь, что ISPmanager не переопределяет nginx конфигурацию"
    echo ""
fi

echo "Общие рекомендации:"
echo "   1. Очистите кэш браузера полностью (Ctrl+Shift+Delete)"
echo "   2. Попробуйте в режиме инкогнито"
echo "   3. Попробуйте с другого браузера/устройства"
echo "   4. Подождите 5-10 минут (DNS/CDN кэш может обновляться)"
echo "   5. Проверьте через VPN или другой IP"

echo ""
echo "✅ Проверка завершена!"

