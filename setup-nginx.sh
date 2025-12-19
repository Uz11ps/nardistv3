#!/bin/bash

# Скрипт для настройки Nginx на сервере для проксирования на Docker контейнеры

SERVER="root@91.229.9.80"
DOMAIN="nardist.site"
NGINX_CONFIG="/etc/nginx/conf.d/nardist.conf"

echo "🔧 Настройка Nginx для домена $DOMAIN..."

ssh $SERVER << ENDSSH
# Создаем конфигурацию Nginx
cat > $NGINX_CONFIG << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name nardist.site www.nardist.site;

    # Логи
    access_log /var/log/nginx/nardist_access.log;
    error_log /var/log/nginx/nardist_error.log;

    # Frontend (React приложение)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Таймауты для WebSocket
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Увеличенные таймауты для API
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket для Socket.IO
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Таймауты для WebSocket
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

echo "✅ Конфигурация создана: $NGINX_CONFIG"

# Проверяем синтаксис конфигурации
echo "🔍 Проверка синтаксиса Nginx..."
nginx -t

if [ \$? -eq 0 ]; then
    echo "✅ Синтаксис корректен"
    
    # Перезагружаем Nginx
    echo "🔄 Перезагрузка Nginx..."
    systemctl reload nginx || systemctl restart nginx
    
    echo "✅ Nginx перезагружен"
else
    echo "❌ Ошибка в конфигурации Nginx!"
    exit 1
fi

# Проверяем статус контейнеров
echo ""
echo "📊 Статус Docker контейнеров:"
cd /var/www/nardiphp
docker-compose ps

echo ""
echo "🔍 Проверка доступности сервисов:"
echo "Frontend (порт 5173):"
curl -s -I http://localhost:5173 | head -1 || echo "❌ Frontend недоступен"

echo "Backend (порт 3000):"
curl -s http://localhost:3000/health || echo "❌ Backend недоступен"

echo ""
echo "✅ Настройка завершена!"
echo "🌐 Откройте в браузере: http://$DOMAIN"
ENDSSH

echo ""
echo "🎉 Настройка Nginx завершена!"
echo "📝 Если нужно настроить SSL (HTTPS), выполните:"
echo "   ssh $SERVER"
echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"

