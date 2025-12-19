# Инструкция по деплою исправлений

## ✅ Все ошибки TypeScript исправлены!

Исправлены следующие проблемы:
- ✅ Добавлен prop `style` в компоненты Card и Button
- ✅ Добавлен prop `disabled` в компонент Button
- ✅ Обновлен интерфейс User в authStore (добавлены avatarUrl, nickname, isTrainer)
- ✅ Исправлен NodeJS.Timeout на ReturnType<typeof setInterval>
- ✅ Исправлены все использования disabled и style props

## Быстрый деплой

### Вариант 1: Автоматический скрипт

```bash
# Если у вас есть Git Bash или WSL
chmod +x deploy-all-files.sh
./deploy-all-files.sh
```

### Вариант 2: Ручная загрузка (PowerShell)

Выполните команды по порядку:

```powershell
# 1. Компоненты
scp frontend\src\components\Card.tsx root@91.229.9.80:/var/www/nardiphp/frontend/src/components/
scp frontend\src\components\Button.tsx root@91.229.9.80:/var/www/nardiphp/frontend/src/components/

# 2. Store
scp frontend\src\store\authStore.ts root@91.229.9.80:/var/www/nardiphp/frontend/src/store/

# 3. Страницы (все исправленные)
scp frontend\src\pages\*.tsx root@91.229.9.80:/var/www/nardiphp/frontend/src/pages/

# 4. Другие файлы
scp frontend\src\App.tsx root@91.229.9.80:/var/www/nardiphp/frontend/src/
scp frontend\src\index.css root@91.229.9.80:/var/www/nardiphp/frontend/src/
scp frontend\src\api\websocket.ts root@91.229.9.80:/var/www/nardiphp/frontend/src/api/

# 5. Backend (новые модули кланов)
scp -r backend\src\clans root@91.229.9.80:/var/www/nardiphp/backend/src/

# 6. Backend (обновленные файлы)
scp backend\src\app.module.ts root@91.229.9.80:/var/www/nardiphp/backend/src/
scp backend\src\users\*.ts root@91.229.9.80:/var/www/nardiphp/backend/src/users/
scp backend\src\games\games.*.ts root@91.229.9.80:/var/www/nardiphp/backend/src/games/
scp backend\src\history\history.service.ts root@91.229.9.80:/var/www/nardiphp/backend/src/history/
scp backend\src\quests\*.ts root@91.229.9.80:/var/www/nardiphp/backend/src/quests/
scp backend\src\city\*.ts root@91.229.9.80:/var/www/nardiphp/backend/src/city/
scp backend\src\academy\*.ts root@91.229.9.80:/var/www/nardiphp/backend/src/academy/
scp backend\src\tournaments\*.ts root@91.229.9.80:/var/www/nardiphp/backend/src/tournaments/
scp backend\src\progress\progress.module.ts root@91.229.9.80:/var/www/nardiphp/backend/src/progress/

# 7. Пересборка на сервере
ssh root@91.229.9.80 "cd /var/www/nardiphp && docker-compose down && docker-compose build --no-cache backend frontend && docker-compose up -d"
```

### Вариант 3: Через WinSCP/FileZilla

1. Подключитесь к серверу (91.229.9.80, root)
2. Загрузите все файлы из `frontend/src/` в `/var/www/nardiphp/frontend/src/`
3. Загрузите все файлы из `backend/src/` в `/var/www/nardiphp/backend/src/`
4. Затем через SSH выполните пересборку

## После деплоя проверьте:

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp

# Логи сборки
docker-compose logs frontend | grep -i error

# Статус
docker-compose ps

# Если есть ошибки
docker-compose logs --tail=100 frontend
```

## Если сборка все еще падает:

Проверьте на сервере что все файлы загружены:

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp

# Проверка наличия файлов
ls -la frontend/src/components/
ls -la frontend/src/pages/
ls -la backend/src/clans/
```

Если файлов нет - загрузите их вручную через WinSCP или повторите команды scp.
