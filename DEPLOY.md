# Инструкция по деплою на сервер

## Быстрый деплой (рекомендуется)

```bash
chmod +x deploy-quick.sh
./deploy-quick.sh
```

Этот скрипт:
1. Обновит код из git
2. Пересоберет и перезапустит контейнеры
3. Покажет статус

## Полный деплой (без кэша)

Если нужно полностью пересобрать образы:

```bash
chmod +x deploy.sh
./deploy.sh
```

## Ручной деплой

Если скрипты не работают, выполните команды вручную:

```bash
# 1. Обновить код
git pull origin main

# 2. Остановить контейнеры
docker-compose down

# 3. Пересобрать образы
docker-compose build --no-cache

# 4. Запустить контейнеры
docker-compose up -d

# 5. Проверить статус
docker-compose ps

# 6. Посмотреть логи (если нужно)
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Проверка после деплоя

1. **Проверьте админ-панель:**
   - Откройте https://nardist.site/admin
   - Логин: `123`, Пароль: `123123`

2. **Проверьте API:**
   ```bash
   curl https://nardist.site/api/health
   ```

3. **Проверьте логи на ошибки:**
   ```bash
   docker-compose logs backend | grep -i error
   docker-compose logs frontend | grep -i error
   ```

## Откат изменений

Если что-то пошло не так:

```bash
# Откатить к предыдущему коммиту
git reset --hard HEAD~1

# Пересобрать
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Полезные команды

```bash
# Посмотреть логи всех сервисов
docker-compose logs -f

# Перезапустить конкретный сервис
docker-compose restart backend
docker-compose restart frontend

# Войти в контейнер backend
docker-compose exec backend sh

# Очистить неиспользуемые образы
docker system prune -a
```
