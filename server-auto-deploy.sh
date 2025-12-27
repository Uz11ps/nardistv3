#!/bin/bash

# Автоматический деплой на сервере БЕЗ GitHub Actions
# Этот скрипт запускается на сервере и периодически проверяет обновления в GitHub

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Автоматическое определение пути к проекту
# Если DEPLOY_PATH не указан, используем директорию где находится скрипт или текущую директорию
if [ -z "$DEPLOY_PATH" ]; then
    # Пытаемся определить директорию скрипта
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    # Проверяем есть ли docker-compose.yml в директории скрипта
    if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        PROJECT_PATH="$SCRIPT_DIR"
    else
        # Используем текущую директорию
        PROJECT_PATH="$(pwd)"
    fi
else
    PROJECT_PATH="$DEPLOY_PATH"
fi

BRANCH="${DEPLOY_BRANCH:-main}"
CHECK_INTERVAL="${CHECK_INTERVAL:-60}" # Интервал проверки в секундах (по умолчанию 60)

log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

deploy() {
    log "${YELLOW}🚀 Начало деплоя...${NC}"
    log "${YELLOW}📁 Путь к проекту: $PROJECT_PATH${NC}"
    
    cd "$PROJECT_PATH" || {
        log "${RED}❌ Не удалось перейти в директорию: $PROJECT_PATH${NC}"
        return 1
    }
    
    if [ ! -f "docker-compose.yml" ]; then
        log "${RED}❌ docker-compose.yml не найден!${NC}"
        return 1
    fi
    
    # Обновление кода
    log "${YELLOW}📦 Обновление кода из GitHub...${NC}"
    git fetch origin
    
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/$BRANCH)
    
    # Переключение на последнюю версию
    git reset --hard origin/$BRANCH
    git clean -fd
    
    # Остановка системных сервисов (nginx, apache2) для освобождения портов
    log "${YELLOW}🛑 Остановка системных веб-серверов (nginx, apache2)...${NC}"
    sudo systemctl stop nginx 2>/dev/null || sudo service nginx stop 2>/dev/null || true
    sudo systemctl stop apache2 2>/dev/null || sudo service apache2 stop 2>/dev/null || true
    sudo systemctl stop httpd 2>/dev/null || sudo service httpd stop 2>/dev/null || true
    sudo systemctl disable nginx 2>/dev/null || true
    sudo systemctl disable apache2 2>/dev/null || true
    
    # Полная остановка и удаление контейнеров
    log "${YELLOW}🛑 Остановка и удаление старых контейнеров...${NC}"
    
    # Сначала останавливаем все контейнеры проекта
    docker-compose stop || true
    
    # Удаляем все контейнеры проекта
    docker-compose down --remove-orphans || true
    
    # Принудительная остановка всех контейнеров проекта (на случай если down не сработал)
    docker-compose ps -q | xargs -r docker stop 2>/dev/null || true
    docker-compose ps -q | xargs -r docker rm -f 2>/dev/null || true
    
    # Принудительное удаление контейнеров по имени (на случай конфликтов)
    # Удаляем даже если их нет (игнорируем ошибки)
    # НЕ удаляем postgres и redis чтобы сохранить данные!
    docker rm -f nardi_backend 2>/dev/null || true
    docker rm -f nardi_frontend 2>/dev/null || true
    docker rm -f nardi_nginx 2>/dev/null || true
    
    # Очистка кеша docker-compose (может быть проблема в кеше)
    docker-compose rm -f 2>/dev/null || true
    
    # Очистка сетей проекта (на случай если остались старые сети)
    docker network prune -f 2>/dev/null || true
    
    # Проверяем и удаляем все контейнеры с такими именами (даже если они "мертвые")
    # НЕ удаляем postgres и redis чтобы сохранить данные!
    for name in nardi_backend nardi_frontend nardi_nginx; do
        # Ищем контейнеры по имени (включая остановленные)
        CONTAINER_ID=$(docker ps -aq --filter "name=^${name}$" 2>/dev/null | head -1)
        if [ ! -z "$CONTAINER_ID" ]; then
            log "${YELLOW}🗑️  Удаление контейнера $name (ID: $CONTAINER_ID)...${NC}"
            docker rm -f "$CONTAINER_ID" 2>/dev/null || true
        fi
    done
    
    # Принудительное освобождение портов 80 и 443
    log "${YELLOW}🔓 Освобождение портов 80 и 443...${NC}"
    
    # Находим процессы, использующие порт 80
    PORT80_PID=$(sudo lsof -ti :80 2>/dev/null || true)
    if [ ! -z "$PORT80_PID" ]; then
        log "${YELLOW}⚠️  Найден процесс на порту 80 (PID: $PORT80_PID), останавливаем...${NC}"
        sudo kill -9 $PORT80_PID 2>/dev/null || true
        sleep 1
    fi
    
    # Находим процессы, использующие порт 443
    PORT443_PID=$(sudo lsof -ti :443 2>/dev/null || true)
    if [ ! -z "$PORT443_PID" ]; then
        log "${YELLOW}⚠️  Найден процесс на порту 443 (PID: $PORT443_PID), останавливаем...${NC}"
        sudo kill -9 $PORT443_PID 2>/dev/null || true
        sleep 1
    fi
    
    # Дополнительная проверка через netstat
    if command -v netstat >/dev/null 2>&1; then
        PORT80_PROCESS=$(sudo netstat -tulpn 2>/dev/null | grep ':80 ' | awk '{print $7}' | cut -d'/' -f1 | head -1)
        if [ ! -z "$PORT80_PROCESS" ] && [ "$PORT80_PROCESS" != "-" ]; then
            log "${YELLOW}⚠️  Найден процесс на порту 80 через netstat (PID: $PORT80_PROCESS), останавливаем...${NC}"
            sudo kill -9 $PORT80_PROCESS 2>/dev/null || true
            sleep 1
        fi
    fi
    
    # Задержка чтобы порты точно освободились
    sleep 3
    
    # Финальная проверка портов
    if sudo lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log "${RED}❌ Порт 80 все еще занят! Список процессов:${NC}"
        sudo lsof -i :80 || true
        log "${YELLOW}⚠️  Попробуйте вручную остановить процессы и запустите деплой снова${NC}"
        return 1
    fi
    
    if sudo lsof -Pi :443 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log "${RED}❌ Порт 443 все еще занят! Список процессов:${NC}"
        sudo lsof -i :443 || true
        log "${YELLOW}⚠️  Попробуйте вручную остановить процессы и запустите деплой снова${NC}"
        return 1
    fi
    
    log "${GREEN}✅ Порты 80 и 443 свободны${NC}"
    
    # Пересборка и запуск
    log "${YELLOW}🔨 Пересборка и запуск контейнеров...${NC}"
    # Сначала только собираем образы, чтобы не держать порты свободными слишком долго
    docker-compose build
    
    # ПЕРЕД запуском контейнеров еще раз проверяем порты, так как сборка могла занять время
    log "${YELLOW}🔓 Повторная проверка портов 80 и 443 после сборки...${NC}"
    sudo lsof -ti :80 | xargs -r sudo kill -9 || true
    sudo lsof -ti :443 | xargs -r sudo kill -9 || true
    
    # Используем --force-recreate чтобы пересоздать контейнеры даже если они не изменились
    # Запускаем все сервисы включая postgres и redis
    docker-compose up -d --force-recreate
    
    # Ожидание запуска
    log "${YELLOW}⏳ Ожидание запуска сервисов (15 секунд)...${NC}"
    sleep 15
    
    # Проверка статуса
    log "${YELLOW}📊 Статус контейнеров:${NC}"
    docker-compose ps
    
    # Очистка старых образов
    log "${YELLOW}🧹 Очистка неиспользуемых образов...${NC}"
    docker image prune -f > /dev/null 2>&1 || true
    
    log "${GREEN}✅ Деплой завершен!${NC}"
    return 0
}

# Режим работы: один раз или непрерывно
if [ "$1" = "once" ]; then
    # Запуск один раз
    deploy
elif [ "$1" = "watch" ]; then
    # Непрерывный режим
    log "${GREEN}👀 Запуск в режиме отслеживания (проверка каждые $CHECK_INTERVAL секунд)${NC}"
    log "${YELLOW}💡 Нажмите Ctrl+C для остановки${NC}"
    
    while true; do
        deploy
        sleep "$CHECK_INTERVAL"
    done
else
    echo "Использование: $0 [once|watch]"
    echo ""
    echo "  once  - Запустить деплой один раз"
    echo "  watch - Запускать деплой каждые $CHECK_INTERVAL секунд"
    echo ""
    echo "Переменные окружения:"
    echo "  DEPLOY_PATH   - путь к проекту (по умолчанию: автоматически определяется)"
    echo "  DEPLOY_BRANCH - ветка для деплоя (по умолчанию: main)"
    echo "  CHECK_INTERVAL - интервал проверки в секундах (по умолчанию: 60)"
    echo ""
    echo "💡 Скрипт автоматически найдет директорию с docker-compose.yml"
    exit 1
fi

