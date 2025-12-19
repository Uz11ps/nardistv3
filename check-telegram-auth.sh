#!/bin/bash

echo "🔍 Диагностика авторизации Telegram"
echo ""

# Проверить переменные окружения в .env
if [ -f .env ]; then
    echo "📋 Переменные из .env:"
    grep -E "TELEGRAM_BOT_TOKEN" .env | sed 's/=.*/=***/' || echo "❌ TELEGRAM_BOT_TOKEN не найден в .env"
    echo ""
fi

# Проверить переменные в контейнере backend
echo "📋 Переменные в контейнере backend:"
if docker-compose exec -T backend printenv | grep -E "TELEGRAM_BOT_TOKEN" > /dev/null 2>&1; then
    echo "✅ TELEGRAM_BOT_TOKEN найден в контейнере"
    docker-compose exec -T backend printenv | grep -E "TELEGRAM_BOT_TOKEN" | sed 's/=.*/=***/'
else
    echo "❌ TELEGRAM_BOT_TOKEN НЕ найден в контейнере!"
    echo ""
    echo "💡 Решение:"
    echo "1. Убедитесь что .env файл существует и содержит TELEGRAM_BOT_TOKEN"
    echo "2. Перезапустите контейнеры: docker-compose down && docker-compose up -d"
fi
echo ""

# Проверить логи backend на ошибки авторизации
echo "📋 Последние ошибки авторизации в логах backend:"
docker-compose logs --tail=50 backend | grep -i -E "error|unauthorized|telegram|initData|secret" || echo "Ошибок не найдено"
echo ""

# Проверить доступность API
echo "🔍 Проверка API /health:"
curl -s http://localhost:3000/health | jq . || curl -s http://localhost:3000/health
echo ""

# Проверить что backend запущен
echo "📋 Статус контейнеров:"
docker-compose ps backend
echo ""

echo "💡 Если переменные не настроены:"
echo "1. Откройте @BotFather в Telegram"
echo "2. Создайте бота или выберите существующего: /mybots"
echo "3. Получите токен бота (например: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz)"
echo "4. Привяжите домен: Bot Settings → Domain → nardist.site"
echo "5. Отредактируйте .env файл и добавьте:"
echo "   TELEGRAM_BOT_TOKEN=ваш_токен_бота"
echo "6. Перезапустите: docker-compose restart backend"
echo ""
echo "ℹ️  Примечание: TELEGRAM_SECRET_KEY больше не требуется!"
echo "   Авторизация работает только через TELEGRAM_BOT_TOKEN"

