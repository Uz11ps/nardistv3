#!/bin/bash

echo "🔧 Настройка Telegram бота для nardist.site"
echo ""

# Проверить наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "📝 Создаю .env из примера..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Файл .env создан. Заполните переменные!"
    else
        echo "📝 Создаю базовый .env файл..."
        cat > .env << 'EOF'
# Database
POSTGRES_USER=nardi
POSTGRES_PASSWORD=secure_password_change
POSTGRES_DB=nardi_db

# JWT
JWT_SECRET=change_this_secret_key_min_32_chars_long

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_SECRET_KEY=your_secret_key_here

# Domain
DOMAIN=nardist.site

# Backend
BACKEND_PORT=3000
NODE_ENV=production

# Frontend
FRONTEND_PORT=5173
VITE_API_URL=https://nardist.site/api
VITE_WS_URL=wss://nardist.site
VITE_TELEGRAM_BOT_NAME=your_bot_name
EOF
        echo "✅ Файл .env создан. Заполните переменные!"
    fi
    exit 1
fi

# Проверить переменные
source .env

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ "$TELEGRAM_BOT_TOKEN" = "your_bot_token_here" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не настроен!"
    echo ""
    echo "📋 Инструкция:"
    echo "1. Откройте @BotFather в Telegram"
    echo "2. Отправьте /newbot или выберите существующего бота"
    echo "3. Скопируйте токен бота"
    echo "4. Отредактируйте .env файл: nano .env"
    echo "5. Вставьте токен в TELEGRAM_BOT_TOKEN=..."
    exit 1
fi

if [ -z "$TELEGRAM_SECRET_KEY" ] || [ "$TELEGRAM_SECRET_KEY" = "your_secret_key_here" ]; then
    echo "❌ TELEGRAM_SECRET_KEY не настроен!"
    echo ""
    echo "📋 Инструкция:"
    echo "1. Откройте @BotFather в Telegram"
    echo "2. Отправьте /mybots"
    echo "3. Выберите вашего бота"
    echo "4. Выберите 'Bot Settings' → 'Domain'"
    echo "5. Введите домен: nardist.site"
    echo "6. Скопируйте секретный ключ (Secret Key)"
    echo "7. Отредактируйте .env файл: nano .env"
    echo "8. Вставьте ключ в TELEGRAM_SECRET_KEY=..."
    exit 1
fi

echo "✅ Переменные окружения настроены"
echo ""

# Проверить что домен привязан
echo "🔍 Проверка привязки домена..."
echo ""
echo "📋 Убедитесь что домен привязан к боту:"
echo "1. Откройте @BotFather"
echo "2. Отправьте /mybots"
echo "3. Выберите вашего бота"
echo "4. Выберите 'Bot Settings' → 'Domain'"
echo "5. Должен быть указан домен: nardist.site"
echo ""

# Перезапустить контейнеры
echo "🔄 Перезапуск backend для применения изменений..."
docker-compose restart backend

echo ""
echo "⏳ Ожидание запуска backend (10 секунд)..."
sleep 10

# Проверить логи
echo ""
echo "📋 Последние логи backend:"
docker-compose logs --tail=20 backend

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Убедитесь что домен nardist.site привязан к боту через @BotFather"
echo "2. Откройте бота в Telegram и нажмите кнопку 'Открыть' или 'Start'"
echo "3. Если ошибка сохраняется, проверьте логи: docker-compose logs -f backend"

