#!/bin/bash

# Скрипт для освобождения порта 443 и запуска nginx

echo "🔧 Освобождение порта 443 и запуск nginx..."
echo ""

# 1. Находим процесс, занимающий порт 443
echo "1️⃣ Поиск процесса на порту 443..."
PORT_443_PID=$(lsof -ti:443 2>/dev/null || fuser 443/tcp 2>/dev/null | awk '{print $1}' || ss -tlnp | grep ':443' | awk '{print $NF}' | cut -d',' -f2 | cut -d'=' -f2 | head -1)

if [ -n "$PORT_443_PID" ]; then
    echo "   ✅ Найден процесс с PID: $PORT_443_PID"
    
    # Определяем имя процесса
    PROCESS_NAME=$(ps -p $PORT_443_PID -o comm= 2>/dev/null || echo "unknown")
    echo "   Процесс: $PROCESS_NAME"
    echo ""
    
    echo "2️⃣ Остановка процесса..."
    
    # Если это nginx - останавливаем правильно
    if echo "$PROCESS_NAME" | grep -q "nginx"; then
        echo "   Это nginx, останавливаю через systemctl..."
        systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null
        sleep 2
    # Если это Apache - останавливаем
    elif echo "$PROCESS_NAME" | grep -q "apache\|httpd"; then
        echo "   Это Apache, останавливаю..."
        systemctl stop apache2 2>/dev/null || systemctl stop httpd 2>/dev/null || service apache2 stop 2>/dev/null || service httpd stop 2>/dev/null
        sleep 2
    else
        # Убиваем процесс
        echo "   Убиваю процесс $PORT_443_PID..."
        kill -9 $PORT_443_PID 2>/dev/null
        sleep 1
    fi
    
    # Проверяем, освободился ли порт
    sleep 1
    if lsof -ti:443 >/dev/null 2>&1 || fuser 443/tcp >/dev/null 2>&1; then
        echo "   ⚠️ Порт все еще занят, убиваю все процессы на 443..."
        lsof -ti:443 | xargs kill -9 2>/dev/null
        fuser -k 443/tcp 2>/dev/null
        sleep 2
    fi
else
    echo "   ⚠️ Не удалось найти процесс через lsof/fuser"
    echo "   Пробую через ss/netstat..."
    
    # Альтернативный способ
    PORT_443_INFO=$(ss -tlnp | grep ':443' | head -1)
    if [ -n "$PORT_443_INFO" ]; then
        echo "   Найдено: $PORT_443_INFO"
        # Пытаемся извлечь PID
        PORT_443_PID=$(echo "$PORT_443_INFO" | grep -oP 'pid=\K[0-9]+' | head -1)
        if [ -n "$PORT_443_PID" ]; then
            echo "   Убиваю PID: $PORT_443_PID"
            kill -9 $PORT_443_PID 2>/dev/null
            sleep 2
        fi
    fi
fi

echo ""

# 2. Проверяем, освободился ли порт
echo "3️⃣ Проверка освобождения порта 443..."
sleep 1
if lsof -ti:443 >/dev/null 2>&1 || fuser 443/tcp >/dev/null 2>&1; then
    echo "   ❌ Порт 443 все еще занят!"
    echo "   Принудительно убиваю все процессы..."
    
    # Более агрессивный подход
    pkill -9 nginx 2>/dev/null
    pkill -9 apache2 2>/dev/null
    pkill -9 httpd 2>/dev/null
    lsof -ti:443 | xargs kill -9 2>/dev/null
    fuser -k 443/tcp 2>/dev/null
    
    sleep 3
    
    if lsof -ti:443 >/dev/null 2>&1; then
        echo "   ❌ Не удалось освободить порт 443!"
        echo "   Проверьте вручную: lsof -i:443"
        exit 1
    else
        echo "   ✅ Порт 443 освобожден!"
    fi
else
    echo "   ✅ Порт 443 свободен!"
fi

echo ""

# 3. Проверяем конфигурацию nginx
echo "4️⃣ Проверка конфигурации nginx..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Конфигурация nginx корректна"
else
    echo "   ❌ Ошибки в конфигурации nginx:"
    nginx -t 2>&1 | sed 's/^/      /'
    exit 1
fi

echo ""

# 4. Запускаем nginx
echo "5️⃣ Запуск nginx..."
systemctl start nginx 2>/dev/null || service nginx start 2>/dev/null || nginx

sleep 2

# Проверяем статус
if systemctl is-active --quiet nginx || pgrep -x nginx > /dev/null; then
    echo "   ✅ Nginx запущен"
else
    echo "   ❌ Не удалось запустить nginx"
    echo "   Проверьте логи: journalctl -u nginx -n 50"
    exit 1
fi

echo ""

# 5. Проверяем, что порт 443 слушается nginx
echo "6️⃣ Проверка порта 443..."
sleep 1
if lsof -ti:443 >/dev/null 2>&1; then
    PORT_443_PID_NEW=$(lsof -ti:443 | head -1)
    PROCESS_NAME_NEW=$(ps -p $PORT_443_PID_NEW -o comm= 2>/dev/null || echo "unknown")
    if echo "$PROCESS_NAME_NEW" | grep -q "nginx"; then
        echo "   ✅ Порт 443 теперь слушается nginx (PID: $PORT_443_PID_NEW)"
    else
        echo "   ⚠️ Порт 443 слушается процессом: $PROCESS_NAME_NEW (PID: $PORT_443_PID_NEW)"
    fi
else
    echo "   ⚠️ Порт 443 не слушается"
fi

echo ""

# 6. Тестируем HTTPS
echo "7️⃣ Тестирование HTTPS..."
sleep 2
HTTPS_TEST=$(curl -k -s -o /dev/null -w "%{http_code}" https://nardist.site/health 2>&1)
if [ "$HTTPS_TEST" = "200" ]; then
    echo "   ✅ HTTPS работает! (код: $HTTPS_TEST)"
elif [ "$HTTPS_TEST" = "404" ]; then
    echo "   ⚠️ HTTPS отвечает, но 404 (возможно проблема с location блоками)"
elif [ "$HTTPS_TEST" = "502" ]; then
    echo "   ❌ HTTPS возвращает 502 (проблема с проксированием)"
else
    echo "   ⚠️ HTTPS вернул код: $HTTPS_TEST"
fi

echo ""
echo "=========================================="
echo "✅ Готово!"
echo ""
echo "Проверьте работу:"
echo "   curl -k -I https://nardist.site"
echo "   curl -k https://nardist.site/health"
echo ""
echo "Если все еще не работает, проверьте:"
echo "   tail -f /var/log/nginx/error.log"
echo "   systemctl status nginx"

