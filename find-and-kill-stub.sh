#!/bin/bash

# Скрипт для поиска и удаления заглушки "Website is ready"

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔍 Поиск источника заглушки 'Website is ready'..."
echo ""

# 1. Проверяем, что реально отдает nginx
echo "1️⃣ Проверка ответа сервера..."
REAL_RESPONSE=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -5)
if echo "$REAL_RESPONSE" | grep -qi "Website.*ready\|content is to be added"; then
    echo "   ❌ Это заглушка хостинга!"
    echo ""
    
    # Ищем, откуда она может браться
    echo "   Ищу источник..."
fi

echo ""

# 2. Проверяем все location блоки в HTTPS
echo "2️⃣ Анализ location блоков в HTTPS..."
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
    
    echo "   Весь HTTPS server блок:"
    echo "$HTTPS_BLOCK" | head -50 | sed 's/^/      /'
    echo ""
    
    # Проверяем location /
    LOCATION_ROOT=$(echo "$HTTPS_BLOCK" | grep -A 30 "location / {" | head -30)
    echo "   location / блок:"
    echo "$LOCATION_ROOT" | sed 's/^/      /'
    echo ""
    
    # Проверяем, есть ли proxy_pass
    if echo "$LOCATION_ROOT" | grep -q "proxy_pass.*5173"; then
        echo "   ✅ proxy_pass на 5173 найден"
    else
        echo "   ❌ proxy_pass на 5173 НЕ найден!"
        echo "   Найденный proxy_pass:"
        echo "$LOCATION_ROOT" | grep "proxy_pass" | sed 's/^/      /'
    fi
    
    # Проверяем, нет ли try_files или root
    if echo "$LOCATION_ROOT" | grep -q "try_files"; then
        echo "   ❌ Найден try_files - это может быть проблемой!"
        echo "$LOCATION_ROOT" | grep "try_files" | sed 's/^/      /'
    fi
    
    if echo "$HTTPS_BLOCK" | grep -q "^[[:space:]]*root"; then
        echo "   ❌ Найдена директива root на уровне server!"
        echo "$HTTPS_BLOCK" | grep "^[[:space:]]*root" | sed 's/^/      /'
    fi
fi

echo ""

# 3. Полностью переписываем HTTPS блок
echo "3️⃣ Полное переписывание HTTPS блока..."
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "   📦 Бэкап: $BACKUP_FILE"
echo ""

# Удаляем старый HTTPS блок и создаем новый
TMP_FILE=$(mktemp)

# Копируем всё до HTTPS блока
head -n $((SERVER_START - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем правильный HTTPS блок
SERVER_INDENT=$(sed -n "${SERVER_START}p" "$CONFIG_FILE" | sed 's/server.*//')

cat >> "$TMP_FILE" << 'EOF'
    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name nardist.site www.nardist.site;

        # SSL сертификат
        ssl_certificate /etc/letsencrypt/live/nardist.site/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nardist.site/privkey.pem;
        
        # SSL настройки
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Логи
        access_log /var/log/nginx/nardist.site_https_access.log;
        error_log /var/log/nginx/nardist.site_https_error.log;

        # ВАЖНО: НЕТ root и index - только proxy_pass!

        # Проксирование Backend API
        location /api {
            rewrite ^/api(.*)$ $1 break;
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_redirect off;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Проксирование WebSocket
        location /socket.io {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Проксирование игровых WebSocket
        location /games {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /matchmaking {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://127.0.0.1:3000/health;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            access_log off;
        }

        # Frontend (React приложение) - ВАЖНО: должен быть последним!
        location / {
            proxy_pass http://127.0.0.1:5173;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_redirect off;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            proxy_intercept_errors off;
        }
    }
EOF

# Добавляем остаток файла после HTTPS блока
tail -n +$((SERVER_END + 1)) "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "   ✅ HTTPS блок полностью переписан"
echo ""

# 4. Проверяем синтаксис
echo "4️⃣ Проверка синтаксиса..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен"
    echo ""
    
    echo "🔄 Полная перезагрузка nginx..."
    systemctl restart nginx
    sleep 3
    
    if systemctl is-active --quiet nginx; then
        echo "   ✅ Nginx перезапущен"
        echo ""
        
        echo "🧪 Тестирование..."
        sleep 2
        
        HTTPS_RESPONSE=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -10)
        if echo "$HTTPS_RESPONSE" | grep -qi "Website.*ready\|content is to be added\|ispmanager"; then
            echo "   ❌ Все еще заглушка!"
            echo ""
            echo "   Первые строки ответа:"
            echo "$HTTPS_RESPONSE" | head -5 | sed 's/^/      /'
            echo ""
            echo "   Проверьте:"
            echo "   1. Есть ли другие конфигурационные файлы"
            echo "   2. Работает ли frontend: curl http://localhost:5173"
            echo "   3. Логи nginx: tail -f /var/log/nginx/error.log"
        else
            echo "   ✅ Заглушка исчезла!"
            if echo "$HTTPS_RESPONSE" | grep -qi "Нарды\|vite\|root.*div"; then
                echo "   ✅ Это frontend приложение!"
            fi
        fi
    else
        echo "   ❌ Nginx не запустился!"
        journalctl -u nginx -n 20 --no-pager | tail -10
    fi
else
    echo "   ❌ Ошибка в синтаксисе!"
    nginx -t 2>&1 | sed 's/^/      /'
    echo ""
    echo "🔄 Восстановление из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo "✅ Исправление завершено!"

