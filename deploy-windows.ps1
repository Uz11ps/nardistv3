# PowerShell скрипт для деплоя на Windows

$SERVER_IP = "91.229.9.80"
$SERVER_USER = "root"
$SERVER_PASS = "ksOVrfa4yeQEb3cR"
$DOMAIN = "nardist.site"

Write-Host "🚀 Начало деплоя Telegram Mini App Нарды..." -ForegroundColor Green

# Проверка наличия SSH клиента
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ SSH не найден. Установите OpenSSH или используйте WSL" -ForegroundColor Red
    exit 1
}

# Создаем архив для загрузки
Write-Host "📦 Создание архива..." -ForegroundColor Yellow
$excludeItems = @(
    "node_modules",
    ".git",
    ".env.local",
    "*.log",
    "logs",
    "dist",
    "build",
    ".DS_Store",
    ".vscode",
    ".idea",
    "*.swp"
)

# Используем 7zip или tar если доступен
if (Get-Command tar -ErrorAction SilentlyContinue) {
    tar --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='build' -czf deploy.tar.gz .
    Write-Host "📤 Загрузка архива на сервер..." -ForegroundColor Yellow
    
    # Загрузка через SCP (требует пароль вручную или SSH ключи)
    scp deploy.tar.gz "${SERVER_USER}@${SERVER_IP}:/tmp/"
    
    # Подключение и распаковка
    ssh "${SERVER_USER}@${SERVER_IP}" @"
cd /var/www
mkdir -p nardiphp
cd nardiphp
tar -xzf /tmp/deploy.tar.gz
rm /tmp/deploy.tar.gz

# Установка Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Установка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Остановка существующих контейнеров
docker-compose down || true

# Сборка и запуск
docker-compose build --no-cache
docker-compose up -d

sleep 15
echo "✅ Деплой завершен!"
"@
    
    Remove-Item deploy.tar.gz -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ tar не найден. Используйте WSL или установите tar" -ForegroundColor Red
    Write-Host "Альтернатива: используйте Git для клонирования на сервере" -ForegroundColor Yellow
}

Write-Host "✅ Деплой завершен!" -ForegroundColor Green
Write-Host "🌐 Проверьте: http://${DOMAIN}:3000/health" -ForegroundColor Cyan

