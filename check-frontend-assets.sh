#!/bin/bash

# Скрипт для проверки загрузки статических файлов frontend

echo "🔍 Проверка загрузки статических файлов frontend..."
echo ""

echo "1. Проверка HTML:"
curl -k -s https://nardist.site | grep -o 'src="[^"]*"' | head -5
curl -k -s https://nardist.site | grep -o 'href="[^"]*"' | head -5

echo ""
echo "2. Проверка загрузки JavaScript файла:"
JS_FILE=$(curl -k -s https://nardist.site | grep -o 'src="/assets/[^"]*\.js"' | head -1 | sed 's/src="//;s/"//')
if [ -n "$JS_FILE" ]; then
    echo "JS файл: $JS_FILE"
    echo "Проверка доступности:"
    curl -k -I "https://nardist.site$JS_FILE" 2>&1 | head -5
else
    echo "❌ JS файл не найден в HTML"
fi

echo ""
echo "3. Проверка загрузки CSS файла:"
CSS_FILE=$(curl -k -s https://nardist.site | grep -o 'href="/assets/[^"]*\.css"' | head -1 | sed 's/href="//;s/"//')
if [ -n "$CSS_FILE" ]; then
    echo "CSS файл: $CSS_FILE"
    echo "Проверка доступности:"
    curl -k -I "https://nardist.site$CSS_FILE" 2>&1 | head -5
else
    echo "❌ CSS файл не найден в HTML"
fi

echo ""
echo "4. Проверка что frontend контейнер раздает статику:"
docker-compose exec frontend ls -la /usr/share/nginx/html/assets/ | head -10

echo ""
echo "5. Проверка через прямой доступ к контейнеру:"
curl -s http://127.0.0.1:5173 | grep -o 'src="[^"]*"' | head -3

