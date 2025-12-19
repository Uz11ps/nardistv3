#!/bin/bash

# Финальное исправление конфигурации Nginx для ISPmanager

SERVER="root@91.229.9.80"

echo "🔧 Финальное исправление конфигурации Nginx..."

ssh $SERVER << ENDSSH
echo "🔍 Проверка статуса Apache:"
systemctl status apache2 --no-pager | head -3

echo ""
echo "🛑 Остановка Apache (если запущен):"
systemctl stop apache2 2>/dev/null || echo "Apache уже остановлен"
systemctl disable apache2 2>/dev/null || echo "Apache уже отключен"

echo ""
echo "🔧 Исправление кастомной конфигурации (убираем root):"

# Удаляем старую конфигурацию если есть
rm -f /etc/nginx/vhosts-resources/nardist.site/proxy.conf

# Создаем правильную конфигурацию БЕЗ root директивы
cat > /etc/nginx/vhosts-resources/nardist.site/proxy.conf << 'EOF'
# Кастомная конфигурация для проксирования на Docker контейнеры
# БЕЗ root директивы, так как она уже есть в основной конфигурации ISPmanager

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
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
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
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}

location /health {
    proxy_pass http://127.0.0.1:3000/health;
    access_log off;
}
EOF

echo "✅ Конфигурация обновлена (без root директивы)"

# Проверяем синтаксис
echo "🔍 Проверка синтаксиса..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Синтаксис корректен"
    
    # Перезагружаем Nginx
    echo "🔄 Перезагрузка Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "⏳ Ожидание 3 секунды..."
    sleep 3
    
    echo ""
    echo "✅ Проверка после исправления:"
    echo "Frontend через домен:"
    curl -s http://nardist.site | head -15
    
    echo ""
    echo "Backend API через домен:"
    curl -s http://nardist.site/api/health
    
    echo ""
    echo "Проверка заголовков:"
    curl -s -I http://nardist.site | head -5
else
    echo "❌ Ошибка в конфигурации!"
    nginx -t
    echo ""
    echo "Проверьте конфигурацию вручную:"
    echo "cat /etc/nginx/vhosts-resources/nardist.site/proxy.conf"
fi
ENDSSH

