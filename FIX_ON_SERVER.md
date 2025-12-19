# Исправление на сервере

Выполните эти команды на сервере:

```bash
ssh root@91.229.9.80
cd /var/www/nardiphp

# Исправляем версию пакета в frontend/package.json
sed -i 's/"@twa-dev\/sdk": "\^1.0.0"/"@twa-dev\/sdk": "^8.0.2"/' frontend/package.json

# Пересобираем
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Проверяем логи
docker-compose logs -f frontend
```

Или выполните скрипт:
```bash
bash fix-package.sh
docker-compose build --no-cache
docker-compose up -d
```

