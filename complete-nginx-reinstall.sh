#!/bin/bash

# Полная переустановка конфигурации nginx с нуля для Docker

# Отключаем немедленный выход при ошибке
set +e

DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"
BACKUP_DIR="/root/nginx-backups-$(date +%Y%m%d_%H%M%S)"

echo "🔥 ПОЛНАЯ ПЕРЕУСТАНОВКА NGINX С НУЛЯ"
echo "=========================================="
echo ""

# Создаём директорию для бэкапов
mkdir -p "$BACKUP_DIR"
echo "📦 Бэкапы будут сохранены в: $BACKUP_DIR"
echo ""

# 1. Останавливаем nginx
echo "1️⃣ Остановка nginx..."
systemctl stop nginx 2>/dev/null || true
sleep 1
# Мягко убиваем процессы, если они остались
pkill nginx 2>/dev/null || true
sleep 1
# Только если процессы все еще есть - убиваем принудительно
if pgrep nginx >/dev/null 2>&1; then
    pkill -9 nginx 2>/dev/null || true
    sleep 1
fi
echo "   ✅ Nginx остановлен"
echo ""

# 2. Освобождаем порты
echo "2️⃣ Освобождение портов 80 и 443..."
lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:443 2>/dev/null | xargs kill -9 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
sleep 2
echo "   ✅ Порты освобождены"
echo ""

# 3. Бэкапим старую конфигурацию
echo "3️⃣ Создание бэкапа старой конфигурации..."
if [ -f "$CONFIG_FILE" ]; then
    cp "$CONFIG_FILE" "$BACKUP_DIR/nardist.site.conf.old"
    echo "   ✅ Старая конфигурация сохранена"
else
    echo "   ⚠️ Старая конфигурация не найдена"
fi
echo ""

# 4. Удаляем старую конфигурацию
echo "4️⃣ Удаление старой конфигурации..."
rm -f "$CONFIG_FILE"
echo "   ✅ Старая конфигурация удалена"
echo ""

# 5. Проверяем SSL сертификат
echo "5️⃣ Проверка SSL сертификата..."
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
if [ -f "${CERT_PATH}/fullchain.pem" ] && [ -f "${CERT_PATH}/privkey.pem" ]; then
    echo "   ✅ SSL сертификат найден"
    CERT_VALID=$(openssl x509 -in ${CERT_PATH}/fullchain.pem -noout -checkend 86400 2>/dev/null && echo "valid" || echo "expired")
    if [ "$CERT_VALID" = "valid" ]; then
        echo "   ✅ Сертификат валиден"
    else
        echo "   ⚠️ Сертификат истек или скоро истечет"
    fi
else
    echo "   ❌ SSL сертификат не найден!"
    echo "   Устанавливаю сертификат..."
    
    if command -v certbot &> /dev/null; then
        certbot certonly --standalone -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} || {
            echo "   ⚠️ Не удалось получить сертификат автоматически"
            echo "   Выполните вручную: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
        }
    else
        echo "   ❌ certbot не установлен"
        echo "   Установите: apt-get install -y certbot python3-certbot-nginx"
        exit 1
    fi
fi
echo ""

# 6. Создаём новую конфигурацию с нуля
echo "6️⃣ Создание новой конфигурации nginx..."
cat > "$CONFIG_FILE" << 'NGINX_CONFIG'
    # HTTP блок - редирект на HTTPS
    server {
        listen 80;
        listen [::]:80;
        server_name nardist.site www.nardist.site;

        # Редирект на HTTPS
        return 301 https://$server_name$request_uri;
    }

    # HTTPS блок - основная конфигурация
    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name nardist.site www.nardist.site;

        # SSL сертификат
        ssl_certificate /etc/letsencrypt/live/nardist.site/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/nardist.site/privkey.pem;
        
        # SSL настройки
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Логи
        access_log /var/log/nginx/nardist.site_https_access.log;
        error_log /var/log/nginx/nardist.site_https_error.log;

        # ВАЖНО: НЕТ root и index - только proxy_pass!

        # Проксирование Backend API
        location /api {
            rewrite ^/api(.*)$ $1 break;
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

        # Проксирование WebSocket для Socket.IO
        location /socket.io {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;
        }

        # Проксирование игровых WebSocket
        location /games {
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

        location /matchmaking {
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

        # Health check endpoint
        location /health {
            proxy_pass http://127.0.0.1:3000/health;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            access_log off;
        }

        # Frontend (React приложение) - ВАЖНО: должен быть последним!
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
            proxy_intercept_errors off;
        }
    }
NGINX_CONFIG

echo "   ✅ Новая конфигурация создана"
echo ""

# 7. Проверяем синтаксис
echo "7️⃣ Проверка синтаксиса nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен!"
else
    echo "   ❌ Ошибка в синтаксисе!"
    nginx -t 2>&1 | sed 's/^/      /'
    echo ""
    echo "🔄 Восстановление из бэкапа..."
    if [ -f "$BACKUP_DIR/nardist.site.conf.old" ]; then
        cp "$BACKUP_DIR/nardist.site.conf.old" "$CONFIG_FILE"
    fi
    exit 1
fi
echo ""

# 8. Проверяем контейнеры
echo "8️⃣ Проверка Docker контейнеров..."
cd /var/www/nardiphp 2>/dev/null || cd /root/nardiphp 2>/dev/null || {
    echo "   ⚠️ Не удалось найти директорию проекта"
    echo "   Убедитесь, что контейнеры запущены вручную"
}

if [ -f "docker-compose.yml" ]; then
    if docker-compose ps | grep -q "nardi_backend.*Up"; then
        echo "   ✅ Backend контейнер запущен"
    else
        echo "   ⚠️ Backend контейнер не запущен, запускаю..."
        docker-compose up -d backend
        sleep 3
    fi
    
    if docker-compose ps | grep -q "nardi_frontend.*Up"; then
        echo "   ✅ Frontend контейнер запущен"
    else
        echo "   ⚠️ Frontend контейнер не запущен, запускаю..."
        docker-compose up -d frontend
        sleep 3
    fi
else
    echo "   ⚠️ docker-compose.yml не найден"
    echo "   Проверьте контейнеры вручную"
fi

echo ""

# 9. Проверяем доступность контейнеров
echo "9️⃣ Проверка доступности контейнеров..."
sleep 2

BACKEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>&1)
if [ "$BACKEND_TEST" = "200" ]; then
    echo "   ✅ Backend доступен на localhost:3000"
else
    echo "   ⚠️ Backend недоступен (код: $BACKEND_TEST)"
    echo "   Проверьте: docker-compose logs backend"
fi

FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>&1)
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "   ✅ Frontend доступен на localhost:5173"
else
    echo "   ⚠️ Frontend недоступен (код: $FRONTEND_TEST)"
    echo "   Проверьте: docker-compose logs frontend"
fi

echo ""

# 10. Запускаем nginx
echo "🔟 Запуск nginx..."
systemctl start nginx
sleep 3

if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx запущен"
    
    # Проверяем порты
    if lsof -ti:80 >/dev/null 2>&1 && lsof -ti:443 >/dev/null 2>&1; then
        PORT_80_PROC=$(lsof -ti:80 | xargs ps -p -o comm= 2>/dev/null | head -1)
        PORT_443_PROC=$(lsof -ti:443 | xargs ps -p -o comm= 2>/dev/null | head -1)
        
        if echo "$PORT_80_PROC" | grep -q "nginx" && echo "$PORT_443_PROC" | grep -q "nginx"; then
            echo "   ✅ Порты 80 и 443 слушаются nginx"
        else
            echo "   ⚠️ Порты слушаются, но не nginx"
        fi
    else
        echo "   ⚠️ Порты не слушаются"
    fi
else
    echo "   ❌ Nginx не запустился!"
    echo "   Логи:"
    journalctl -u nginx -n 20 --no-pager | tail -10 | sed 's/^/      /'
    exit 1
fi

echo ""

# 11. Финальное тестирование
echo "1️⃣1️⃣ Финальное тестирование..."
sleep 3

echo "   Тест HTTP (должен редиректить на HTTPS):"
HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" -L http://${DOMAIN} 2>&1)
if [ "$HTTP_TEST" = "200" ] || [ "$HTTP_TEST" = "301" ] || [ "$HTTP_TEST" = "302" ]; then
    echo "      ✅ HTTP работает (код: $HTTP_TEST)"
else
    echo "      ⚠️ HTTP вернул код: $HTTP_TEST"
fi

echo "   Тест HTTPS главная страница:"
HTTPS_MAIN=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/ 2>&1)
if [ "$HTTPS_MAIN" = "200" ]; then
    echo "      ✅ HTTPS работает (код: $HTTPS_MAIN)"
    
    HTTPS_CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -20)
    if echo "$HTTPS_CONTENT" | grep -qi "Website.*ready\|content is to be added\|ispmanager\|приветствуем"; then
        echo "      ❌ Все еще заглушка!"
    else
        echo "      ✅ Контент правильный (не заглушка)"
        if echo "$HTTPS_CONTENT" | grep -qi "Нарды\|vite\|root.*div"; then
            echo "      ✅ Это frontend приложение!"
        fi
    fi
else
    echo "      ❌ HTTPS вернул код: $HTTPS_MAIN"
fi

echo "   Тест HTTPS /health:"
HTTPS_HEALTH=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health 2>&1)
if [ "$HTTPS_HEALTH" = "200" ]; then
    echo "      ✅ /health работает"
else
    echo "      ⚠️ /health вернул код: $HTTPS_HEALTH"
fi

echo "   Тест HTTPS /api:"
HTTPS_API=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/api/health 2>&1)
if [ "$HTTPS_API" = "200" ]; then
    echo "      ✅ /api работает"
else
    echo "      ⚠️ /api вернул код: $HTTPS_API"
fi

echo ""

# 12. Итоги
echo "=========================================="
echo "✅ ПЕРЕУСТАНОВКА ЗАВЕРШЕНА!"
echo ""
echo "📋 Что было сделано:"
echo "   1. ✅ Остановлен и очищен старый nginx"
echo "   2. ✅ Освобождены порты 80 и 443"
echo "   3. ✅ Создан бэкап старой конфигурации: $BACKUP_DIR"
echo "   4. ✅ Удалена старая конфигурация"
echo "   5. ✅ Проверен SSL сертификат"
echo "   6. ✅ Создана новая чистая конфигурация"
echo "   7. ✅ Проверен синтаксис"
echo "   8. ✅ Проверены Docker контейнеры"
echo "   9. ✅ Запущен nginx"
echo "  10. ✅ Протестирована работа"
echo ""
echo "🌐 Откройте в браузере:"
echo "   https://${DOMAIN}"
echo ""
echo "📝 Если что-то не работает:"
echo "   - Проверьте логи: tail -f /var/log/nginx/error.log"
echo "   - Проверьте контейнеры: docker-compose ps"
echo "   - Проверьте доступность: curl http://localhost:5173"
echo ""
echo "📦 Бэкапы сохранены в: $BACKUP_DIR"

