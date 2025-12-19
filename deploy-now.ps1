# PowerShell скрипт для деплоя на сервер
# Использование: .\deploy-now.ps1

$ErrorActionPreference = "Stop"

$SERVER_IP = "91.229.9.80"
$SERVER_USER = "root"
$SERVER_PASS = "ksOVrfa4yeQEb3cR"
$DOMAIN = "nardist.site"
$REMOTE_PATH = "/var/www/nardiphp"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Деплой Telegram Mini App Нарды" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Функция для выполнения команд на сервере
function Invoke-SSHCommand {
    param([string]$Command)
    
    $sshCommand = "ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} `"$Command`""
    Write-Host "Выполнение: $Command" -ForegroundColor Yellow
    
    # Используем echo для передачи пароля (небезопасно, но работает)
    $process = Start-Process -FilePath "ssh" -ArgumentList "-o", "StrictHostKeyChecking=no", "${SERVER_USER}@${SERVER_IP}", $Command -NoNewWindow -Wait -PassThru -RedirectStandardOutput "ssh_output.txt" -RedirectStandardError "ssh_error.txt"
    
    if ($process.ExitCode -ne 0) {
        Write-Host "Ошибка выполнения команды" -ForegroundColor Red
        Get-Content "ssh_error.txt" | Write-Host -ForegroundColor Red
        return $false
    }
    return $true
}

Write-Host "Шаг 1: Подготовка сервера..." -ForegroundColor Green

# Создаем директорию на сервере
Invoke-SSHCommand "mkdir -p $REMOTE_PATH" | Out-Null

Write-Host "Шаг 2: Создание .env файла на сервере..." -ForegroundColor Green

$envContent = @"
TELEGRAM_BOT_TOKEN=8283196243:AAHScPWoLwr-UtrT71YXf0y8XKim_slIg5w
TELEGRAM_SECRET_KEY=change_this_after_bot_setup
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=nardi
POSTGRES_PASSWORD=NardiSecure2024!Pass
POSTGRES_DB=nardi_db
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=NardiJWTSecretKey2024!ChangeThisInProductionMin32Chars
NODE_ENV=production
BACKEND_PORT=3000
FRONTEND_PORT=5173
DOMAIN=$DOMAIN
VITE_API_URL=https://$DOMAIN/api
VITE_WS_URL=wss://$DOMAIN
VITE_TELEGRAM_BOT_NAME=nardist_bot
"@

# Сохраняем .env во временный файл
$envContent | Out-File -FilePath ".env.tmp" -Encoding UTF8

Write-Host "Шаг 3: Загрузка файлов на сервер..." -ForegroundColor Green
Write-Host "ВНИМАНИЕ: Вам нужно будет ввести пароль несколько раз: $SERVER_PASS" -ForegroundColor Yellow
Write-Host ""

# Загружаем .env файл
Write-Host "Загрузка .env файла..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no ".env.tmp" "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/.env"

# Загружаем основные файлы
Write-Host "Загрузка docker-compose.yml..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no "docker-compose.yml" "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/"

Write-Host "Загрузка setup-server.sh..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no "setup-server.sh" "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/"

Write-Host "Загрузка директорий backend и frontend..." -ForegroundColor Yellow
Write-Host "Это может занять некоторое время..." -ForegroundColor Yellow

# Загружаем backend (исключая node_modules)
scp -r -o StrictHostKeyChecking=no "backend" "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/"

# Загружаем frontend (исключая node_modules)
scp -r -o StrictHostKeyChecking=no "frontend" "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/"

# Загружаем deploy директорию
if (Test-Path "deploy") {
    scp -r -o StrictHostKeyChecking=no "deploy" "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/"
}

# Удаляем временный файл
Remove-Item ".env.tmp" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Шаг 4: Запуск деплоя на сервере..." -ForegroundColor Green
Write-Host "Введите пароль еще раз: $SERVER_PASS" -ForegroundColor Yellow

# Выполняем setup на сервере
$setupCommand = "cd $REMOTE_PATH && chmod +x setup-server.sh && bash setup-server.sh"
ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" $setupCommand

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Деплой завершен!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Проверьте работу:" -ForegroundColor Yellow
Write-Host "  - Backend: http://${DOMAIN}:3000/health" -ForegroundColor Cyan
Write-Host "  - Frontend: http://${DOMAIN}:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Для просмотра логов выполните:" -ForegroundColor Yellow
Write-Host "  ssh ${SERVER_USER}@${SERVER_IP} 'cd $REMOTE_PATH && docker-compose logs -f'" -ForegroundColor Gray

