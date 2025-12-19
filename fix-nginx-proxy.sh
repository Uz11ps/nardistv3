#!/bin/bash

# Скрипт для исправления проксирования Nginx к Docker контейнерам

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🔧 Исправление проксирования Nginx..."

ssh $SERVER << ENDSSH
cd $SERVER_PATH

echo "🔍 Проверка доступности контейнеров:"
echo "Frontend (localhost:5173):"
curl -s -I http://localhost:5173 | head -3 || echo "❌ Frontend недоступен"

echo ""
echo "Backend (localhost:3000):"
curl -s http://localhost:3000/health || echo "❌ Backend недоступен"

echo ""
echo "📝 Текущая конфигурация Nginx:"
cat /etc/nginx/conf.d/nardist.conf | head -30

echo ""
echo "🔧 Исправление конфигурации Nginx..."

# Создаем правильную конфигурацию
cat > /etc/nginx/conf.d/nardist.conf << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name nardist.site www.nardist.site;

    # Логи
    access_log /var/log/nginx/nardist_access.log;
    error_log /var/log/nginx/nardist_error.log;

    # Увеличиваем таймауты
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Frontend (React приложение)
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
        
        # Для SPA приложений
        proxy_redirect off;
    }

    # Backend API
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

    # WebSocket для Socket.IO
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Увеличенные таймауты для WebSocket
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
EOF

echo "✅ Конфигурация обновлена"

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
    echo "Frontend:"
    curl -s http://nardist.site | head -10
    
    echo ""
    echo "Backend API:"
    curl -s http://nardist.site/api/health || echo "API недоступен"
else
    echo "❌ Ошибка в конфигурации!"
    nginx -t
fi
ENDSSH

