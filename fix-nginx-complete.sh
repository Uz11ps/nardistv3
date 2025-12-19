#!/bin/bash

# Полный скрипт для исправления Nginx конфигурации

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Полное исправление Nginx конфигурации..."

# Создаём бэкап если его нет
if [ ! -f "$CONFIG_FILE.backup" ]; then
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    echo "✅ Бэкап создан"
fi

# Восстанавливаем из бэкапа
echo ""
echo "Восстановление из бэкапа..."
cp "$CONFIG_FILE.backup" "$CONFIG_FILE"
echo "✅ Конфигурация восстановлена"

# Проверяем что frontend контейнер работает
echo ""
echo "Проверка frontend контейнера:"
if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
    echo "✅ Frontend контейнер отвечает на порту 5173"
else
    echo "⚠️ Frontend контейнер не отвечает на порту 5173"
    echo "Проверьте: docker-compose ps frontend"
fi

# Находим location / (не /api, не /socket.io, не /health)
LOC_LINE=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | head -1 | cut -d: -f1)

if [ -z "$LOC_LINE" ]; then
    echo "❌ Не найдена строка с location /"
    exit 1
fi

echo ""
echo "✅ location / найден на строке $LOC_LINE"

# Находим закрывающую скобку location /
LOCATION_CLOSE=""
INDENT=$(sed -n "${LOC_LINE}p" "$CONFIG_FILE" | sed 's/location.*//' | wc -c)
INDENT=$((INDENT - 1))

for i in $(seq $((LOC_LINE + 1)) $(wc -l < "$CONFIG_FILE")); do
    line=$(sed -n "${i}p" "$CONFIG_FILE")
    line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
    line_indent=$((line_indent - 1))
    
    if [ "$line_indent" -le "$INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
        LOCATION_CLOSE=$i
        break
    fi
done

if [ -z "$LOCATION_CLOSE" ]; then
    echo "❌ Не найдена закрывающая скобка location /"
    exit 1
fi

echo "✅ Закрывающая скобка location / на строке $LOCATION_CLOSE"

# Находим server блок и проверяем что location / внутри него
SERVER_LINE=$(grep -n "^[[:space:]]*server {" "$CONFIG_FILE" | head -1 | cut -d: -f1)
SERVER_CLOSE=""
if [ -n "$SERVER_LINE" ]; then
    SERVER_INDENT=$(sed -n "${SERVER_LINE}p" "$CONFIG_FILE" | sed 's/server.*//' | wc -c)
    SERVER_INDENT=$((SERVER_INDENT - 1))
    
    for i in $(seq $((SERVER_LINE + 1)) $(wc -l < "$CONFIG_FILE")); do
        line=$(sed -n "${i}p" "$CONFIG_FILE")
        line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
        line_indent=$((line_indent - 1))
        
        if [ "$line_indent" -le "$SERVER_INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
            SERVER_CLOSE=$i
            break
        fi
    done
    
    if [ -n "$SERVER_CLOSE" ]; then
        echo "✅ server блок найден: строки $SERVER_LINE-$SERVER_CLOSE"
        if [ "$LOC_LINE" -lt "$SERVER_CLOSE" ]; then
            echo "✅ location / находится внутри server блока"
        else
            echo "❌ location / находится ВНЕ server блока!"
            exit 1
        fi
    fi
fi

# Проверяем какие location блоки уже есть ПЕРЕД location /
BEFORE_LOC=$(head -n $((LOC_LINE - 1)) "$CONFIG_FILE")
if echo "$BEFORE_LOC" | grep -q "location /api {"; then
    HAS_API_BEFORE=1
else
    HAS_API_BEFORE=0
fi

if echo "$BEFORE_LOC" | grep -q "location /socket.io {"; then
    HAS_SOCKET_BEFORE=1
else
    HAS_SOCKET_BEFORE=0
fi

if echo "$BEFORE_LOC" | grep -q "location /health {"; then
    HAS_HEALTH_BEFORE=1
else
    HAS_HEALTH_BEFORE=0
fi

echo ""
echo "Найденные location блоки ПЕРЕД location /:"
echo "  location /api: $HAS_API_BEFORE"
echo "  location /socket.io: $HAS_SOCKET_BEFORE"
echo "  location /health: $HAS_HEALTH_BEFORE"

echo ""
echo "📝 Замена location / на проксирование на frontend..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до location /, но проверяем что мы внутри server блока
# Если location / находится после закрывающей скобки server, это ошибка
if [ -n "$SERVER_CLOSE" ] && [ "$LOC_LINE" -gt "$SERVER_CLOSE" ]; then
    echo "❌ location / находится ВНЕ server блока (server заканчивается на строке $SERVER_CLOSE, location / на строке $LOC_LINE)"
    echo "Проверьте структуру конфигурации вручную"
    exit 1
fi

head -n $((LOC_LINE - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем location блоки только если их ещё нет
if [ "$HAS_API_BEFORE" -eq 0 ]; then
    echo "Добавляем location /api..."
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

EOF
fi

if [ "$HAS_SOCKET_BEFORE" -eq 0 ]; then
    echo "Добавляем location /socket.io..."
    cat >> "$TMP_FILE" << 'EOF'
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

EOF
fi

if [ "$HAS_HEALTH_BEFORE" -eq 0 ]; then
    echo "Добавляем location /health..."
    cat >> "$TMP_FILE" << 'EOF'
    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

EOF
fi

# Добавляем location / с проксированием на frontend
cat >> "$TMP_FILE" << 'EOF'
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

# Добавляем остальную часть файла после закрывающей скобки location /
# Но сначала проверяем и удаляем дубликаты location / в остальной части
# И проверяем что мы не выходим за пределы server блока
AFTER_LOC=$(tail -n +$((LOCATION_CLOSE + 1)) "$CONFIG_FILE")

# Если есть server блок, обрезаем до его закрывающей скобки
# Но сначала проверяем что location / не находится после закрывающей скобки server
if [ -n "$SERVER_CLOSE" ]; then
    if [ "$LOCATION_CLOSE" -gt "$SERVER_CLOSE" ]; then
        echo "❌ location / находится ВНЕ server блока!"
        echo "server блок заканчивается на строке $SERVER_CLOSE, location / заканчивается на строке $LOCATION_CLOSE"
        exit 1
    fi
    # Если location / заканчивается на той же строке что и server блок, это нормально
    # Берем только до закрывающей скобки server блока (не включая её, она будет добавлена позже)
    if [ "$LOCATION_CLOSE" -lt "$SERVER_CLOSE" ]; then
        LINES_TO_TAKE=$((SERVER_CLOSE - LOCATION_CLOSE - 1))
        if [ "$LINES_TO_TAKE" -gt 0 ]; then
            AFTER_LOC=$(echo "$AFTER_LOC" | head -n "$LINES_TO_TAKE")
        else
            AFTER_LOC=""
        fi
    else
        # location / заканчивается вместе с server блоком - нет остатка
        AFTER_LOC=""
    fi
fi

# Находим все location / блоки в остальной части (кроме /api, /socket.io, /health)
ROOT_LINES_AFTER=$(echo "$AFTER_LOC" | grep -n "^[[:space:]]*location / {" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | cut -d: -f1)

# Если есть дубликаты, удаляем их (в обратном порядке чтобы номера строк не менялись)
if [ -n "$ROOT_LINES_AFTER" ]; then
    echo "⚠️ Найдены дубликаты location / в остальной части файла, удаляем..."
    # Сортируем номера строк в обратном порядке
    ROOT_LINES_SORTED=$(echo "$ROOT_LINES_AFTER" | sort -rn)
    
    for line_num in $ROOT_LINES_SORTED; do
        # Находим закрывающую скобку
        INDENT_AFTER=$(echo "$AFTER_LOC" | sed -n "${line_num}p" | sed 's/location.*//' | wc -c)
        INDENT_AFTER=$((INDENT_AFTER - 1))
        
        TOTAL_LINES_AFTER=$(echo "$AFTER_LOC" | wc -l)
        CLOSE_LINE_AFTER=""
        for i in $(seq $((line_num + 1)) $TOTAL_LINES_AFTER); do
            line_after=$(echo "$AFTER_LOC" | sed -n "${i}p")
            line_indent_after=$(echo "$line_after" | sed 's/[^ ].*//' | wc -c)
            line_indent_after=$((line_indent_after - 1))
            
            if [ "$line_indent_after" -le "$INDENT_AFTER" ] && echo "$line_after" | grep -q "^[[:space:]]*}$"; then
                CLOSE_LINE_AFTER=$i
                break
            fi
        done
        
        if [ -n "$CLOSE_LINE_AFTER" ]; then
            # Удаляем блок через sed (в обратном порядке)
            AFTER_LOC=$(echo "$AFTER_LOC" | sed "${line_num},${CLOSE_LINE_AFTER}d")
        fi
    done
fi

# Добавляем остальную часть только если она не пустая
# Но сначала удаляем все дубликаты location / из неё
if [ -n "$AFTER_LOC" ]; then
    # Находим все location / блоки в остальной части (кроме /api, /socket.io, /health)
    ROOT_LINES_AFTER=$(echo "$AFTER_LOC" | grep -n "^[[:space:]]*location / {" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | cut -d: -f1)
    
    # Если есть дубликаты, удаляем их (в обратном порядке чтобы номера строк не менялись)
    if [ -n "$ROOT_LINES_AFTER" ]; then
        echo "⚠️ Найдены дубликаты location / в остальной части файла, удаляем..."
        # Сортируем номера строк в обратном порядке
        ROOT_LINES_SORTED=$(echo "$ROOT_LINES_AFTER" | sort -rn)
        
        for line_num in $ROOT_LINES_SORTED; do
            # Находим закрывающую скобку
            INDENT_AFTER=$(echo "$AFTER_LOC" | sed -n "${line_num}p" | sed 's/location.*//' | wc -c)
            INDENT_AFTER=$((INDENT_AFTER - 1))
            
            TOTAL_LINES_AFTER=$(echo "$AFTER_LOC" | wc -l)
            CLOSE_LINE_AFTER=""
            for i in $(seq $((line_num + 1)) $TOTAL_LINES_AFTER); do
                line_after=$(echo "$AFTER_LOC" | sed -n "${i}p")
                line_indent_after=$(echo "$line_after" | sed 's/[^ ].*//' | wc -c)
                line_indent_after=$((line_indent_after - 1))
                
                if [ "$line_indent_after" -le "$INDENT_AFTER" ] && echo "$line_after" | grep -q "^[[:space:]]*}$"; then
                    CLOSE_LINE_AFTER=$i
                    break
                fi
            done
            
            if [ -n "$CLOSE_LINE_AFTER" ]; then
                # Удаляем блок через sed (в обратном порядке)
                AFTER_LOC=$(echo "$AFTER_LOC" | sed "${line_num},${CLOSE_LINE_AFTER}d")
            fi
        done
    fi
    
    echo "$AFTER_LOC" >> "$TMP_FILE"
fi

# Если есть server блок, добавляем его закрывающую скобку
if [ -n "$SERVER_CLOSE" ]; then
    # Проверяем что закрывающая скобка server блока есть в оригинальном файле
    SERVER_CLOSE_LINE=$(sed -n "${SERVER_CLOSE}p" "$CONFIG_FILE")
    
    # Если location / заканчивается раньше server блока, добавляем закрывающую скобку server
    if [ "$LOCATION_CLOSE" -lt "$SERVER_CLOSE" ]; then
        echo "$SERVER_CLOSE_LINE" >> "$TMP_FILE"
    fi
    # Если location / заканчивается вместе с server блоком, закрывающая скобка уже добавлена в location /
    
    # Добавляем остальную часть файла после закрывающей скобки server блока
    # Но сначала удаляем все дубликаты location / из неё
    AFTER_SERVER=$(tail -n +$((SERVER_CLOSE + 1)) "$CONFIG_FILE")
    
    # Находим все location / блоки в части после server блока
    ROOT_LINES_AFTER_SERVER=$(echo "$AFTER_SERVER" | grep -n "^[[:space:]]*location / {" | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | cut -d: -f1)
    
    # Если есть дубликаты, удаляем их
    if [ -n "$ROOT_LINES_AFTER_SERVER" ]; then
        echo "⚠️ Найдены дубликаты location / после server блока, удаляем..."
        ROOT_LINES_SORTED_SERVER=$(echo "$ROOT_LINES_AFTER_SERVER" | sort -rn)
        
        for line_num in $ROOT_LINES_SORTED_SERVER; do
            INDENT_AFTER_SERVER=$(echo "$AFTER_SERVER" | sed -n "${line_num}p" | sed 's/location.*//' | wc -c)
            INDENT_AFTER_SERVER=$((INDENT_AFTER_SERVER - 1))
            
            TOTAL_LINES_AFTER_SERVER=$(echo "$AFTER_SERVER" | wc -l)
            CLOSE_LINE_AFTER_SERVER=""
            for i in $(seq $((line_num + 1)) $TOTAL_LINES_AFTER_SERVER); do
                line_after_server=$(echo "$AFTER_SERVER" | sed -n "${i}p")
                line_indent_after_server=$(echo "$line_after_server" | sed 's/[^ ].*//' | wc -c)
                line_indent_after_server=$((line_indent_after_server - 1))
                
                if [ "$line_indent_after_server" -le "$INDENT_AFTER_SERVER" ] && echo "$line_after_server" | grep -q "^[[:space:]]*}$"; then
                    CLOSE_LINE_AFTER_SERVER=$i
                    break
                fi
            done
            
            if [ -n "$CLOSE_LINE_AFTER_SERVER" ]; then
                AFTER_SERVER=$(echo "$AFTER_SERVER" | sed "${line_num},${CLOSE_LINE_AFTER_SERVER}d")
            fi
        done
    fi
    
    echo "$AFTER_SERVER" >> "$TMP_FILE"
fi

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Конфигурация обновлена"

# Проверяем на дубликаты
echo ""
echo "Проверка дубликатов:"
API_COUNT=$(grep -c "location /api {" "$CONFIG_FILE" 2>/dev/null)
SOCKET_COUNT=$(grep -c "location /socket.io {" "$CONFIG_FILE" 2>/dev/null)
HEALTH_COUNT=$(grep -c "location /health {" "$CONFIG_FILE" 2>/dev/null)
ROOT_LINES=$(grep -n "^[[:space:]]*location / {" "$CONFIG_FILE" 2>/dev/null | grep -v "location /api" | grep -v "location /socket" | grep -v "location /health" | cut -d: -f1)
ROOT_COUNT=$(echo "$ROOT_LINES" | grep -c . || echo "0")

# Преобразуем в число (убираем все кроме цифр)
API_COUNT=$(echo "$API_COUNT" | grep -oE '[0-9]+' | head -1)
SOCKET_COUNT=$(echo "$SOCKET_COUNT" | grep -oE '[0-9]+' | head -1)
HEALTH_COUNT=$(echo "$HEALTH_COUNT" | grep -oE '[0-9]+' | head -1)
ROOT_COUNT=$(echo "$ROOT_COUNT" | grep -oE '[0-9]+' | head -1)

# Если пусто, устанавливаем 0
[ -z "$API_COUNT" ] && API_COUNT=0
[ -z "$SOCKET_COUNT" ] && SOCKET_COUNT=0
[ -z "$HEALTH_COUNT" ] && HEALTH_COUNT=0
[ -z "$ROOT_COUNT" ] && ROOT_COUNT=0

echo "  location /api: $API_COUNT"
echo "  location /socket.io: $SOCKET_COUNT"
echo "  location /health: $HEALTH_COUNT"
echo "  location /: $ROOT_COUNT"

if [ "$API_COUNT" -gt 1 ] || [ "$SOCKET_COUNT" -gt 1 ] || [ "$HEALTH_COUNT" -gt 1 ] || [ "$ROOT_COUNT" -gt 1 ]; then
    echo ""
    echo "❌ Найдены дубликаты! Показываю все location блоки:"
    grep -n "location /" "$CONFIG_FILE" | grep -v "^#"
    exit 1
fi

echo ""
echo "Проверка синтаксиса:"
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    
    echo ""
    echo "Перезагрузка Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "Ожидание 2 секунды..."
    sleep 2
    
    echo ""
    echo "Проверка работы frontend:"
    curl -s http://nardist.site | head -20
    echo ""
    
    echo ""
    echo "Проверка работы API:"
    curl -s http://nardist.site/api/health
    echo ""
    
    echo ""
    echo "✅ Всё готово!"
else
    echo "❌ Ошибка в синтаксисе!"
    nginx -t 2>&1
    exit 1
fi
