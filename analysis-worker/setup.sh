#!/bin/bash

# Скрипт для настройки analysis-worker
# Копирует необходимые файлы из основного проекта

set -e

echo "🚀 Настройка Analysis Worker..."

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: запустите скрипт из директории analysis-worker"
    exit 1
fi

# Путь к основному проекту
BACKEND_DIR="../backend/src"

if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Ошибка: не найдена директория $BACKEND_DIR"
    exit 1
fi

echo "📁 Копирование файлов..."

# Копируем сервисы анализа
if [ -f "$BACKEND_DIR/analysis/gnubg.service.ts" ]; then
    cp "$BACKEND_DIR/analysis/gnubg.service.ts" src/
    echo "✅ Скопирован gnubg.service.ts"
else
    echo "⚠️  Файл gnubg.service.ts не найден"
fi

if [ -f "$BACKEND_DIR/analysis/mcts-long-backgammon.service.ts" ]; then
    cp "$BACKEND_DIR/analysis/mcts-long-backgammon.service.ts" src/
    echo "✅ Скопирован mcts-long-backgammon.service.ts"
else
    echo "⚠️  Файл mcts-long-backgammon.service.ts не найден"
fi

# Копируем движки игры
if [ -f "$BACKEND_DIR/games/game-engine/long-backgammon-engine.ts" ]; then
    cp "$BACKEND_DIR/games/game-engine/long-backgammon-engine.ts" src/
    echo "✅ Скопирован long-backgammon-engine.ts"
else
    echo "⚠️  Файл long-backgammon-engine.ts не найден"
fi

if [ -f "$BACKEND_DIR/games/game-engine/backgammon-engine.ts" ]; then
    cp "$BACKEND_DIR/games/game-engine/backgammon-engine.ts" src/
    echo "✅ Скопирован backgammon-engine.ts"
else
    echo "⚠️  Файл backgammon-engine.ts не найден"
fi

echo ""
echo "📦 Установка зависимостей..."
npm install

echo ""
echo "🔨 Компиляция TypeScript..."
npm run build

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Создайте файл .env с настройками БД"
echo "2. Запустите: docker-compose up -d"
echo "3. Проверьте: curl http://localhost:3001/health"

