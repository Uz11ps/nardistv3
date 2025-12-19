#!/bin/bash

echo "🔧 Обновление переменных окружения для HTTPS..."

cd /var/www/nardiphp

# Обновляем .env для использования HTTPS
sed -i 's|VITE_API_URL=http://nardist.site|VITE_API_URL=https://nardist.site|' .env
sed -i 's|VITE_WS_URL=ws://nardist.site|VITE_WS_URL=wss://nardist.site|' .env

echo "✅ Переменные окружения обновлены"
echo ""
echo "Перезапускаем frontend для применения изменений..."
docker-compose restart frontend

echo ""
echo "Проверьте .env файл:"
grep VITE .env

