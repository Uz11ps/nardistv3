#!/bin/bash

# Скрипт для настройки автоматического деплоя через cron
# Запустите этот скрипт на сервере

set -e

# Определяем путь к проекту автоматически
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_PATH="${DEPLOY_PATH:-$SCRIPT_DIR}"

# Ищем скрипт деплоя в текущей директории или по указанному пути
if [ -f "$SCRIPT_DIR/server-auto-deploy.sh" ]; then
    DEPLOY_SCRIPT="$SCRIPT_DIR/server-auto-deploy.sh"
elif [ -f "$PROJECT_PATH/server-auto-deploy.sh" ]; then
    DEPLOY_SCRIPT="$PROJECT_PATH/server-auto-deploy.sh"
else
    echo "❌ Скрипт server-auto-deploy.sh не найден!"
    echo "💡 Искал в:"
    echo "   - $SCRIPT_DIR/server-auto-deploy.sh"
    echo "   - $PROJECT_PATH/server-auto-deploy.sh"
    echo ""
    echo "📝 Убедитесь что вы запускаете скрипт из директории проекта"
    echo "   или укажите путь через переменную DEPLOY_PATH"
    exit 1
fi

echo "🔧 Настройка автоматического деплоя через cron..."
echo "📁 Директория проекта: $PROJECT_PATH"
echo "📄 Скрипт деплоя: $DEPLOY_SCRIPT"

# Делаем скрипт исполняемым
chmod +x "$DEPLOY_SCRIPT"

# Определяем путь к скрипту
FULL_SCRIPT_PATH=$(realpath "$DEPLOY_SCRIPT")

# Создаем cron задачу (каждые 5 минут)
CRON_JOB="*/5 * * * * cd $PROJECT_PATH && $FULL_SCRIPT_PATH once >> /var/log/nardist-auto-deploy.log 2>&1"

# Проверяем, существует ли уже такая задача
if crontab -l 2>/dev/null | grep -q "$FULL_SCRIPT_PATH"; then
    echo "⚠️  Cron задача уже существует. Удаляю старую..."
    crontab -l 2>/dev/null | grep -v "$FULL_SCRIPT_PATH" | crontab -
fi

# Добавляем новую задачу
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Cron задача добавлена!"
echo ""
echo "📋 Текущие cron задачи:"
crontab -l | grep -E "nardist|deploy" || echo "  (не найдено)"
echo ""
echo "📝 Логи будут записываться в: /var/log/nardist-auto-deploy.log"
echo ""
echo "💡 Для просмотра логов: tail -f /var/log/nardist-auto-deploy.log"
echo "💡 Для удаления cron задачи: crontab -e (удалите строку с server-auto-deploy.sh)"

