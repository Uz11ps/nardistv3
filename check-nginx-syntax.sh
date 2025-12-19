#!/bin/bash

# Скрипт для проверки синтаксиса и показа ошибок

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔍 Проверка синтаксиса Nginx..."
echo ""

# Проверяем синтаксис
nginx -t 2>&1 | tee /tmp/nginx-test.log

echo ""
echo "=== Строки вокруг ошибки (если есть) ==="
ERROR_LINE=$(grep -o "line [0-9]*" /tmp/nginx-test.log | grep -o "[0-9]*" | head -1)
if [ -n "$ERROR_LINE" ]; then
    echo "Ошибка на строке: $ERROR_LINE"
    echo ""
    echo "Строки $((ERROR_LINE - 5))-$((ERROR_LINE + 5)):"
    sed -n "$((ERROR_LINE - 5)),$((ERROR_LINE + 5))p" "$CONFIG_FILE"
fi

echo ""
echo "=== Подсчет открывающих и закрывающих скобок ==="
OPEN_BRACES=$(grep -o "{" "$CONFIG_FILE" | wc -l)
CLOSE_BRACES=$(grep -o "}" "$CONFIG_FILE" | wc -l)
echo "Открывающих скобок { : $OPEN_BRACES"
echo "Закрывающих скобок } : $CLOSE_BRACES"

if [ "$OPEN_BRACES" -ne "$CLOSE_BRACES" ]; then
    echo "⚠️ Несоответствие количества скобок!"
fi

echo ""
echo "=== Последние 10 строк файла ==="
tail -10 "$CONFIG_FILE"

echo ""
echo "=== Все закрывающие скобки с номерами строк ==="
grep -n "^[[:space:]]*}" "$CONFIG_FILE"

