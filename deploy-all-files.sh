#!/bin/bash

# Полный деплой всех обновленных файлов

SERVER="root@91.229.9.80"
SERVER_PATH="/var/www/nardiphp"

echo "🚀 Загрузка всех обновленных файлов..."

# Создание директорий на сервере если их нет
ssh $SERVER "mkdir -p $SERVER_PATH/backend/src/clans $SERVER_PATH/frontend/src/components $SERVER_PATH/frontend/src/pages"

# Backend - новые модули кланов
echo "📤 Загрузка backend (кланы)..."
scp -r backend/src/clans/* $SERVER:$SERVER_PATH/backend/src/clans/ 2>/dev/null || echo "Кланы уже загружены"

# Backend - обновленные файлы
echo "📤 Загрузка обновленных backend файлов..."
scp backend/src/users/users.controller.ts $SERVER:$SERVER_PATH/backend/src/users/
scp backend/src/users/users.service.ts $SERVER:$SERVER_PATH/backend/src/users/
scp backend/src/users/users.module.ts $SERVER:$SERVER_PATH/backend/src/users/
scp backend/src/games/games.controller.ts $SERVER:$SERVER_PATH/backend/src/games/
scp backend/src/games/games.service.ts $SERVER:$SERVER_PATH/backend/src/games/
scp backend/src/history/history.service.ts $SERVER:$SERVER_PATH/backend/src/history/
scp backend/src/quests/quests.controller.ts $SERVER:$SERVER_PATH/backend/src/quests/
scp backend/src/quests/quests.service.ts $SERVER:$SERVER_PATH/backend/src/quests/
scp backend/src/quests/quest-progress.entity.ts $SERVER:$SERVER_PATH/backend/src/quests/
scp backend/src/city/city.controller.ts $SERVER:$SERVER_PATH/backend/src/city/
scp backend/src/city/city.service.ts $SERVER:$SERVER_PATH/backend/src/city/
scp backend/src/academy/academy.controller.ts $SERVER:$SERVER_PATH/backend/src/academy/
scp backend/src/academy/academy.service.ts $SERVER:$SERVER_PATH/backend/src/academy/
scp backend/src/academy/academy.module.ts $SERVER:$SERVER_PATH/backend/src/academy/
scp backend/src/academy/article.entity.ts $SERVER:$SERVER_PATH/backend/src/academy/
scp backend/src/tournaments/tournaments.controller.ts $SERVER:$SERVER_PATH/backend/src/tournaments/
scp backend/src/tournaments/tournaments.service.ts $SERVER:$SERVER_PATH/backend/src/tournaments/
scp backend/src/progress/progress.module.ts $SERVER:$SERVER_PATH/backend/src/progress/
scp backend/src/app.module.ts $SERVER:$SERVER_PATH/backend/src/

# Frontend - компоненты
echo "📤 Загрузка frontend компонентов..."
scp frontend/src/components/*.tsx $SERVER:$SERVER_PATH/frontend/src/components/
scp frontend/src/components/*.css $SERVER:$SERVER_PATH/frontend/src/components/ 2>/dev/null || true

# Frontend - страницы
echo "📤 Загрузка frontend страниц..."
scp frontend/src/pages/*.tsx $SERVER:$SERVER_PATH/frontend/src/pages/
scp frontend/src/pages/*.css $SERVER:$SERVER_PATH/frontend/src/pages/ 2>/dev/null || true

# Frontend - другие файлы
echo "📤 Загрузка других frontend файлов..."
scp frontend/src/store/authStore.ts $SERVER:$SERVER_PATH/frontend/src/store/
scp frontend/src/App.tsx $SERVER:$SERVER_PATH/frontend/src/
scp frontend/src/index.css $SERVER:$SERVER_PATH/frontend/src/
scp frontend/src/api/websocket.ts $SERVER:$SERVER_PATH/frontend/src/api/

# Пересборка
echo "🔨 Пересборка на сервере..."
ssh $SERVER << 'ENDSSH'
cd /var/www/nardiphp

echo "Остановка контейнеров..."
docker-compose down

echo "Пересборка backend..."
docker-compose build --no-cache backend

echo "Пересборка frontend..."
docker-compose build --no-cache frontend

echo "Запуск сервисов..."
docker-compose up -d

echo "Ожидание готовности..."
sleep 15

echo "Статус:"
docker-compose ps

echo ""
echo "Последние логи frontend:"
docker-compose logs --tail=30 frontend | tail -20
ENDSSH

echo ""
echo "✅ Деплой завершен!"
echo "🌐 Проверьте: https://nardist.site"

