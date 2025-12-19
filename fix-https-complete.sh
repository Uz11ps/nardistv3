#!/bin/bash

# Скрипт для полного исправления HTTPS конфигурации

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Полное исправление HTTPS конфигурации..."
echo ""

# Создаём бэкап
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "📦 Создан бэкап: $BACKUP_FILE"
echo ""

# Находим HTTPS server блок
HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$HTTPS_BLOCK_START" ]; then
    echo "❌ HTTPS server блок не найден!"
    exit 1
fi

# Находим начало и конец HTTPS server блока
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

echo "✅ HTTPS server блок найден (строки $SERVER_START-$SERVER_END)"
echo ""

# Получаем текущий HTTPS блок
HTTPS_BLOCK=$(sed -n "${SERVER_START},${SERVER_END}p" "$CONFIG_FILE")

# Проверяем, есть ли root и index директивы (они конфликтуют с proxy_pass)
if echo "$HTTPS_BLOCK" | grep -q "^[[:space:]]*root\|^[[:space:]]*index"; then
    echo "⚠️ Найдены root/index директивы - они конфликтуют с proxy_pass"
    echo "   Нужно их убрать или закомментировать"
fi

# Получаем отступ для server блока
SERVER_INDENT=$(sed -n "${SERVER_START}p" "$CONFIG_FILE" | sed 's/server.*//')

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до HTTPS server блока
head -n $((SERVER_START - 1)) "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем правильный HTTPS server блок
cat >> "$TMP_FILE" << EOF
${SERVER_INDENT}server {
${SERVER_INDENT}    listen 443 ssl http2;
${SERVER_INDENT}    listen [::]:443 ssl http2;
${SERVER_INDENT}    server_name ${DOMAIN} www.${DOMAIN};

${SERVER_INDENT}    # SSL сертификат
${SERVER_INDENT}    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
${SERVER_INDENT}    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
${SERVER_INDENT}    
${SERVER_INDENT}    # SSL настройки
${SERVER_INDENT}    ssl_protocols TLSv1.2 TLSv1.3;
${SERVER_INDENT}    ssl_ciphers HIGH:!aNULL:!MD5;
${SERVER_INDENT}    ssl_prefer_server_ciphers on;

${SERVER_INDENT}    # Логи
${SERVER_INDENT}    access_log /var/log/nginx/${DOMAIN}_https_access.log;
${SERVER_INDENT}    error_log /var/log/nginx/${DOMAIN}_https_error.log;

${SERVER_INDENT}    # ВАЖНО: НЕ используем root и index - только proxy_pass!

${SERVER_INDENT}    # Проксирование Backend API
${SERVER_INDENT}    location /api {
${SERVER_INDENT}        rewrite ^/api(.*)$ \$1 break;
${SERVER_INDENT}        proxy_pass http://127.0.0.1:3000;
${SERVER_INDENT}        proxy_http_version 1.1;
${SERVER_INDENT}        proxy_set_header Upgrade \$http_upgrade;
${SERVER_INDENT}        proxy_set_header Connection 'upgrade';
${SERVER_INDENT}        proxy_set_header Host \$host;
${SERVER_INDENT}        proxy_set_header X-Real-IP \$remote_addr;
${SERVER_INDENT}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SERVER_INDENT}        proxy_set_header X-Forwarded-Proto \$scheme;
${SERVER_INDENT}        proxy_cache_bypass \$http_upgrade;
${SERVER_INDENT}        proxy_redirect off;
${SERVER_INDENT}        proxy_connect_timeout 60s;
${SERVER_INDENT}        proxy_send_timeout 60s;
${SERVER_INDENT}        proxy_read_timeout 60s;
${SERVER_INDENT}    }

${SERVER_INDENT}    # Проксирование WebSocket
${SERVER_INDENT}    location /socket.io {
${SERVER_INDENT}        proxy_pass http://127.0.0.1:3000;
${SERVER_INDENT}        proxy_http_version 1.1;
${SERVER_INDENT}        proxy_set_header Upgrade \$http_upgrade;
${SERVER_INDENT}        proxy_set_header Connection "upgrade";
${SERVER_INDENT}        proxy_set_header Host \$host;
${SERVER_INDENT}        proxy_set_header X-Real-IP \$remote_addr;
${SERVER_INDENT}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SERVER_INDENT}        proxy_set_header X-Forwarded-Proto \$scheme;
${SERVER_INDENT}        proxy_cache_bypass \$http_upgrade;
${SERVER_INDENT}        proxy_connect_timeout 7d;
${SERVER_INDENT}        proxy_send_timeout 7d;
${SERVER_INDENT}        proxy_read_timeout 7d;
${SERVER_INDENT}    }

${SERVER_INDENT}    # Проксирование игровых WebSocket
${SERVER_INDENT}    location /games {
${SERVER_INDENT}        proxy_pass http://127.0.0.1:3000;
${SERVER_INDENT}        proxy_http_version 1.1;
${SERVER_INDENT}        proxy_set_header Upgrade \$http_upgrade;
${SERVER_INDENT}        proxy_set_header Connection "upgrade";
${SERVER_INDENT}        proxy_set_header Host \$host;
${SERVER_INDENT}        proxy_set_header X-Real-IP \$remote_addr;
${SERVER_INDENT}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SERVER_INDENT}        proxy_set_header X-Forwarded-Proto \$scheme;
${SERVER_INDENT}        proxy_connect_timeout 7d;
${SERVER_INDENT}        proxy_send_timeout 7d;
${SERVER_INDENT}        proxy_read_timeout 7d;
${SERVER_INDENT}    }

${SERVER_INDENT}    location /matchmaking {
${SERVER_INDENT}        proxy_pass http://127.0.0.1:3000;
${SERVER_INDENT}        proxy_http_version 1.1;
${SERVER_INDENT}        proxy_set_header Upgrade \$http_upgrade;
${SERVER_INDENT}        proxy_set_header Connection "upgrade";
${SERVER_INDENT}        proxy_set_header Host \$host;
${SERVER_INDENT}        proxy_set_header X-Real-IP \$remote_addr;
${SERVER_INDENT}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SERVER_INDENT}        proxy_set_header X-Forwarded-Proto \$scheme;
${SERVER_INDENT}        proxy_connect_timeout 7d;
${SERVER_INDENT}        proxy_send_timeout 7d;
${SERVER_INDENT}        proxy_read_timeout 7d;
${SERVER_INDENT}    }

${SERVER_INDENT}    # Health check
${SERVER_INDENT}    location /health {
${SERVER_INDENT}        proxy_pass http://127.0.0.1:3000/health;
${SERVER_INDENT}        proxy_http_version 1.1;
${SERVER_INDENT}        proxy_set_header Host \$host;
${SERVER_INDENT}        proxy_set_header X-Real-IP \$remote_addr;
${SERVER_INDENT}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SERVER_INDENT}        proxy_set_header X-Forwarded-Proto \$scheme;
${SERVER_INDENT}        access_log off;
${SERVER_INDENT}    }

${SERVER_INDENT}    # Frontend (React приложение) - ВАЖНО: должен быть последним!
${SERVER_INDENT}    location / {
${SERVER_INDENT}        proxy_pass http://127.0.0.1:5173;
${SERVER_INDENT}        proxy_http_version 1.1;
${SERVER_INDENT}        proxy_set_header Upgrade \$http_upgrade;
${SERVER_INDENT}        proxy_set_header Connection 'upgrade';
${SERVER_INDENT}        proxy_set_header Host \$host;
${SERVER_INDENT}        proxy_set_header X-Real-IP \$remote_addr;
${SERVER_INDENT}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SERVER_INDENT}        proxy_set_header X-Forwarded-Proto \$scheme;
${SERVER_INDENT}        proxy_cache_bypass \$http_upgrade;
${SERVER_INDENT}        proxy_redirect off;
${SERVER_INDENT}        proxy_connect_timeout 60s;
${SERVER_INDENT}        proxy_send_timeout 60s;
${SERVER_INDENT}        proxy_read_timeout 60s;
${SERVER_INDENT}        
${SERVER_INDENT}        # Для SPA приложений
${SERVER_INDENT}        proxy_intercept_errors off;
${SERVER_INDENT}    }
${SERVER_INDENT}}

EOF

# Добавляем остаток файла после HTTPS блока
tail -n +$((SERVER_END + 1)) "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ HTTPS server блок полностью переписан"
echo ""

# Проверяем синтаксис
echo "🔍 Проверка синтаксиса nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Синтаксис корректен!"
    echo ""
    
    echo "🔄 Перезагрузка nginx..."
    systemctl reload nginx || service nginx reload
    sleep 2
    echo ""
    
    echo "🧪 Тестирование HTTPS..."
    sleep 1
    
    # Проверяем health endpoint
    HEALTH_TEST=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health 2>&1)
    if [ "$HEALTH_TEST" = "200" ]; then
        echo "   ✅ /health работает (код: $HEALTH_TEST)"
    else
        echo "   ⚠️ /health вернул код: $HEALTH_TEST"
    fi
    
    # Проверяем главную страницу
    MAIN_TEST=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/ 2>&1)
    if [ "$MAIN_TEST" = "200" ]; then
        echo "   ✅ Главная страница работает (код: $MAIN_TEST)"
    else
        echo "   ⚠️ Главная страница вернула код: $MAIN_TEST"
    fi
    
    # Проверяем, что это не заглушка
    MAIN_CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -20)
    if echo "$MAIN_CONTENT" | grep -qi "заглушка\|welcome\|default\|ispmanager\|только что создан"; then
        echo "   ❌ Все еще показывает заглушку!"
        echo "   Проверьте, что frontend контейнер работает на порту 5173"
    else
        echo "   ✅ Контент выглядит правильно (не заглушка)"
    fi
    
    echo ""
    echo "✅ Исправление завершено!"
    echo ""
    echo "🔍 Проверьте работу:"
    echo "   curl -k -I https://${DOMAIN}"
    echo "   curl -k https://${DOMAIN}/health"
    echo "   curl -k https://${DOMAIN}/ | head -20"
    
else
    echo "❌ Ошибка в синтаксисе nginx!"
    nginx -t 2>&1 | sed 's/^/   /'
    echo ""
    echo "🔄 Восстановление из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

