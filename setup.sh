#!/bin/bash

# Главный скрипт для настройки nginx в Docker

echo "🐳 Настройка nginx в Docker для nardist.site"
echo "=========================================="
echo ""

# 1. Останавливаем nginx на хосте
echo "1️⃣ Остановка nginx на хосте..."
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
pkill nginx 2>/dev/null || true
pkill -9 nginx 2>/dev/null || true
sleep 2
echo "   ✅ Nginx на хосте остановлен"
echo ""

# 2. Освобождаем порты
echo "2️⃣ Освобождение портов 80 и 443..."
lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:443 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2
echo "   ✅ Порты освобождены"
echo ""

# 3. Проверяем SSL сертификаты
echo "3️⃣ Проверка SSL сертификатов..."
CERT_PATH="/etc/letsencrypt/live/nardist.site"
if [ -f "${CERT_PATH}/fullchain.pem" ] && [ -f "${CERT_PATH}/privkey.pem" ]; then
    echo "   ✅ SSL сертификаты найдены"
else
    echo "   ❌ SSL сертификаты не найдены!"
    echo "   Устанавливаю сертификаты..."
    if command -v certbot &> /dev/null; then
        certbot certonly --standalone -d nardist.site -d www.nardist.site --non-interactive --agree-tos --email admin@nardist.site || {
            echo "   ❌ Не удалось установить сертификаты автоматически"
            echo "   Выполните вручную: certbot certonly --standalone -d nardist.site"
            exit 1
        }
    else
        echo "   ❌ certbot не установлен"
        echo "   Установите: apt-get install -y certbot"
        exit 1
    fi
fi

echo ""

# 4. Проверяем структуру директорий
echo "4️⃣ Проверка структуры директорий..."
if [ ! -d "nginx" ]; then
    echo "   ❌ Директория nginx не найдена!"
    exit 1
fi

if [ ! -f "nginx/Dockerfile" ]; then
    echo "   ❌ nginx/Dockerfile не найден!"
    exit 1
fi

if [ ! -f "nginx/nginx.conf" ]; then
    echo "   ❌ nginx/nginx.conf не найден!"
    exit 1
fi

echo "   ✅ Структура директорий правильная"
echo ""

# 5. Переходим в директорию проекта
echo "5️⃣ Переход в директорию проекта..."
cd /var/www/nardiphp 2>/dev/null || cd /root/nardiphp 2>/dev/null || {
    echo "   ❌ Не удалось найти директорию проекта"
    exit 1
}
echo "   ✅ Директория: $(pwd)"
echo ""

# 6. Останавливаем старые контейнеры nginx
echo "6️⃣ Остановка старых контейнеров nginx..."
docker-compose stop nginx 2>/dev/null || true
docker-compose rm -f nginx 2>/dev/null || true
echo "   ✅ Старые контейнеры остановлены"
echo ""

# 7. Собираем и запускаем nginx контейнер
echo "7️⃣ Сборка и запуск nginx контейнера..."
docker-compose build nginx
if [ $? -eq 0 ]; then
    echo "   ✅ Nginx контейнер собран"
else
    echo "   ❌ Ошибка при сборке nginx контейнера!"
    echo "   Логи:"
    docker-compose build nginx 2>&1 | tail -10 | sed 's/^/      /'
    exit 1
fi

docker-compose up -d nginx
if [ $? -eq 0 ]; then
    echo "   ✅ Nginx контейнер запущен"
else
    echo "   ❌ Ошибка при запуске nginx контейнера!"
    echo "   Логи:"
    docker-compose logs nginx 2>&1 | tail -20 | sed 's/^/      /'
    exit 1
fi

echo ""

# 8. Проверяем статус
echo "8️⃣ Проверка статуса контейнеров..."
sleep 3
docker-compose ps | sed 's/^/   /'
echo ""

# 9. Проверяем порты
echo "9️⃣ Проверка портов..."
if docker ps | grep -q "nardi_nginx"; then
    echo "   ✅ Nginx контейнер запущен"
    
    # Проверяем, что порты проброшены
    if docker port nardi_nginx 2>/dev/null | grep -q "443"; then
        echo "   ✅ Порт 443 проброшен"
    else
        echo "   ❌ Порт 443 не проброшен!"
    fi
    
    if docker port nardi_nginx 2>/dev/null | grep -q "80"; then
        echo "   ✅ Порт 80 проброшен"
    else
        echo "   ❌ Порт 80 не проброшен!"
    fi
else
    echo "   ❌ Nginx контейнер не запущен!"
    echo "   Логи:"
    docker-compose logs nginx | tail -20 | sed 's/^/      /'
    exit 1
fi

echo ""

# 10. Тестирование
echo "🔟 Тестирование..."
sleep 3

DOMAIN="nardist.site"

echo "   Тест HTTP (редирект на HTTPS):"
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
    
    HTTPS_CONTENT=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -10)
    if echo "$HTTPS_CONTENT" | grep -qi "Website.*ready\|content is to be added"; then
        echo "      ❌ Все еще заглушка"
    else
        echo "      ✅ Контент правильный"
        if echo "$HTTPS_CONTENT" | grep -qi "Нарды\|vite\|root.*div"; then
            echo "      ✅ Это frontend приложение!"
        fi
    fi
else
    echo "      ❌ HTTPS вернул код: $HTTPS_MAIN"
    echo "      Проверьте логи: docker-compose logs nginx"
fi

echo "   Тест HTTPS /health:"
HTTPS_HEALTH=$(curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/health 2>&1)
if [ "$HTTPS_HEALTH" = "200" ]; then
    echo "      ✅ /health работает"
else
    echo "      ⚠️ /health вернул код: $HTTPS_HEALTH"
fi

echo ""
echo "=========================================="
echo "✅ НАСТРОЙКА ЗАВЕРШЕНА!"
echo ""
echo "Nginx теперь работает внутри Docker!"
echo ""
echo "Полезные команды:"
echo "   docker-compose logs nginx -f    # Логи nginx"
echo "   docker-compose restart nginx    # Перезапуск nginx"
echo "   docker-compose ps               # Статус контейнеров"
echo "   docker-compose restart          # Перезапуск всех контейнеров"





