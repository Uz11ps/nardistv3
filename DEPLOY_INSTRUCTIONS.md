# Инструкция по деплою обновлений

## Вариант 1: Через rsync (рекомендуется)

### Linux/Mac/WSL:

```bash
chmod +x deploy-updates.sh
./deploy-updates.sh
```

### Windows (PowerShell):

```powershell
.\deploy-updates-windows.ps1
```

## Вариант 2: Ручная загрузка через SCP

### Загрузка всех файлов:

```bash
# Backend
scp -r backend/* root@91.229.9.80:/var/www/nardiphp/backend/

# Frontend
scp -r frontend/* root@91.229.9.80:/var/www/nardiphp/frontend/

# Конфигурация
scp docker-compose.yml root@91.229.9.80:/var/www/nardiphp/
```

### Затем на сервере:

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp

# Остановка
docker-compose down

# Пересборка
docker-compose build --no-cache backend frontend

# Запуск
docker-compose up -d

# Проверка логов
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Вариант 3: Через Git (если используете репозиторий)

```bash
# На сервере
ssh root@91.229.9.80
cd /var/www/nardiphp
git pull origin main

# Пересборка
docker-compose build --no-cache backend frontend
docker-compose up -d
```

## Вариант 4: Быстрый деплой (только измененные файлы)

```bash
chmod +x deploy-updates-simple.sh
./deploy-updates-simple.sh
```

## Что загружается:

- ✅ Все файлы из `backend/src/` (новые модули кланов, обновленные сервисы)
- ✅ Все файлы из `frontend/src/` (новые компоненты, страницы, стили)
- ✅ `docker-compose.yml` (если были изменения)
- ✅ Документация (*.md файлы)

## Что НЕ загружается:

- ❌ `node_modules/` (устанавливаются при сборке)
- ❌ `dist/` и `build/` (собираются при сборке)
- ❌ `.env` (секретные данные)
- ❌ Логи и временные файлы

## После деплоя проверьте:

1. **Логи контейнеров:**
   ```bash
   ssh root@91.229.9.80
   cd /var/www/nardiphp
   docker-compose logs backend
   docker-compose logs frontend
   ```

2. **Статус контейнеров:**
   ```bash
   docker-compose ps
   ```

3. **Доступность сервисов:**
   - Frontend: https://nardist.site
   - Backend API: https://nardist.site/api/health

4. **Новые функции:**
   - Кланы: https://nardist.site/clans
   - Поиск игры: https://nardist.site/game/search
   - История: https://nardist.site/history

## Если что-то пошло не так:

1. **Откат к предыдущей версии:**
   ```bash
   ssh root@91.229.9.80
   cd /var/www/nardiphp
   # Найдите последний backup-*.tar.gz
   tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz
   docker-compose restart
   ```

2. **Проверка ошибок:**
   ```bash
   docker-compose logs --tail=100 backend | grep -i error
   docker-compose logs --tail=100 frontend | grep -i error
   ```

3. **Пересборка с нуля:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```
