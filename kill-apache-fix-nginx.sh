#!/bin/bash

# Скрипт для остановки Apache и настройки nginx

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Остановка Apache и настройка nginx..."
echo ""

# 1. Останавливаем Apache
echo "1️⃣ Остановка Apache..."
systemctl stop apache2 2>/dev/null || systemctl stop httpd 2>/dev/null || service apache2 stop 2>/dev/null || service httpd stop 2>/dev/null

# Убиваем процессы Apache на портах 80 и 443
pkill -9 apache2 2>/dev/null
pkill -9 httpd 2>/dev/null
lsof -ti:80 | xargs kill -9 2>/dev/null
lsof -ti:443 | xargs kill -9 2>/dev/null

sleep 2

# Отключаем автозапуск Apache
systemctl disable apache2 2>/dev/null || systemctl disable httpd 2>/dev/null

echo "   ✅ Apache остановлен и отключен"
echo ""

# 2. Проверяем, что порты свободны
echo "2️⃣ Проверка портов..."
if lsof -ti:80 >/dev/null 2>&1; then
    echo "   ⚠️ Порт 80 все еще занят, убиваю процессы..."
    lsof -ti:80 | xargs kill -9 2>/dev/null
    sleep 1
fi

if lsof -ti:443 >/dev/null 2>&1; then
    echo "   ⚠️ Порт 443 все еще занят, убиваю процессы..."
    lsof -ti:443 | xargs kill -9 2>/dev/null
    sleep 1
fi

echo "   ✅ Порты 80 и 443 свободны"
echo ""

# 3. Проверяем HTTP блок в конфигурации nginx
echo "3️⃣ Проверка HTTP блока (порт 80) в nginx..."
HTTP_BLOCK_START=$(grep -n "listen.*80" "$CONFIG_FILE" | grep -v "443" | head -1 | cut -d: -f1)

if [ -z "$HTTP_BLOCK_START" ]; then
    echo "   ⚠️ HTTP блок не найден, добавляю..."
    
    # Находим место для вставки (перед HTTPS блоком)
    HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1)
    INSERT_LINE=$((HTTPS_BLOCK_START - 1))
    
    # Получаем отступ
    HTTPS_INDENT=$(sed -n "${HTTPS_BLOCK_START}p" "$CONFIG_FILE" | sed 's/server.*//')
    
    # Создаём временный файл
    TMP_FILE=$(mktemp)
    
    # Копируем всё до места вставки
    head -n $INSERT_LINE "$CONFIG_FILE" > "$TMP_FILE"
    
    # Добавляем HTTP блок с редиректом на HTTPS
    cat >> "$TMP_FILE" << EOF
${HTTPS_INDENT}server {
${HTTPS_INDENT}    listen 80;
${HTTPS_INDENT}    listen [::]:80;
${HTTPS_INDENT}    server_name ${DOMAIN} www.${DOMAIN};
${HTTPS_INDENT}
${HTTPS_INDENT}    # Редирект на HTTPS
${HTTPS_INDENT}    return 301 https://\$server_name\$request_uri;
${HTTPS_INDENT}}

EOF
    
    # Добавляем остаток файла
    tail -n +$HTTPS_BLOCK_START "$CONFIG_FILE" >> "$TMP_FILE"
    
    # Заменяем файл
    mv "$TMP_FILE" "$CONFIG_FILE"
    
    echo "   ✅ HTTP блок добавлен с редиректом на HTTPS"
else
    echo "   ✅ HTTP блок найден"
    
    # Проверяем, есть ли редирект на HTTPS
    HTTP_BLOCK_END=$HTTP_BLOCK_START
    INDENT=$(sed -n "${HTTP_BLOCK_START}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
    INDENT=$((INDENT - 1))
    
    TOTAL_LINES=$(wc -l < "$CONFIG_FILE")
    for i in $(seq $((HTTP_BLOCK_START + 1)) $TOTAL_LINES); do
        line=$(sed -n "${i}p" "$CONFIG_FILE")
        line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
        line_indent=$((line_indent - 1))
        
        if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
            HTTP_BLOCK_END=$i
            break
        fi
    done
    
    HTTP_BLOCK=$(sed -n "${HTTP_BLOCK_START},${HTTP_BLOCK_END}p" "$CONFIG_FILE")
    
    if ! echo "$HTTP_BLOCK" | grep -q "return 301.*https"; then
        echo "   ⚠️ Редирект на HTTPS не найден, добавляю..."
        
        # Находим место перед закрывающей скобкой
        INSERT_LINE=$((HTTP_BLOCK_END - 1))
        HTTP_INDENT=$(sed -n "${HTTP_BLOCK_START}p" "$CONFIG_FILE" | sed 's/server.*//')
        
        TMP_FILE=$(mktemp)
        head -n $INSERT_LINE "$CONFIG_FILE" > "$TMP_FILE"
        
        cat >> "$TMP_FILE" << EOF
${HTTP_INDENT}    # Редирект на HTTPS
${HTTP_INDENT}    return 301 https://\$server_name\$request_uri;
EOF
        
        tail -n +$HTTP_BLOCK_END "$CONFIG_FILE" >> "$TMP_FILE"
        mv "$TMP_FILE" "$CONFIG_FILE"
        
        echo "   ✅ Редирект добавлен"
    else
        echo "   ✅ Редирект на HTTPS уже настроен"
    fi
fi

echo ""

# 4. Проверяем HTTPS блок - убеждаемся, что location / правильный
echo "4️⃣ Проверка HTTPS блока (location / для frontend)..."
HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -n "$HTTPS_BLOCK_START" ]; then
    SERVER_START=$HTTPS_BLOCK_START
    while [ "$SERVER_START" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_START}p" "$CONFIG_FILE" 2>/dev/null); then
            break
        fi
        SERVER_START=$((SERVER_START - 1))
    done
    
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
    
    # Проверяем location /
    if echo "$HTTPS_BLOCK" | grep -A 5 "location / {" | grep -q "proxy_pass.*5173"; then
        echo "   ✅ location / правильно настроен на проксирование frontend"
    else
        echo "   ❌ location / НЕ настроен правильно!"
        echo "   Нужно исправить - запустите: ./fix-https-complete.sh"
    fi
    
    # Проверяем, нет ли root/index директив
    if echo "$HTTPS_BLOCK" | grep -q "^[[:space:]]*root\|^[[:space:]]*index"; then
        echo "   ⚠️ Найдены root/index директивы - они могут вызывать заглушку!"
        echo "   Нужно их убрать - запустите: ./fix-https-complete.sh"
    fi
fi

echo ""

# 5. Проверяем frontend контейнер
echo "5️⃣ Проверка frontend контейнера..."
if docker ps | grep -q "nardi_frontend"; then
    echo "   ✅ Frontend контейнер запущен"
    
    # Проверяем доступность
    FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
    if [ "$FRONTEND_TEST" = "200" ]; then
        echo "   ✅ Frontend доступен на localhost:5173"
    else
        echo "   ❌ Frontend НЕ доступен на localhost:5173 (код: $FRONTEND_TEST)"
        echo "   Проверьте логи: docker-compose logs frontend"
    fi
else
    echo "   ❌ Frontend контейнер НЕ запущен!"
    echo "   Запустите: docker-compose up -d frontend"
fi

echo ""

# 6. Проверяем синтаксис и перезапускаем nginx
echo "6️⃣ Проверка синтаксиса nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен"
    echo ""
    
    echo "🔄 Перезапуск nginx..."
    systemctl restart nginx || service nginx restart
    sleep 3
    
    # Проверяем статус
    if systemctl is-active --quiet nginx || pgrep -x nginx > /dev/null; then
        echo "   ✅ Nginx запущен"
    else
        echo "   ❌ Nginx не запустился!"
        echo "   Проверьте логи: journalctl -u nginx -n 50"
        exit 1
    fi
else
    echo "   ❌ Ошибка в синтаксисе!"
    nginx -t 2>&1 | sed 's/^/      /'
    exit 1
fi

echo ""

# 7. Тестирование
echo "7️⃣ Тестирование..."
sleep 2

# Проверяем HTTP редирект
echo "   HTTP (должен редиректить на HTTPS):"
HTTP_REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" -L http://${DOMAIN} 2>&1)
if [ "$HTTP_REDIRECT" = "200" ] || [ "$HTTP_REDIRECT" = "301" ] || [ "$HTTP_REDIRECT" = "302" ]; then
    echo "      ✅ HTTP работает (код: $HTTP_REDIRECT)"
else
    echo "      ⚠️ HTTP вернул код: $HTTP_REDIRECT"
fi

# Проверяем HTTPS главную страницу
echo "   HTTPS главная страница:"
HTTPS_MAIN=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/ 2>&1)
if [ "$HTTPS_MAIN" = "200" ]; then
    echo "      ✅ HTTPS главная работает (код: $HTTPS_MAIN)"
    
    # Проверяем, что это не заглушка
    MAIN_CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -30)
    if echo "$MAIN_CONTENT" | grep -qi "заглушка\|welcome\|default\|ispmanager\|только что создан\|apache"; then
        echo "      ❌ Все еще показывает заглушку или Apache!"
        echo "      Проверьте конфигурацию HTTPS блока"
    else
        echo "      ✅ Контент правильный (не заглушка)"
    fi
else
    echo "      ❌ HTTPS главная вернула код: $HTTPS_MAIN"
fi

# Проверяем health
echo "   HTTPS /health:"
HTTPS_HEALTH=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health 2>&1)
if [ "$HTTPS_HEALTH" = "200" ]; then
    echo "      ✅ /health работает (код: $HTTPS_HEALTH)"
else
    echo "      ⚠️ /health вернул код: $HTTPS_HEALTH"
fi

echo ""
echo "=========================================="
echo "✅ Готово!"
echo ""
echo "Если frontend все еще не отображается:"
echo "   1. Проверьте frontend контейнер: docker-compose logs frontend"
echo "   2. Проверьте доступность: curl http://localhost:5173"
echo "   3. Запустите: ./fix-https-complete.sh (если не запускали)"
echo "   4. Проверьте логи nginx: tail -f /var/log/nginx/error.log"

