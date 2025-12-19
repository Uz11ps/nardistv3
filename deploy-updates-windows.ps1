# PowerShell скрипт для деплоя с Windows

$SERVER = "root@91.229.9.80"
$SERVER_PATH = "/var/www/nardiphp"

Write-Host "🚀 Начинаем деплой обновлений..." -ForegroundColor Green

# Проверка наличия rsync (через WSL или Git Bash)
$rsyncPath = Get-Command rsync -ErrorAction SilentlyContinue
if (-not $rsyncPath) {
    Write-Host "⚠️  rsync не найден. Используем SCP..." -ForegroundColor Yellow
    
    # Загрузка через SCP
    Write-Host "📤 Загрузка backend..." -ForegroundColor Cyan
    scp -r backend/* $SERVER`:$SERVER_PATH/backend/
    
    Write-Host "📤 Загрузка frontend..." -ForegroundColor Cyan
    scp -r frontend/* $SERVER`:$SERVER_PATH/frontend/
    
    Write-Host "📤 Загрузка конфигурации..." -ForegroundColor Cyan
    scp docker-compose.yml $SERVER`:$SERVER_PATH/
} else {
    Write-Host "📤 Загрузка файлов через rsync..." -ForegroundColor Cyan
    rsync -avz --progress `
        --exclude 'node_modules' `
        --exclude 'dist' `
        --exclude 'build' `
        --exclude '.env' `
        --exclude '*.log' `
        backend/ ${SERVER}:${SERVER_PATH}/backend/
    
    rsync -avz --progress `
        --exclude 'node_modules' `
        --exclude 'dist' `
        --exclude 'build' `
        --exclude '.env' `
        --exclude '*.log' `
        frontend/ ${SERVER}:${SERVER_PATH}/frontend/
}

# Выполнение команд на сервере
Write-Host "🔨 Пересборка на сервере..." -ForegroundColor Cyan
ssh $SERVER "cd $SERVER_PATH && docker-compose down && docker-compose build --no-cache backend frontend && docker-compose up -d"

Write-Host "✅ Деплой завершен!" -ForegroundColor Green
Write-Host "🌐 Проверьте: https://nardist.site" -ForegroundColor Cyan

