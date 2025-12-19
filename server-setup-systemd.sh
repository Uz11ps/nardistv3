#!/bin/bash

# Скрипт для настройки автоматического деплоя через systemd timer
# Более надежный вариант, чем cron

set -e

PROJECT_PATH="${DEPLOY_PATH:-/var/www/nardistv3}"
DEPLOY_SCRIPT="$PROJECT_PATH/server-auto-deploy.sh"

echo "🔧 Настройка автоматического деплоя через systemd..."

# Проверка что скрипт существует
if [ ! -f "$DEPLOY_SCRIPT" ]; then
    echo "❌ Скрипт $DEPLOY_SCRIPT не найден!"
    exit 1
fi

# Делаем скрипт исполняемым
chmod +x "$DEPLOY_SCRIPT"

FULL_SCRIPT_PATH=$(realpath "$DEPLOY_SCRIPT")
SERVICE_NAME="nardist-auto-deploy"

# Создаем systemd service
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Auto Deploy for Nardist
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=$PROJECT_PATH
Environment="DEPLOY_PATH=$PROJECT_PATH"
Environment="DEPLOY_BRANCH=main"
ExecStart=$FULL_SCRIPT_PATH once
StandardOutput=append:/var/log/nardist-auto-deploy.log
StandardError=append:/var/log/nardist-auto-deploy.log
EOF

# Создаем systemd timer
cat > /etc/systemd/system/${SERVICE_NAME}.timer << EOF
[Unit]
Description=Auto Deploy Timer for Nardist
Requires=${SERVICE_NAME}.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Unit=${SERVICE_NAME}.service

[Install]
WantedBy=timers.target
EOF

# Перезагружаем systemd
systemctl daemon-reload

# Включаем и запускаем timer
systemctl enable ${SERVICE_NAME}.timer
systemctl start ${SERVICE_NAME}.timer

echo "✅ Systemd timer настроен!"
echo ""
echo "📋 Статус:"
systemctl status ${SERVICE_NAME}.timer --no-pager -l
echo ""
echo "💡 Полезные команды:"
echo "   systemctl status ${SERVICE_NAME}.timer  # Статус"
echo "   systemctl list-timers ${SERVICE_NAME}*  # Когда запустится следующий раз"
echo "   journalctl -u ${SERVICE_NAME}.service -f  # Логи в реальном времени"
echo "   systemctl stop ${SERVICE_NAME}.timer    # Остановить"
echo "   systemctl disable ${SERVICE_NAME}.timer # Отключить автозапуск"

