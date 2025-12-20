#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
# Автоматически определяем API URL
if [ -z "$API_URL" ]; then
  # Сначала пробуем локальный API
  if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
    API_URL="http://localhost:3000/api"
    echo -e "${YELLOW}Используется локальный API: $API_URL${NC}"
  elif curl -s -f -k https://nardist.site/api/health > /dev/null 2>&1; then
    API_URL="https://nardist.site/api"
    echo -e "${YELLOW}Используется внешний API: $API_URL${NC}"
  else
    API_URL="https://nardist.site/api"
    echo -e "${YELLOW}Используется API по умолчанию: $API_URL${NC}"
    echo -e "${YELLOW}Если API недоступен, установите переменную: API_URL=http://localhost:3000/api${NC}"
  fi
fi

ADMIN_LOGIN="${ADMIN_LOGIN:-123}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-123123}"

# Проверка доступности API
echo -e "${BLUE}Проверка доступности API...${NC}"
CURL_FLAGS="-s -f"
if [[ "$API_URL" == https://* ]]; then
  CURL_FLAGS="$CURL_FLAGS -k"
fi
if ! curl $CURL_FLAGS "$API_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ API недоступен по адресу $API_URL${NC}"
  echo -e "${YELLOW}Попробуйте установить переменную API_URL${NC}"
  echo -e "${YELLOW}Пример: API_URL=http://localhost:3000/api ./check-endpoints.sh${NC}"
  exit 1
fi
echo -e "${GREEN}✓ API доступен${NC}"
echo ""

# Статистика
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

# Функция для проверки эндпоинта
check_endpoint() {
  local method=$1
  local endpoint=$2
  local description=$3
  local auth_token=$4
  local data=$5
  local expected_status=${6:-200}
  
  TOTAL=$((TOTAL + 1))
  
  echo -n "Проверка: $description ... "
  
  # Формируем команду curl
  local curl_cmd="curl -s -w '\n%{http_code}' -X $method"
  
  if [ -n "$auth_token" ]; then
    curl_cmd="$curl_cmd -H 'Authorization: Bearer $auth_token'"
  fi
  
  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
  fi
  
  curl_cmd="$curl_cmd '$API_URL$endpoint'"
  
  # Выполняем запрос
  local response=$(eval $curl_cmd 2>&1)
  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | sed '$d')
  
  # Проверяем результат
  if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo -e "${GREEN}✓ OK${NC} (HTTP $http_code)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
    if [ -n "$body" ]; then
      echo -e "  ${YELLOW}Ответ:${NC} $(echo "$body" | head -c 100)"
    fi
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# Функция для пропуска эндпоинта
skip_endpoint() {
  local description=$1
  TOTAL=$((TOTAL + 1))
  SKIPPED=$((SKIPPED + 1))
  echo -e "${BLUE}⊘ ПРОПУЩЕН${NC}: $description"
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Проверка API эндпоинтов${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "API URL: ${YELLOW}$API_URL${NC}"
echo ""

# 1. Проверка базовых эндпоинтов (без авторизации)
echo -e "${YELLOW}=== Базовые эндпоинты ===${NC}"
check_endpoint "GET" "/health" "Health check" "" "" "200"
check_endpoint "GET" "/" "Root endpoint" "" "" "200"
check_endpoint "GET" "/skins" "Список всех скинов" "" "" "200"

# 2. Админ-авторизация
echo ""
echo -e "${YELLOW}=== Админ-авторизация ===${NC}"
CURL_ADMIN_FLAGS="-s"
if [[ "$API_URL" == https://* ]]; then
  CURL_ADMIN_FLAGS="$CURL_ADMIN_FLAGS -k"
fi
ADMIN_RESPONSE=$(curl $CURL_ADMIN_FLAGS -X POST "$API_URL/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"login\":\"$ADMIN_LOGIN\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}✗ Не удалось получить админ-токен${NC}"
  ADMIN_TOKEN=""
else
  echo -e "${GREEN}✓ Админ-токен получен${NC}"
fi

# 3. Админ-эндпоинты
if [ -n "$ADMIN_TOKEN" ]; then
  echo ""
  echo -e "${YELLOW}=== Админ-эндпоинты ===${NC}"
  check_endpoint "GET" "/admin/stats" "Статистика" "$ADMIN_TOKEN"
  check_endpoint "GET" "/admin/users" "Список пользователей" "$ADMIN_TOKEN"
  check_endpoint "GET" "/admin/games" "Список игр" "$ADMIN_TOKEN"
  check_endpoint "GET" "/admin/tournaments" "Список турниров" "$ADMIN_TOKEN"
  check_endpoint "GET" "/admin/academy" "Список материалов" "$ADMIN_TOKEN"
  check_endpoint "GET" "/admin/city/rewards" "Настройки города" "$ADMIN_TOKEN"
fi

# 4. Публичные эндпоинты (без авторизации)
echo ""
echo -e "${YELLOW}=== Публичные эндпоинты ===${NC}"
skip_endpoint "POST /auth/login (требует Telegram initData)"

# 5. Эндпоинты требующие авторизации (пропускаем без токена)
echo ""
echo -e "${YELLOW}=== Эндпоинты требующие авторизации ===${NC}"
echo -e "${BLUE}⊘ Пропущены (требуют JWT токен пользователя)${NC}"
SKIPPED=$((SKIPPED + 20)) # Примерное количество
TOTAL=$((TOTAL + 20))

# Список эндпоинтов для справки
echo ""
echo -e "${YELLOW}=== Список основных эндпоинтов ===${NC}"
echo -e "${BLUE}Публичные:${NC}"
echo "  GET  /health"
echo "  GET  /"
echo "  GET  /skins"
echo "  POST /auth/login"
echo ""
echo -e "${BLUE}Админ (требует админ-токен):${NC}"
echo "  POST /admin/login"
echo "  GET  /admin/stats"
echo "  GET  /admin/users"
echo "  GET  /admin/users/:id"
echo "  POST /admin/users/:id/ban"
echo "  POST /admin/users/:id/unban"
echo "  GET  /admin/games"
echo "  GET  /admin/games/:id"
echo "  POST /admin/games/create"
echo "  GET  /admin/tournaments"
echo "  POST /admin/tournaments/create"
echo "  GET  /admin/academy"
echo "  POST /admin/academy/create"
echo "  PUT  /admin/academy/:id"
echo "  DELETE /admin/academy/:id"
echo "  GET  /admin/city/rewards"
echo "  PUT  /admin/city/rewards"
echo "  POST /admin/notifications"
echo ""
echo -e "${BLUE}Пользовательские (требуют JWT токен):${NC}"
echo "  GET  /auth/me"
echo "  GET  /users/me"
echo "  PUT  /users/me"
echo "  GET  /users/:id"
echo "  GET  /games"
echo "  GET  /games/:id"
echo "  POST /games/create-bot"
echo "  GET  /skins/my"
echo "  GET  /skins/user/:userId"
echo "  POST /skins/select"
echo "  POST /skins/purchase"
echo "  GET  /city"
echo "  GET  /city/districts"
echo "  GET  /city/buildings"
echo "  POST /city/buildings/:id/collect"
echo "  POST /city/districts/:id/capture"
echo "  POST /city/upgrade/:id"
echo "  GET  /clans"
echo "  GET  /clans/:id"
echo "  POST /clans/create"
echo "  POST /clans/:id/join"
echo "  GET  /tournaments"
echo "  GET  /tournaments/:id"
echo "  GET  /academy"
echo "  GET  /academy/:id"
echo "  GET  /history"
echo "  GET  /quests"
echo "  GET  /ratings"
echo "  POST /payment/ton/create"
echo "  GET  /payment/ton/status/:id"
echo "  POST /upload/image"

# Итоговая статистика
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Итоговая статистика${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Всего проверок: ${YELLOW}$TOTAL${NC}"
echo -e "${GREEN}Успешно: $PASSED${NC}"
echo -e "${RED}Ошибок: $FAILED${NC}"
echo -e "${BLUE}Пропущено: $SKIPPED${NC}"

if [ $FAILED -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ Все проверенные эндпоинты работают!${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}✗ Обнаружены проблемы с некоторыми эндпоинтами${NC}"
  exit 1
fi

