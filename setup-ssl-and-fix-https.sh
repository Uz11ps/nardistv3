#!/bin/bash

# Скрипт для настройки SSL и исправления HTTPS конфигурации

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Настройка SSL и исправление HTTPS конфигурации..."
echo ""

# Проверяем есть ли SSL сертификат
if [ -d "/etc/letsencrypt/live/nardist.site" ]; then
    echo "✅ SSL сертификат уже существует"
else
    echo "📝 Установка SSL сертификата через certbot..."
    
    # Устанавливаем certbot если его нет
    if ! command -v certbot &> /dev/null; then
        echo "Установка certbot..."
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Получаем сертификат
    certbot --nginx -d nardist.site -d www.nardist.site --non-interactive --agree-tos --email admin@nardist.site || {
        echo "⚠️ Не удалось получить сертификат автоматически"
        echo "Выполните вручную: certbot --nginx -d nardist.site -d www.nardist.site"
    }
fi

echo ""
echo "🔍 Поиск HTTPS server блока (порт 443)..."

# Находим все server блоки для nardist.site
SERVER_LINES=$(grep -n "server_name.*nardist.site" "$CONFIG_FILE" | cut -d: -f1)

for SERVER_LINE in $SERVER_LINES; do
    # Находим начало server блока
    START_LINE=$SERVER_LINE
    while [ "$START_LINE" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${START_LINE}p" "$CONFIG_FILE"); then
            break
        fi
        START_LINE=$((START_LINE - 1))
    done
    
    # Проверяем есть ли listen 443
    SERVER_BLOCK=$(sed -n "${START_LINE},$((SERVER_LINE + 20))p" "$CONFIG_FILE")
    if echo "$SERVER_BLOCK" | grep -q "listen.*443"; then
        echo "✅ Найден HTTPS server блок на строке $START_LINE"
        
        # Находим конец server блока
        SERVER_CLOSE=""
        INDENT=$(sed -n "${START_LINE}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
        INDENT=$((INDENT - 1))
        
        for i in $(seq $((START_LINE + 1)) $(wc -l < "$CONFIG_FILE")); do
            line=$(sed -n "${i}p" "$CONFIG_FILE")
            line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
            line_indent=$((line_indent - 1))
            
            if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
                SERVER_CLOSE=$i
                break
            fi
        done
        
        if [ -n "$SERVER_CLOSE" ]; then
            echo "HTTPS server блок: строки $START_LINE-$SERVER_CLOSE"
            
            # Проверяем есть ли уже location блоки
            HTTPS_BLOCK=$(sed -n "${START_LINE},${SERVER_CLOSE}p" "$CONFIG_FILE")
            if echo "$HTTPS_BLOCK" | grep -q "location /api"; then
                echo "✅ Location блоки уже есть в HTTPS конфигурации"
            else
                echo "⚠️ Location блоки отсутствуют в HTTPS конфигурации"
                echo "Нужно добавить их вручную или использовать скрипт fix-nginx-final.sh для HTTPS блока"
            fi
        fi
    fi
done

echo ""
echo "📝 Для добавления location блоков в HTTPS конфигурацию:"
echo "1. Откройте файл: nano $CONFIG_FILE"
echo "2. Найдите HTTPS server блок (с listen 443)"
echo "3. Добавьте те же location блоки что и в HTTP блоке"
echo "4. Или запустите: ./fix-nginx-final.sh (он должен обработать оба блока)"

