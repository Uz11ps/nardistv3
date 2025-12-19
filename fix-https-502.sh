#!/bin/bash

# Скрипт для исправления ошибки 502 Bad Gateway на HTTPS

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

echo "🔧 Исправление ошибки 502 Bad Gateway на HTTPS..."
echo ""

# Проверяем наличие конфигурационного файла
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Конфигурационный файл не найден: $CONFIG_FILE"
    echo "Проверьте путь к конфигурации nginx"
    exit 1
fi

echo "✅ Конфигурационный файл найден: $CONFIG_FILE"
echo ""

# Создаём бэкап
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "📦 Создан бэкап: $BACKUP_FILE"
echo ""

# Проверяем наличие SSL сертификата
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
if [ ! -f "${CERT_PATH}/fullchain.pem" ] || [ ! -f "${CERT_PATH}/privkey.pem" ]; then
    echo "⚠️ SSL сертификат не найден в ${CERT_PATH}"
    echo "Попытка установки через certbot..."
    
    if command -v certbot &> /dev/null; then
        certbot certonly --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || {
            echo "❌ Не удалось получить сертификат автоматически"
            echo "Выполните вручную: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
            exit 1
        }
    else
        echo "❌ certbot не установлен. Установите: apt-get install -y certbot python3-certbot-nginx"
        exit 1
    fi
else
    echo "✅ SSL сертификат найден"
fi

echo ""
echo "🔍 Анализ текущей конфигурации..."

# Проверяем наличие HTTPS server блока
if ! grep -q "listen.*443" "$CONFIG_FILE"; then
    echo "❌ HTTPS server блок (listen 443) не найден"
    echo "Добавляю HTTPS конфигурацию..."
    
    # Добавляем HTTPS server блок после HTTP блока
    cat >> "$CONFIG_FILE" << EOF

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate ${CERT_PATH}/fullchain.pem;
    ssl_certificate_key ${CERT_PATH}/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Логи
    access_log /var/log/nginx/${DOMAIN}_https_access.log;
    error_log /var/log/nginx/${DOMAIN}_https_error.log;

    # Проксирование Backend API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_redirect off;
    }

    # Проксирование WebSocket
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Проксирование игровых WebSocket
    location /games {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /matchmaking {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Frontend (React приложение)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_redirect off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
    echo "✅ HTTPS server блок добавлен"
else
    echo "✅ HTTPS server блок найден"
    
    # Проверяем наличие location блоков в HTTPS блоке
    HTTPS_BLOCK_START=$(grep -n "listen.*443" "$CONFIG_FILE" | head -1 | cut -d: -f1)
    
    # Находим начало server блока
    SERVER_START=$HTTPS_BLOCK_START
    while [ "$SERVER_START" -gt 0 ]; do
        if grep -q "^[[:space:]]*server {" <(sed -n "${SERVER_START}p" "$CONFIG_FILE"); then
            break
        fi
        SERVER_START=$((SERVER_START - 1))
    done
    
    # Находим конец server блока
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
    
    if ! echo "$HTTPS_BLOCK" | grep -q "location /api"; then
        echo "⚠️ Location блоки не найдены в HTTPS блоке"
        echo "Добавляю location блоки..."
        
        # Находим место для вставки (перед закрывающей скобкой)
        INSERT_LINE=$((SERVER_END - 1))
        
        # Получаем отступ
        SERVER_INDENT=$(sed -n "${SERVER_START}p" "$CONFIG_FILE" | sed 's/server.*//')
        
        # Создаём временный файл
        TMP_FILE=$(mktemp)
        
        # Копируем всё до места вставки
        head -n $INSERT_LINE "$CONFIG_FILE" > "$TMP_FILE"
        
        # Добавляем location блоки
        cat >> "$TMP_FILE" << EOF
${SERVER_INDENT}    # Проксирование Backend API
${SERVER_INDENT}    location /api {
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
${SERVER_INDENT}    }
${SERVER_INDENT}
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
${SERVER_INDENT}    }
${SERVER_INDENT}
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
${SERVER_INDENT}    }
${SERVER_INDENT}
${SERVER_INDENT}    location /matchmaking {
${SERVER_INDENT}        proxy_pass http://127.0.0.1:3000;
${SERVER_INDENT}        proxy_http_version 1.1;
${SERVER_INDENT}        proxy_set_header Upgrade \$http_upgrade;
${SERVER_INDENT}        proxy_set_header Connection "upgrade";
${SERVER_INDENT}        proxy_set_header Host \$host;
${SERVER_INDENT}        proxy_set_header X-Real-IP \$remote_addr;
${SERVER_INDENT}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SERVER_INDENT}        proxy_set_header X-Forwarded-Proto \$scheme;
${SERVER_INDENT}    }
${SERVER_INDENT}
${SERVER_INDENT}    # Health check
${SERVER_INDENT}    location /health {
${SERVER_INDENT}        proxy_pass http://127.0.0.1:3000;
${SERVER_INDENT}        proxy_http_version 1.1;
${SERVER_INDENT}        proxy_set_header Host \$host;
${SERVER_INDENT}        proxy_set_header X-Real-IP \$remote_addr;
${SERVER_INDENT}        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
${SERVER_INDENT}        proxy_set_header X-Forwarded-Proto \$scheme;
${SERVER_INDENT}    }
${SERVER_INDENT}
${SERVER_INDENT}    # Frontend (React приложение)
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
${SERVER_INDENT}    }
EOF
        
        # Добавляем остаток файла
        tail -n +$SERVER_END "$CONFIG_FILE" >> "$TMP_FILE"
        
        # Заменяем файл
        mv "$TMP_FILE" "$CONFIG_FILE"
        echo "✅ Location блоки добавлены"
    else
        echo "✅ Location блоки уже присутствуют"
    fi
fi

echo ""
echo "🔍 Проверка синтаксиса nginx..."

if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен!"
    echo ""
    echo "🔄 Перезагрузка nginx..."
    systemctl reload nginx || service nginx reload
    echo ""
    
    echo "🔍 Проверка работы контейнеров..."
    if docker ps | grep -q "nardi_backend\|nardi_frontend"; then
        echo "✅ Docker контейнеры запущены"
    else
        echo "⚠️ Docker контейнеры не найдены. Проверьте:"
        echo "   cd /var/www/nardiphp && docker-compose ps"
    fi
    
    echo ""
    echo "🔍 Проверка доступности портов..."
    if netstat -tlnp 2>/dev/null | grep -q ":3000\|:5173" || ss -tlnp 2>/dev/null | grep -q ":3000\|:5173"; then
        echo "✅ Порты 3000 и 5173 слушаются"
    else
        echo "⚠️ Порты 3000 или 5173 не слушаются"
        echo "   Проверьте, что контейнеры запущены и слушают правильные порты"
    fi
    
    echo ""
    echo "🧪 Тестирование HTTPS..."
    sleep 2
    if curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN} | grep -q "200\|301\|302"; then
        echo "✅ HTTPS работает!"
    else
        echo "⚠️ HTTPS все еще не работает. Проверьте логи:"
        echo "   tail -f /var/log/nginx/${DOMAIN}_https_error.log"
    fi
    
    echo ""
    echo "✅ Исправление завершено!"
    echo ""
    echo "📋 Что было сделано:"
    echo "   1. Проверен SSL сертификат"
    echo "   2. Добавлен/обновлен HTTPS server блок"
    echo "   3. Добавлены location блоки для проксирования"
    echo "   4. Перезагружен nginx"
    echo ""
    echo "🔍 Проверьте работу:"
    echo "   curl -I https://${DOMAIN}"
    echo "   curl https://${DOMAIN}/health"
    
else
    echo "❌ Ошибка в синтаксисе nginx!"
    nginx -t 2>&1
    echo ""
    echo "🔄 Восстановление из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    echo "Бэкап восстановлен: $BACKUP_FILE"
    exit 1
fi

