@echo off
echo ========================================
echo Деплой Telegram Mini App Нарды
echo ========================================
echo.

set SERVER_IP=91.229.9.80
set SERVER_USER=root
set DOMAIN=nardist.site

echo Шаг 1: Создание архива проекта...
if exist deploy.tar.gz del deploy.tar.gz

echo.
echo Шаг 2: Загрузка на сервер...
echo Введите пароль когда попросит: ksOVrfa4yeQEb3cR
echo.

REM Используем tar через WSL если доступен, иначе используем scp напрямую
where wsl >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo Используется WSL...
    wsl tar --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='build' --exclude='.env.local' -czf deploy.tar.gz .
    scp deploy.tar.gz %SERVER_USER%@%SERVER_IP%:/tmp/
) else (
    echo WSL не найден. Используйте ручную загрузку через WinSCP или FileZilla
    echo Или установите WSL: wsl --install
    pause
    exit /b 1
)

echo.
echo Шаг 3: Подключение к серверу и деплой...
echo Введите пароль еще раз: ksOVrfa4yeQEb3cR
echo.

ssh %SERVER_USER%@%SERVER_IP% "cd /var/www && mkdir -p nardiphp && cd nardiphp && tar -xzf /tmp/deploy.tar.gz && rm /tmp/deploy.tar.gz && bash deploy/deploy.sh"

echo.
echo ========================================
echo Деплой завершен!
echo Проверьте: http://%DOMAIN%:3000/health
echo ========================================
pause

