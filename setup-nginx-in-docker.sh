#!/bin/bash

# Настройка nginx внутри Docker

echo "🐳 Настройка nginx внутри Docker..."
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
    echo "   Установите сертификаты: certbot certonly --standalone -d nardist.site"
    exit 1
fi

echo ""

# 4. Проверяем структуру директорий
echo "4️⃣ Проверка структуры директорий..."
if [ ! -d "nginx" ]; then
    echo "   Создаю директорию nginx..."
    mkdir -p nginx
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

# 5. Останавливаем старые контейнеры
echo "5️⃣ Остановка старых контейнеров..."
cd /var/www/nardiphp 2>/dev/null || cd /root/nardiphp 2>/dev/null || {
    echo "   ❌ Не удалось найти директорию проекта"
    exit 1
}

docker-compose down nginx 2>/dev/null || true
echo "   ✅ Старые контейнеры остановлены"
echo ""

# 6. Собираем и запускаем nginx контейнер
echo "6️⃣ Сборка и запуск nginx контейнера..."
docker-compose build nginx
if [ $? -eq 0 ]; then
    echo "   ✅ Nginx контейнер собран"
else
    echo "   ❌ Ошибка при сборке nginx контейнера!"
    exit 1
fi

docker-compose up -d nginx
if [ $? -eq 0 ]; then
    echo "   ✅ Nginx контейнер запущен"
else
    echo "   ❌ Ошибка при запуске nginx контейнера!"
    exit 1
fi

echo ""

# 7. Проверяем статус
echo "7️⃣ Проверка статуса контейнеров..."
sleep 3
docker-compose ps | grep -E "nginx|frontend|backend" | sed 's/^/   /'
echo ""

# 8. Проверяем порты
echo "8️⃣ Проверка портов..."
if docker ps | grep -q "nardi_nginx"; then
    echo "   ✅ Nginx контейнер запущен"
    
    # Проверяем, что порты проброшены
    if docker port nardi_nginx | grep -q "443"; then
        echo "   ✅ Порт 443 проброшен"
    else
        echo "   ❌ Порт 443 не проброшен!"
    fi
    
    if docker port nardi_nginx | grep -q "80"; then
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

# 9. Тестирование
echo "9️⃣ Тестирование..."
sleep 2

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

