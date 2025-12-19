# Настройка автоматического деплоя через GitHub

## Метод 1: GitHub Actions (Рекомендуется)

GitHub Actions автоматически запускает деплой при каждом push в ветку `main`.

### Шаг 1: Создание SSH ключа для деплоя

На вашем локальном компьютере или на сервере:

```bash
# Создайте новый SSH ключ специально для GitHub Actions
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Не устанавливайте пароль (просто нажмите Enter дважды)
```

### Шаг 2: Добавление публичного ключа на сервер

```bash
# Скопируйте публичный ключ на сервер
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub user@your-server-ip

# Или вручную добавить в ~/.ssh/authorized_keys на сервере
cat ~/.ssh/github_actions_deploy.pub | ssh user@server 'cat >> ~/.ssh/authorized_keys'
```

### Шаг 3: Получение приватного ключа

```bash
# Покажите содержимое приватного ключа (скопируйте всё)
cat ~/.ssh/github_actions_deploy

# Или на Windows (PowerShell):
Get-Content ~\.ssh\github_actions_deploy
```

**⚠️ ВАЖНО:** Никогда не коммитьте приватный ключ в репозиторий!

### Шаг 4: Настройка GitHub Secrets

1. Откройте ваш GitHub репозиторий
2. Перейдите в `Settings` → `Secrets and variables` → `Actions`
3. Нажмите `New repository secret`

Добавьте следующие секреты:

| Secret Name | Value | Пример |
|------------|-------|--------|
| `SERVER_HOST` | IP или домен сервера | `91.229.9.80` или `nardist.site` |
| `SERVER_USER` | SSH пользователь | `root` |
| `SERVER_SSH_KEY` | Приватный SSH ключ (весь файл) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_SSH_PORT` | SSH порт (опционально) | `22` |
| `SERVER_PATH` | Путь к проекту на сервере | `/var/www/nardistv3` |

### Шаг 5: Проверка работы

1. Сделайте любой commit и push в ветку `main`:
   ```bash
   git add .
   git commit -m "test: проверка автоматического деплоя"
   git push origin main
   ```

2. Откройте вкладку `Actions` в GitHub репозитории
3. Убедитесь, что workflow `Deploy to Server` запустился и завершился успешно

### Шаг 6: Ручной запуск деплоя

Если нужно запустить деплой вручную:
- Откройте `Actions` → выберите workflow `Deploy to Server` → `Run workflow`

---

## Метод 2: GitHub Webhook

GitHub отправляет HTTP запрос на ваш сервер при каждом push, сервер автоматически запускает деплой.

### Шаг 1: Установка Node.js на сервере (если не установлен)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка установки
node --version
npm --version
```

### Шаг 2: Настройка webhook сервера на сервере

```bash
# Перейдите в директорию проекта
cd /var/www/nardistv3

# Установите зависимости
cd webhook
npm install

# Сделайте скрипт исполняемым
chmod +x deploy.sh
chmod +x server.js
```

### Шаг 3: Создание systemd службы (рекомендуется)

Создайте файл `/etc/systemd/system/webhook-deploy.service`:

```ini
[Unit]
Description=GitHub Webhook Deploy Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/nardistv3/webhook
Environment="WEBHOOK_SECRET=your-very-secret-key-change-this"
Environment="DEPLOY_PATH=/var/www/nardistv3"
Environment="WEBHOOK_PORT=9000"
ExecStart=/usr/bin/node /var/www/nardistv3/webhook/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Перезагрузите systemd и запустите службу
sudo systemctl daemon-reload
sudo systemctl enable webhook-deploy
sudo systemctl start webhook-deploy

# Проверьте статус
sudo systemctl status webhook-deploy

# Просмотр логов
sudo journalctl -u webhook-deploy -f
```

### Шаг 4: Настройка GitHub Webhook

1. Откройте ваш GitHub репозиторий
2. Перейдите в `Settings` → `Webhooks` → `Add webhook`
3. Заполните форму:
   - **Payload URL**: `http://your-server-ip:9000/deploy` или `https://your-domain.com:9000/deploy`
   - **Content type**: `application/json`
   - **Secret**: тот же секретный ключ, что вы использовали в `WEBHOOK_SECRET`
   - **Which events**: выберите `Just the push event`
4. Нажмите `Add webhook`

### Шаг 5: Открытие порта в firewall

```bash
# Если используется ufw
sudo ufw allow 9000/tcp

# Если используется firewalld
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
```

### Шаг 6: Проверка работы

1. Сделайте push в ветку `main`
2. Проверьте логи webhook сервера:
   ```bash
   sudo journalctl -u webhook-deploy -f
   ```
3. Проверьте логи деплоя:
   ```bash
   tail -f /var/log/nardist-deploy.log
   ```

---

## Сравнение методов

| Метод | Плюсы | Минусы |
|-------|-------|--------|
| **GitHub Actions** | ✅ Не требует дополнительного ПО на сервере<br>✅ Логи видны в GitHub<br>✅ Не нужно открывать порты | ❌ Нужен SSH доступ к серверу<br>❌ Использует ресурсы GitHub |
| **GitHub Webhook** | ✅ Полный контроль на вашем сервере<br>✅ Можно добавить дополнительные проверки | ❌ Нужен Node.js на сервере<br>❌ Нужно открывать порт<br>❌ Нужно настраивать автозапуск службы |

**Рекомендация:** Используйте GitHub Actions если у вас есть SSH доступ к серверу. Используйте Webhook если хотите больше контроля или не хотите настраивать SSH ключи.

