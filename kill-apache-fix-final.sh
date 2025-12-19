#!/bin/bash

# Финальное исправление - остановка Apache и проверка nginx

echo "🔥 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ - ОСТАНОВКА APACHE"
echo "=========================================="
echo ""

# 1. Останавливаем Apache полностью
echo "1️⃣ Остановка Apache..."
systemctl stop apache2 2>/dev/null || systemctl stop httpd 2>/dev/null || true
systemctl disable apache2 2>/dev/null || systemctl disable httpd 2>/dev/null || true

# Убиваем все процессы Apache
pkill apache2 2>/dev/null || true
pkill httpd 2>/dev/null || true
pkill -9 apache2 2>/dev/null || true
pkill -9 httpd 2>/dev/null || true

sleep 2

# Проверяем, что Apache остановлен
if pgrep -x apache2 >/dev/null 2>&1 || pgrep -x httpd >/dev/null 2>&1; then
    echo "   ⚠️ Apache все еще запущен, убиваю принудительно..."
    killall -9 apache2 2>/dev/null || true
    killall -9 httpd 2>/dev/null || true
    sleep 1
fi

if pgrep -x apache2 >/dev/null 2>&1 || pgrep -x httpd >/dev/null 2>&1; then
    echo "   ❌ Не удалось остановить Apache!"
    exit 1
else
    echo "   ✅ Apache полностью остановлен и отключен"
fi

echo ""

# 2. Освобождаем порты
echo "2️⃣ Освобождение портов 80 и 443..."
lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:443 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2
echo "   ✅ Порты освобождены"
echo ""

# 3. Проверяем конфигурацию nginx
echo "3️⃣ Проверка конфигурации nginx..."
DOMAIN="nardist.site"
CONFIG_FILE="/etc/nginx/vhosts/www-root/${DOMAIN}.conf"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "   ❌ Конфигурация nginx не найдена!"
    exit 1
fi

echo "   ✅ Конфигурация найдена: $CONFIG_FILE"
echo ""

# Проверяем синтаксис
if nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Синтаксис корректен"
else
    echo "   ❌ Ошибка в синтаксисе!"
    nginx -t 2>&1 | sed 's/^/      /'
    exit 1
fi

echo ""

# 4. Запускаем nginx
echo "4️⃣ Запуск nginx..."
systemctl start nginx
sleep 3

if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx запущен"
else
    echo "   ❌ Nginx не запустился!"
    journalctl -u nginx -n 20 --no-pager | tail -10
    exit 1
fi

echo ""

# 5. Проверяем порты
echo "5️⃣ Проверка портов..."
if lsof -ti:443 >/dev/null 2>&1; then
    PORT_443_PID=$(lsof -ti:443 | head -1)
    PORT_443_PROC=$(ps -p $PORT_443_PID -o comm= 2>/dev/null || echo "unknown")
    if echo "$PORT_443_PROC" | grep -q "nginx"; then
        echo "   ✅ Порт 443 слушается nginx (PID: $PORT_443_PID)"
    else
        echo "   ❌ Порт 443 слушается процессом: $PORT_443_PROC (не nginx!)"
        echo "   Убиваю процесс..."
        kill -9 $PORT_443_PID 2>/dev/null
        sleep 2
        systemctl restart nginx
        sleep 2
    fi
else
    echo "   ❌ Порт 443 не слушается!"
fi

if lsof -ti:80 >/dev/null 2>&1; then
    PORT_80_PID=$(lsof -ti:80 | head -1)
    PORT_80_PROC=$(ps -p $PORT_80_PID -o comm= 2>/dev/null || echo "unknown")
    if echo "$PORT_80_PROC" | grep -q "nginx"; then
        echo "   ✅ Порт 80 слушается nginx (PID: $PORT_80_PID)"
    else
        echo "   ⚠️ Порт 80 слушается процессом: $PORT_80_PROC"
    fi
else
    echo "   ⚠️ Порт 80 не слушается"
fi

echo ""

# 6. Тестирование
echo "6️⃣ Тестирование..."
sleep 2

echo "   Тест напрямую к IP (91.229.9.80):"
IP_RESPONSE=$(curl -k -s -H "Host: ${DOMAIN}" https://91.229.9.80/ 2>&1 | head -10)
if echo "$IP_RESPONSE" | grep -qi "Website.*ready\|content is to be added"; then
    echo "      ❌ Все еще заглушка!"
    echo "      Первые строки:"
    echo "$IP_RESPONSE" | head -5 | sed 's/^/         /'
    echo ""
    echo "      Проверяю, что реально отдает nginx..."
    
    # Проверяем логи nginx
    echo "      Последние запросы в логах:"
    tail -5 /var/log/nginx/access.log 2>/dev/null | sed 's/^/         /'
    echo ""
    
    # Проверяем, может быть nginx отдает статический файл
    echo "      Проверяю конфигурацию location /..."
    grep -A 10 "location /" "$CONFIG_FILE" | head -12 | sed 's/^/         /'
else
    echo "      ✅ Правильный контент!"
    if echo "$IP_RESPONSE" | grep -qi "Нарды\|vite\|root.*div"; then
        echo "      ✅ Это frontend приложение!"
    fi
fi

echo ""

# 7. Проверяем, нет ли статических файлов, которые nginx отдает
echo "7️⃣ Проверка статических файлов..."
# Ищем, может быть nginx отдает файлы из какой-то директории
if grep -q "root\|try_files" "$CONFIG_FILE"; then
    echo "   ⚠️ В конфигурации найдены root или try_files!"
    grep "root\|try_files" "$CONFIG_FILE" | sed 's/^/      /'
    echo "   Это может быть причиной!"
else
    echo "   ✅ root и try_files не найдены в конфигурации"
fi

echo ""

# 8. Финальная проверка
echo "8️⃣ Финальная проверка через домен..."
DOMAIN_RESPONSE=$(curl -k -s https://${DOMAIN}/ 2>&1 | head -10)
if echo "$DOMAIN_RESPONSE" | grep -qi "Website.*ready"; then
    echo "   ❌ Через домен все еще заглушка"
    echo ""
    echo "   Возможные причины:"
    echo "   1. ISPmanager перехватывает запросы"
    echo "   2. Есть другой прокси перед nginx"
    echo "   3. Nginx отдает статические файлы вместо проксирования"
    echo ""
    echo "   Проверьте в ISPmanager:"
    echo "   - WWW → ${DOMAIN} → Настройки"
    echo "   - Отключите проксирование/редирект"
    echo "   - Убедитесь, что используется nginx, а не Apache"
else
    echo "   ✅ Через домен правильный контент!"
fi

echo ""
echo "=========================================="
echo "✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo ""
echo "Если заглушка все еще показывается:"
echo "   1. Проверьте настройки в ISPmanager"
echo "   2. Проверьте логи: tail -f /var/log/nginx/error.log"
echo "   3. Очистите кэш браузера"
echo "   4. Попробуйте в режиме инкогнито"

