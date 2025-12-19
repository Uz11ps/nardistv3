# Автоматический деплой БЕЗ доступа к Settings GitHub

Этот метод позволяет настроить автоматический деплой даже если у вас нет прав администратора репозитория или доступа к Settings.

## Как это работает

Скрипт на сервере периодически проверяет GitHub на наличие новых коммитов и автоматически обновляет код.

## Быстрая настройка

### Шаг 1: Загрузите скрипты на сервер

```bash
# На вашем локальном компьютере
scp server-auto-deploy.sh user@your-server:/var/www/nardistv3/
scp server-setup-cron.sh user@your-server:/var/www/nardistv3/
```

### Шаг 2: На сервере выберите метод

#### Вариант A: Через cron (проще)

```bash
cd /var/www/nardistv3
chmod +x server-setup-cron.sh
sudo ./server-setup-cron.sh
```

Это настроит автоматическую проверку каждые 5 минут.

#### Вариант B: Через systemd timer (надежнее)

```bash
cd /var/www/nardistv3
chmod +x server-setup-systemd.sh
sudo ./server-setup-systemd.sh
```

Это создаст системную службу, которая будет проверять обновления каждые 5 минут.

### Шаг 3: Проверка работы

```bash
# Проверьте логи
tail -f /var/log/nardist-auto-deploy.log

# Или запустите вручную для теста
./server-auto-deploy.sh once
```

## Настройка интервала проверки

### Для cron:

Отредактируйте crontab:
```bash
crontab -e
```

Измените интервал (например, каждые 2 минуты):
```
*/2 * * * * cd /var/www/nardistv3 && /var/www/nardistv3/server-auto-deploy.sh once >> /var/log/nardist-auto-deploy.log 2>&1
```

### Для systemd:

Отредактируйте timer:
```bash
sudo nano /etc/systemd/system/nardist-auto-deploy.timer
```

Измените `OnUnitActiveSec=5min` на нужный интервал:
```ini
OnUnitActiveSec=2min  # Каждые 2 минуты
OnUnitActiveSec=10min # Каждые 10 минут
```

Затем:
```bash
sudo systemctl daemon-reload
sudo systemctl restart nardist-auto-deploy.timer
```

## Ручной запуск

```bash
# Запуск один раз
./server-auto-deploy.sh once

# Непрерывный режим (проверка каждые 60 секунд)
./server-auto-deploy.sh watch

# С другими настройками
DEPLOY_PATH=/var/www/nardistv3 DEPLOY_BRANCH=main CHECK_INTERVAL=120 ./server-auto-deploy.sh watch
```

## Просмотр статуса

### Для cron:
```bash
# Проверьте что задача в cron
crontab -l | grep nardist

# Логи
tail -f /var/log/nardist-auto-deploy.log
```

### Для systemd:
```bash
# Статус таймера
sudo systemctl status nardist-auto-deploy.timer

# Когда запустится следующий раз
sudo systemctl list-timers nardist-auto-deploy*

# Логи в реальном времени
sudo journalctl -u nardist-auto-deploy.service -f
```

## Отключение автоматического деплоя

### Для cron:
```bash
crontab -e
# Удалите строку с server-auto-deploy.sh
```

### Для systemd:
```bash
sudo systemctl stop nardist-auto-deploy.timer
sudo systemctl disable nardist-auto-deploy.timer
```

## Преимущества этого метода

✅ Не требует доступа к Settings GitHub  
✅ Работает с любым репозиторием (даже публичным, если код есть локально)  
✅ Полный контроль на вашей стороне  
✅ Не требует настройки SSH ключей в GitHub  
✅ Простая настройка  

## Недостатки

❌ Требует доступ к серверу  
❌ Проверка с задержкой (интервал проверки)  
❌ Не видно статус деплоя в GitHub  

## Безопасность

Убедитесь что:
- Репозиторий настроен на использование SSH или HTTPS с токеном
- Если используете HTTPS, настройте credential helper:
  ```bash
  git config --global credential.helper store
  ```

## Устранение проблем

### Скрипт не находит изменения:

Убедитесь что удаленный репозиторий настроен правильно:
```bash
cd /var/www/nardistv3
git remote -v
git fetch origin
git log HEAD..origin/main
```

### Ошибки прав доступа:

```bash
chmod +x server-auto-deploy.sh
chmod +x server-setup-*.sh
```

### Docker требует sudo:

Отредактируйте скрипт и добавьте `sudo` перед командами docker, или добавьте пользователя в группу docker:
```bash
sudo usermod -aG docker $USER
```

