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
    docker rm -f nardi_backend 2>/dev/null || true
    docker rm -f nardi_frontend 2>/dev/null || true
    docker rm -f nardi_nginx 2>/dev/null || true
    docker rm -f nardi_postgres 2>/dev/null || true
    docker rm -f nardi_redis 2>/dev/null || true
    
    # Очистка кеша docker-compose (может быть проблема в кеше)
    docker-compose rm -f 2>/dev/null || true
    
    # Очистка сетей проекта (на случай если остались старые сети)
    docker network prune -f 2>/dev/null || true
    
    # Проверяем и удаляем все контейнеры с такими именами (даже если они "мертвые")
    for name in nardi_backend nardi_frontend nardi_nginx; do
        # Ищем контейнеры по имени (включая остановленные)
        CONTAINER_ID=$(docker ps -aq --filter "name=^${name}$" 2>/dev/null | head -1)
        if [ ! -z "$CONTAINER_ID" ]; then
            log "${YELLOW}🗑️  Удаление контейнера $name (ID: $CONTAINER_ID)...${NC}"
            docker rm -f "$CONTAINER_ID" 2>/dev/null || true
        fi
    done
    
    # Небольшая задержка чтобы порты освободились
    sleep 2
    
    # Пересборка и запуск
    log "${YELLOW}🔨 Пересборка и запуск контейнеров...${NC}"
    # Используем --force-recreate чтобы пересоздать контейнеры даже если они не изменились
    # И --no-deps чтобы не пересоздавать зависимости (postgres, redis)
    docker-compose up -d --build --force-recreate --no-deps backend frontend nginx || {
        # Если не получилось, пробуем без --no-deps
        log "${YELLOW}⚠️ Повторная попытка без --no-deps...${NC}"
        docker-compose up -d --build --force-recreate
    }
    
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

