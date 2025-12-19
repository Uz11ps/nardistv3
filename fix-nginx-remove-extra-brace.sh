#!/bin/bash

# Скрипт для удаления лишней закрывающей скобки

CONFIG_FILE="/etc/nginx/vhosts/www-root/nardist.site.conf"

echo "🔧 Удаление лишней закрывающей скобки..."

# Создаём бэкап
cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Показываем последние строки
echo ""
echo "Последние 10 строк файла:"
tail -10 "$CONFIG_FILE"

# Подсчитываем скобки
OPEN_BRACES=$(grep -o "{" "$CONFIG_FILE" | wc -l)
CLOSE_BRACES=$(grep -o "}" "$CONFIG_FILE" | wc -l)

echo ""
echo "Открывающих скобок { : $OPEN_BRACES"
echo "Закрывающих скобок } : $CLOSE_BRACES"

if [ "$OPEN_BRACES" -eq "$CLOSE_BRACES" ]; then
    echo "✅ Количество скобок совпадает, но есть проблема с синтаксисом"
    echo "Проверяем последние строки..."
fi

# Удаляем последнюю строку если она пустая или содержит только закрывающую скобку
LAST_LINE=$(tail -1 "$CONFIG_FILE")
PENULTIMATE_LINE=$(tail -2 "$CONFIG_FILE" | head -1)

echo ""
echo "Предпоследняя строка: '$PENULTIMATE_LINE'"
echo "Последняя строка: '$LAST_LINE'"

# Если последняя строка - это закрывающая скобка, и предпоследняя тоже закрывающая скобка,
# удаляем последнюю
if echo "$LAST_LINE" | grep -q "^[[:space:]]*}$" && echo "$PENULTIMATE_LINE" | grep -q "^[[:space:]]*}$"; then
    echo ""
    echo "⚠️ Найдены две закрывающие скобки подряд, удаляем последнюю..."
    
    # Удаляем последнюю строку
    head -n -1 "$CONFIG_FILE" > "$CONFIG_FILE.tmp"
    mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    
    echo "✅ Лишняя закрывающая скобка удалена"
else
    echo ""
    echo "Проверяем структуру файла..."
    
    # Проверяем все закрывающие скобки
    echo "Все закрывающие скобки с контекстом:"
    grep -n "^[[:space:]]*}" "$CONFIG_FILE" | tail -5
fi

# Проверяем синтаксис
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
    echo "Проверка работы:"
    curl -s http://nardist.site | head -10
    echo ""
    curl -s http://nardist.site/api/health
    echo ""
else
    echo "❌ Ошибка в синтаксисе!"
    nginx -t 2>&1
fi

