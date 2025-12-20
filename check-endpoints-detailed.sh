#!/bin/bash

# Детальная проверка всех эндпоинтов с подробным выводом

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Автоматически определяем API URL
if [ -z "$API_URL" ]; then
  # Сначала пробуем локальный API
  if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
    API_URL="http://localhost:3000/api"
  elif curl -s -f -k https://nardist.site/api/health > /dev/null 2>&1; then
    API_URL="https://nardist.site/api"
  else
    API_URL="https://nardist.site/api"
  fi
fi

ADMIN_LOGIN="${ADMIN_LOGIN:-123}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-123123}"

TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

# Функция проверки эндпоинта с детальным выводом
check_endpoint_detailed() {
  local method=$1
  local endpoint=$2
  local description=$3
  local auth_token=$4
  local data=$5
  local expected_status=${6:-200}
  
  TOTAL=$((TOTAL + 1))
  
  echo -e "${CYAN}[$TOTAL]${NC} ${BLUE}$method${NC} $endpoint"
  echo -e "  Описание: $description"
  
  local curl_cmd="curl -s -w '\nHTTP_CODE:%{http_code}\nTIME:%{time_total}' -X $method"
  
  if [[ "$API_URL" == https://* ]]; then
    curl_cmd="$curl_cmd -k"
  fi
  
  if [ -n "$auth_token" ]; then
    curl_cmd="$curl_cmd -H 'Authorization: Bearer $auth_token'"
  fi
  
  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
  fi
  
  curl_cmd="$curl_cmd '$API_URL$endpoint'"
  
  local start_time=$(date +%s%N)
  local response=$(eval $curl_cmd 2>&1)
  local end_time=$(date +%s%N)
  local duration=$(( (end_time - start_time) / 1000000 )) # в миллисекундах
  
  local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
  local time_total=$(echo "$response" | grep "TIME:" | cut -d: -f2)
  local body=$(echo "$response" | sed '/HTTP_CODE:/d' | sed '/TIME:/d')
  
  if [ -z "$http_code" ]; then
    http_code="000"
  fi
  
  if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo -e "  ${GREEN}✓ УСПЕХ${NC} (HTTP $http_code, время: ${time_total}s)"
    PASSED=$((PASSED + 1))
    
    # Показываем первые 200 символов ответа если это JSON
    if echo "$body" | grep -q "^{"; then
      echo -e "  ${BLUE}Ответ:${NC} $(echo "$body" | head -c 200)..."
    fi
    echo ""
    return 0
  else
    echo -e "  ${RED}✗ ОШИБКА${NC} (HTTP $http_code, ожидалось: $expected_status)"
    FAILED=$((FAILED + 1))
    
    if [ -n "$body" ]; then
      echo -e "  ${YELLOW}Ответ:${NC} $(echo "$body" | head -c 300)"
    fi
    echo ""
    return 1
  fi
}

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Детальная проверка API эндпоинтов    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo -e "API URL: ${YELLOW}$API_URL${NC}"
echo ""

# Проверка доступности
echo -e "${YELLOW}Проверка доступности API...${NC}"
CURL_FLAGS="-s -f"
if [[ "$API_URL" == https://* ]]; then
  CURL_FLAGS="$CURL_FLAGS -k"
fi
if ! curl $CURL_FLAGS "$API_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ API недоступен${NC}"
  exit 1
fi
echo -e "${GREEN}✓ API доступен${NC}"
echo ""

# Базовые эндпоинты
echo -e "${YELLOW}════════════════════════════════════════${NC}"
echo -e "${YELLOW}Базовые эндпоинты${NC}"
echo -e "${YELLOW}════════════════════════════════════════${NC}"
check_endpoint_detailed "GET" "/health" "Health check"
check_endpoint_detailed "GET" "/" "Root endpoint"
check_endpoint_detailed "GET" "/skins" "Список всех скинов"

# Админ-авторизация
echo -e "${YELLOW}════════════════════════════════════════${NC}"
echo -e "${YELLOW}Админ-авторизация${NC}"
echo -e "${YELLOW}════════════════════════════════════════${NC}"
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
  echo "Ответ: $ADMIN_RESPONSE"
  ADMIN_TOKEN=""
else
  echo -e "${GREEN}✓ Админ-токен получен${NC}"
  echo ""
fi

# Админ-эндпоинты
if [ -n "$ADMIN_TOKEN" ]; then
  echo -e "${YELLOW}════════════════════════════════════════${NC}"
  echo -e "${YELLOW}Админ-эндпоинты${NC}"
  echo -e "${YELLOW}════════════════════════════════════════${NC}"
  check_endpoint_detailed "GET" "/admin/stats" "Статистика" "$ADMIN_TOKEN"
  check_endpoint_detailed "GET" "/admin/users" "Список пользователей" "$ADMIN_TOKEN"
  check_endpoint_detailed "GET" "/admin/games" "Список игр" "$ADMIN_TOKEN"
  check_endpoint_detailed "GET" "/admin/tournaments" "Список турниров" "$ADMIN_TOKEN"
  check_endpoint_detailed "GET" "/admin/academy" "Список материалов" "$ADMIN_TOKEN"
  check_endpoint_detailed "GET" "/admin/city/rewards" "Настройки города" "$ADMIN_TOKEN"
fi

# Итоги
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Итоговая статистика                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo -e "Всего проверок: ${YELLOW}$TOTAL${NC}"
echo -e "${GREEN}Успешно: $PASSED${NC}"
echo -e "${RED}Ошибок: $FAILED${NC}"
echo -e "${BLUE}Пропущено: $SKIPPED${NC}"

if [ $FAILED -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ Все проверенные эндпоинты работают корректно!${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}✗ Обнаружены проблемы с некоторыми эндпоинтами${NC}"
  exit 1
fi

