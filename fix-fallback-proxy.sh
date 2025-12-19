#!/bin/bash

# Исправление @fallback для проксирования на Docker контейнеры

SERVER="root@91.229.9.80"

echo "🔧 Исправление @fallback для проксирования на Docker..."

ssh $SERVER << ENDSSH
echo "📝 Проверка текущей конфигурации @fallback:"
grep -A 10 "@fallback" /etc/nginx/vhosts/www-root/nardist.site.conf

echo ""
echo "🔧 Решение: Изменить @fallback чтобы проксировать на Docker контейнеры"

# Создаем бэкап если его нет
if [ ! -f /etc/nginx/vhosts/www-root/nardist.site.conf.backup ]; then
    cp /etc/nginx/vhosts/www-root/nardist.site.conf /etc/nginx/vhosts/www-root/nardist.site.conf.backup
    echo "✅ Бэкап создан"
fi

# Используем sed для замены proxy_pass в @fallback
# Заменяем proxy_pass http://127.0.0.1:8080 на proxy_pass http://127.0.0.1:5173
sed -i 's|proxy_pass http://127.0.0.1:8080;|proxy_pass http://127.0.0.1:5173;|g' /etc/nginx/vhosts/www-root/nardist.site.conf
sed -i 's|proxy_redirect http://127.0.0.1:8080 /;|proxy_redirect http://127.0.0.1:5173 /;|g' /etc/nginx/vhosts/www-root/nardist.site.conf

echo "✅ @fallback изменен для проксирования на frontend (порт 5173)"

# Теперь добавим location блоки для API в кастомную конфигурацию
mkdir -p /etc/nginx/vhosts-resources/nardist.site/dynamic/

cat > /etc/nginx/vhosts-resources/nardist.site/dynamic/api.conf << 'EOF'
# API проксирование (загружается через @fallback include)
# Но лучше добавить отдельные location блоки

# Переопределяем для /api чтобы не попадать в @fallback
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

echo "✅ API location блоки добавлены"

# Но лучше добавить их ПЕРЕД основным location / в основной конфигурации
# Проверим структуру файла
echo ""
echo "📝 Структура конфигурации:"
grep -n "location" /etc/nginx/vhosts/www-root/nardist.site.conf | head -10

# Добавим location /api ПЕРЕД основным location /
# Найдем строку с location / и добавим перед ней location /api
LINE_NUM=$(grep -n "^[[:space:]]*location / {" /etc/nginx/vhosts/www-root/nardist.site.conf | head -1 | cut -d: -f1)

if [ ! -z "$LINE_NUM" ]; then
    echo ""
    echo "🔧 Добавляем location /api перед строкой $LINE_NUM"
    
    # Создаем временный файл с новой конфигурацией
    head -n $((LINE_NUM - 1)) /etc/nginx/vhosts/www-root/nardist.site.conf > /tmp/nardist_new.conf
    
    # Добавляем location /api
    cat >> /tmp/nardist_new.conf << 'EOF'
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
    
    # Добавляем остальную часть файла
    tail -n +$LINE_NUM /etc/nginx/vhosts/www-root/nardist.site.conf >> /tmp/nardist_new.conf
    
    # Заменяем оригинальный файл
    mv /tmp/nardist_new.conf /etc/nginx/vhosts/www-root/nardist.site.conf
    
    echo "✅ Location блоки для API добавлены"
fi

# Проверяем синтаксис
echo ""
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
else
    echo "❌ Ошибка в конфигурации!"
    nginx -t
    echo ""
    echo "💡 Восстановление из бэкапа..."
    cp /etc/nginx/vhosts/www-root/nardist.site.conf.backup /etc/nginx/vhosts/www-root/nardist.site.conf
    echo "Бэкап восстановлен"
fi
ENDSSH

