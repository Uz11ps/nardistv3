#!/bin/bash

# Быстрый деплой исправлений

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🚀 Быстрый деплой исправлений..."

# Загрузка исправленных файлов
echo "📤 Загрузка компонентов..."
scp frontend/src/components/Card.tsx $SERVER:$SERVER_PATH/frontend/src/components/
scp frontend/src/components/Button.tsx $SERVER:$SERVER_PATH/frontend/src/components/

echo "📤 Загрузка store..."
scp frontend/src/store/authStore.ts $SERVER:$SERVER_PATH/frontend/src/store/

echo "📤 Загрузка страниц..."
scp frontend/src/pages/Game.tsx $SERVER:$SERVER_PATH/frontend/src/pages/
scp frontend/src/pages/Clans.tsx $SERVER:$SERVER_PATH/frontend/src/pages/
scp frontend/src/pages/Profile.tsx $SERVER:$SERVER_PATH/frontend/src/pages/
scp frontend/src/pages/Academy.tsx $SERVER:$SERVER_PATH/frontend/src/pages/
scp frontend/src/pages/City.tsx $SERVER:$SERVER_PATH/frontend/src/pages/
scp frontend/src/pages/Quests.tsx $SERVER:$SERVER_PATH/frontend/src/pages/
scp frontend/src/pages/Shop.tsx $SERVER:$SERVER_PATH/frontend/src/pages/

echo "🔨 Пересборка frontend на сервере..."
ssh $SERVER "cd $SERVER_PATH && docker-compose build --no-cache frontend && docker-compose up -d frontend"

echo "✅ Готово! Проверьте логи:"
echo "ssh $SERVER 'cd $SERVER_PATH && docker-compose logs --tail=50 frontend'"

