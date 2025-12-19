#!/bin/bash

# Скрипт для добавления location блоков в HTTPS server блок

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Добавление location блоков в HTTPS конфигурацию..."
echo ""

# Создаём бэкап
cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Находим HTTPS server блок (с listen 443)
HTTPS_SERVER_LINE=""
SERVER_LINES=$(grep -n "server_name.*nardist.site" "$CONFIG_FILE" | cut -d: -f1)

for LINE in $SERVER_LINES; do
    # Находим начало server блока
    START_LINE=$LINE
    while [ "$START_LINE" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${START_LINE}p" "$CONFIG_FILE"); then
            break
        fi
        START_LINE=$((START_LINE - 1))
    done
    
    # Проверяем есть ли listen 443
    BLOCK=$(sed -n "${START_LINE},$((LINE + 10))p" "$CONFIG_FILE")
    if echo "$BLOCK" | grep -q "listen.*443"; then
        HTTPS_SERVER_LINE=$START_LINE
        break
    fi
done

if [ -z "$HTTPS_SERVER_LINE" ]; then
    echo "❌ HTTPS server блок не найден"
    echo "Сначала настройте SSL: certbot --nginx -d nardist.site -d www.nardist.site"
    exit 1
fi

echo "✅ HTTPS server блок найден на строке $HTTPS_SERVER_LINE"

# Находим конец server блока
SERVER_CLOSE=""
INDENT=$(sed -n "${HTTPS_SERVER_LINE}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
INDENT=$((INDENT - 1))

for i in $(seq $((HTTPS_SERVER_LINE + 1)) $(wc -l < "$CONFIG_FILE")); do
    line=$(sed -n "${i}p" "$CONFIG_FILE")
    line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
    line_indent=$((line_indent - 1))
    
    if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
        SERVER_CLOSE=$i
        break
    fi
done

if [ -z "$SERVER_CLOSE" ]; then
    echo "❌ Не найдена закрывающая скобка HTTPS server блока"
    exit 1
fi

echo "✅ HTTPS server блок заканчивается на строке $SERVER_CLOSE"

# Проверяем есть ли уже location блоки
HTTPS_BLOCK=$(sed -n "${HTTPS_SERVER_LINE},${SERVER_CLOSE}p" "$CONFIG_FILE")
if echo "$HTTPS_BLOCK" | grep -q "location /api"; then
    echo "✅ Location блоки уже есть в HTTPS конфигурации"
    exit 0
fi

# Сохраняем начало файла до HTTPS server блока
BEFORE_SERVER=$(head -n $((HTTPS_SERVER_LINE - 1)) "$CONFIG_FILE")

# Сохраняем конец файла после HTTPS server блока
AFTER_SERVER=$(tail -n +$((SERVER_CLOSE + 1)) "$CONFIG_FILE")

# Получаем отступ для server блока
SERVER_INDENT=$(sed -n "${HTTPS_SERVER_LINE}p" "$CONFIG_FILE" | sed 's/server.*//')

# Получаем ВСЕ настройки из HTTPS server блока, кроме location блоков
SERVER_BLOCK=$(sed -n "${HTTPS_SERVER_LINE},${SERVER_CLOSE}p" "$CONFIG_FILE")

ALL_SETTINGS=""
IN_LOCATION=0
LOCATION_INDENT=0

while IFS= read -r line; do
    if echo "$line" | grep -q "^[[:space:]]*server {" || echo "$line" | grep -q "^[[:space:]]*}$"; then
        continue
    fi
    
    if echo "$line" | grep -q "^[[:space:]]*location "; then
        IN_LOCATION=1
        LOCATION_INDENT=$(echo "$line" | sed 's/location.*//' | wc -c)
        LOCATION_INDENT=$((LOCATION_INDENT - 1))
        continue
    fi
    
    if [ "$IN_LOCATION" -eq 1 ]; then
        line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
        line_indent=$((line_indent - 1))
        
        if [ "$line_indent" -le "$LOCATION_INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
            IN_LOCATION=0
        fi
        continue
    fi
    
    ALL_SETTINGS="${ALL_SETTINGS}${line}\n"
done <<< "$SERVER_BLOCK"

ALL_SETTINGS=$(echo -e "$ALL_SETTINGS" | sed '$d')

# Создаём временный файл
TMP_FILE=$(mktemp)

# Добавляем начало файла
echo "$BEFORE_SERVER" > "$TMP_FILE"

# Добавляем начало HTTPS server блока
echo -n "$SERVER_INDENT" >> "$TMP_FILE"
echo "server {" >> "$TMP_FILE"

# Добавляем все сохранённые настройки
if [ -n "$ALL_SETTINGS" ]; then
    echo -e "$ALL_SETTINGS" >> "$TMP_FILE"
fi

# Добавляем location блоки
cat >> "$TMP_FILE" << 'EOF'
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
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

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
    }

EOF

# Добавляем закрывающую скобку server блока
echo -n "$SERVER_INDENT" >> "$TMP_FILE"
echo "}" >> "$TMP_FILE"

# Добавляем остальную часть файла
echo "$AFTER_SERVER" >> "$TMP_FILE"

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Location блоки добавлены в HTTPS конфигурацию"

# Проверяем синтаксис
echo ""
echo "Проверка синтаксиса:"
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    
    echo ""
    echo "Перезагрузка Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "Проверка работы HTTPS:"
    curl -k -s https://nardist.site | head -10
    echo ""
else
    echo "❌ Ошибка в синтаксисе!"
    nginx -t 2>&1
    exit 1
fi

