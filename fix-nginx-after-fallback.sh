#!/bin/bash

# Скрипт для добавления location блоков после @fallback

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"
BACKUP_FILE="${CONFIG_FILE}.backup"

set -e

echo "🔧 Исправление конфигурации Nginx (добавление после @fallback)..."

echo "📝 Шаг 1: Восстановление из бэкапа..."
cp "$BACKUP_FILE" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 2: Изменение @fallback для проксирования на frontend..."
sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:5173;|g' "$CONFIG_FILE"
sed -i 's|proxy_redirect http://127.0.0.1:8080 /;|proxy_redirect http://127.0.0.1:5173 /;|g' "$CONFIG_FILE"
echo "✅ @fallback изменен"

echo ""
echo "📝 Шаг 3: Поиск location @fallback..."
FALLBACK_LINE=$(grep -n "^[[:space:]]*location @fallback" "$CONFIG_FILE" | head -1 | cut -d: -f1)

if [ -z "$FALLBACK_LINE" ]; then
    echo "❌ Не найдена строка с location @fallback"
    exit 1
fi

echo "✅ Найдена строка $FALLBACK_LINE"

# Находим закрывающую скобку location @fallback
# Ищем первую строку после @fallback которая начинается с отступа и содержит только }
CLOSING_BRACE=$(awk -v line="$FALLBACK_LINE" '
NR > line && /^[[:space:]]+}$/ {
    # Проверяем что это закрывающая скобка с правильным отступом (больше чем у location)
    spaces = length($0) - length($1)
    if (spaces >= 4) {
        print NR
        exit
    }
}
' "$CONFIG_FILE")

if [ -z "$CLOSING_BRACE" ]; then
    # Пробуем более простой способ - ищем первую } после @fallback
    CLOSING_BRACE=$(awk -v line="$FALLBACK_LINE" 'NR > line && /^[[:space:]]*}$/ {print NR; exit}' "$CONFIG_FILE")
fi

if [ -z "$CLOSING_BRACE" ]; then
    echo "❌ Не найдена закрывающая скобка location @fallback"
    echo "Показываем строки после @fallback:"
    sed -n "$FALLBACK_LINE,$((FALLBACK_LINE+15))p" "$CONFIG_FILE"
    exit 1
fi

echo "✅ Закрывающая скобка на строке $CLOSING_BRACE"

# Показываем контекст
echo "Контекст:"
sed -n "$((CLOSING_BRACE-2)),$((CLOSING_BRACE+2))p" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 4: Добавление location блоков после @fallback..."

# Создаём временный файл
TMP_FILE=$(mktemp)

# Копируем всё до закрывающей скобки @fallback (включая её)
head -n $CLOSING_BRACE "$CONFIG_FILE" > "$TMP_FILE"

# Добавляем пустую строку и location блоки
cat >> "$TMP_FILE" << 'EOF'

    location /api {
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
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }

EOF

# Добавляем остальную часть файла после закрывающей скобки
tail -n +$((CLOSING_BRACE + 1)) "$CONFIG_FILE" >> "$TMP_FILE"

# Заменяем оригинальный файл
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Location блоки добавлены"

echo ""
echo "📝 Шаг 5: Проверка структуры..."
echo "Все location блоки:"
grep -n "^[[:space:]]*location" "$CONFIG_FILE"

echo ""
echo "📝 Шаг 6: Проверка синтаксиса..."
if nginx -t 2>&1; then
    echo "✅ Синтаксис корректен"
else
    echo "❌ Ошибка в синтаксисе!"
    echo "Восстанавливаем из бэкапа..."
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo "📝 Шаг 7: Перезагрузка Nginx..."
systemctl reload nginx
echo "✅ Nginx перезагружен"

echo ""
echo "⏳ Ожидание 3 секунды..."
sleep 3

echo ""
echo "📝 Шаг 8: Проверка работы..."
echo "Frontend:"
curl -s http://nardist.site 2>&1 | head -5
echo ""
echo "Backend API:"
curl -s http://nardist.site/api/health 2>&1

echo ""
echo "✅ Готово!"

