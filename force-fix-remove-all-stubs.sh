#!/bin/bash

# Скрипт для принудительного удаления всех заглушек

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Принудительное удаление всех заглушек..."
echo ""

# Создаём бэкап
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "📦 Создан бэкап: $BACKUP_FILE"
echo ""

# 1. Удаляем все root и index директивы
echo "1️⃣ Удаление всех root и index директив..."
sed -i '/^[[:space:]]*root[[:space:]]/d' "$CONFIG_FILE"
sed -i '/^[[:space:]]*index[[:space:]]/d' "$CONFIG_FILE"
echo "   ✅ root и index удалены"
echo ""

# 2. Удаляем переменные $root_path
echo "2️⃣ Удаление переменных root_path..."
sed -i 's/\$root_path//g' "$CONFIG_FILE"
sed -i 's/\$document_root//g' "$CONFIG_FILE"
echo "   ✅ Переменные удалены"
echo ""

# 3. Находим HTTPS блок и исправляем location /
echo "3️⃣ Исправление location / в HTTPS блоке..."
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
    
    # Находим location /
    LOCATION_ROOT_START=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE" | grep -n "^[[:space:]]*location / {" | head -1 | cut -d: -f1)
    LOCATION_ROOT_START=$((SERVER_START + LOCATION_ROOT_START - 1))
    
    if [ -n "$LOCATION_ROOT_START" ] && [ "$LOCATION_ROOT_START" -ge "$SERVER_START" ]; then
        # Находим конец location /
        LOCATION_ROOT_END=$LOCATION_ROOT_START
        LOCATION_INDENT=$(sed -n "${LOCATION_ROOT_START}p" "$CONFIG_FILE" | sed 's/location.*//' | wc -c)
        LOCATION_INDENT=$((LOCATION_INDENT - 1))
        
        for i in $(seq $((LOCATION_ROOT_START + 1)) $SERVER_END); do
            line=$(sed -n "${i}p" "$CONFIG_FILE")
            line_indent=$(echo "$line" | sed 's/[^ ].*//' | wc -c)
            line_indent=$((line_indent - 1))
            
            if [ "$line_indent" -le "$LOCATION_INDENT" ] && echo "$line" | grep -q "^[[:space:]]*}$"; then
                LOCATION_ROOT_END=$i
                break
            fi
        done
        
        # Проверяем, есть ли proxy_pass на 5173
        LOCATION_BLOCK=$(sed -n "${LOCATION_ROOT_START},${LOCATION_ROOT_END}p" "$CONFIG_FILE")
        
        if ! echo "$LOCATION_BLOCK" | grep -q "proxy_pass.*5173"; then
            echo "   ⚠️ location / не проксирует на 5173, исправляю..."
            
            # Удаляем try_files если есть
            sed -i "${LOCATION_ROOT_START},${LOCATION_ROOT_END}s|try_files.*||g" "$CONFIG_FILE"
            
            # Заменяем proxy_pass на правильный
            sed -i "${LOCATION_ROOT_START},${LOCATION_ROOT_END}s|proxy_pass.*|proxy_pass http://127.0.0.1:5173;|g" "$CONFIG_FILE"
            
            # Если proxy_pass вообще нет, добавляем
            if ! sed -n "${LOCATION_ROOT_START},${LOCATION_ROOT_END}p" "$CONFIG_FILE" | grep -q "proxy_pass"; then
                # Добавляем перед закрывающей скобкой
                INSERT_LINE=$((LOCATION_ROOT_END - 1))
                LOCATION_INDENT_STR=$(sed -n "${LOCATION_ROOT_START}p" "$CONFIG_FILE" | sed 's/location.*//')
                
                TMP_FILE=$(mktemp)
                head -n $INSERT_LINE "$CONFIG_FILE" > "$TMP_FILE"
                
                cat >> "$TMP_FILE" << EOF
${LOCATION_INDENT_STR}        proxy_pass http://127.0.0.1:5173;
${LOCATION_INDENT_STR}        proxy_http_version 1.1;
${LOCATION_INDENT_STR}        proxy_set_header Upgrade \$http_upgrade;
${LOCATION_INDENT_STR}        proxy_set_header Connection 'upgrade';
${LOCATION_INDENT_STR}        proxy_set_header Host \$host;
${LOCATION_INDENT_STR}        proxy_set_header X-Real-IP \$remote_addr;
${LOCATION_INDENT_STR}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${LOCATION_INDENT_STR}        proxy_set_header X-Forwarded-Proto \$scheme;
${LOCATION_INDENT_STR}        proxy_cache_bypass \$http_upgrade;
${LOCATION_INDENT_STR}        proxy_redirect off;
EOF
                
                tail -n +$LOCATION_ROOT_END "$CONFIG_FILE" >> "$TMP_FILE"
                mv "$TMP_FILE" "$CONFIG_FILE"
            fi
            
            echo "   ✅ location / исправлен"
        else
            echo "   ✅ location / уже правильный"
        fi
    else
        echo "   ❌ location / не найден в HTTPS блоке!"
        echo "   Нужно добавить - запустите: ./fix-https-complete.sh"
    fi
fi

echo ""

# 4. Удаляем все try_files из location /
echo "4️⃣ Удаление try_files из location /..."
sed -i '/location \/ {/,/^[[:space:]]*}/s/try_files.*;//g' "$CONFIG_FILE"
echo "   ✅ try_files удалены"
echo ""

# 5. Проверяем синтаксис
echo "5️⃣ Проверка синтаксиса..."
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
        
        HTTPS_TEST=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -50)
        if echo "$HTTPS_TEST" | grep -qi "ispmanager\|приветствуем\|только что создан"; then
            echo "   ❌ Все еще заглушка!"
            echo ""
            echo "   Показываю первые строки ответа:"
            echo "$HTTPS_TEST" | head -10 | sed 's/^/      /'
            echo ""
            echo "   Запустите диагностику: ./find-where-stub-comes-from.sh"
        else
            echo "   ✅ Заглушка исчезла!"
            if echo "$HTTPS_TEST" | grep -qi "Нарды\|vite\|root"; then
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

