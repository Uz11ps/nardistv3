# Настройка Nginx для nardist.site

## Быстрый старт

1. **Получить SSL сертификат:**
```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

2. **Задеплоить nginx:**
```bash
chmod +x deploy-nginx.sh
./deploy-nginx.sh
```

## Что включено в конфигурацию

✅ **SSL/TLS:**
- Автоматический редирект HTTP → HTTPS
- Современные протоколы TLS 1.2 и TLS 1.3
- Безопасные шифры
- HSTS заголовок

✅ **Безопасность:**
- Rate limiting для API (10 req/s)
- Rate limiting для логина (5 req/min)
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Скрытие версии nginx

✅ **Производительность:**
- Gzip сжатие
- Кэширование статических файлов (1 год)
- HTTP/2 поддержка
- Оптимизированные таймауты

✅ **WebSocket:**
- Поддержка Socket.IO (`/socket.io`)
- Игровые WebSocket (`/games`)
- Matchmaking WebSocket (`/matchmaking`)
- Долгие таймауты для WebSocket соединений (7 дней)

✅ **Роутинг:**
- `/api` → Backend API (с rate limiting)
- `/api/auth/login` → Специальный rate limit
- `/socket.io` → Socket.IO WebSocket
- `/games` → Игровые WebSocket
- `/matchmaking` → Matchmaking WebSocket
- `/health` → Health check
- `/` → Frontend (React app)

## Структура файлов

```
nginx/
├── Dockerfile          # Docker образ nginx
└── nginx.conf          # Конфигурация nginx
```

## Требования

- Docker и Docker Compose
- SSL сертификат в `/etc/letsencrypt/live/nardist.site/`
- Порты 80 и 443 свободны
- Домен `nardist.site` указывает на IP сервера

## Проверка работы

После деплоя проверьте:
```bash
# Статус контейнера
docker-compose ps nginx

# Логи
docker-compose logs -f nginx

# Проверка HTTPS
curl -I https://nardist.site

# Проверка редиректа
curl -I http://nardist.site
```

## Обновление SSL сертификата

Сертификаты Let's Encrypt обновляются автоматически. Для ручного обновления:
```bash
sudo certbot renew --deploy-hook 'docker-compose restart nginx'
```

Или добавьте в crontab:
```bash
0 0 * * * certbot renew --quiet --deploy-hook 'docker-compose -f /path/to/docker-compose.yml restart nginx'
```

## Troubleshooting

**Порт занят:**
```bash
sudo lsof -i :80
sudo lsof -i :443
# Остановите системный nginx: sudo systemctl stop nginx
```

**SSL сертификат не найден:**
```bash
ls -la /etc/letsencrypt/live/nardist.site/
# Если нет - запустите setup-ssl.sh
```

**Ошибки в конфигурации:**
```bash
docker-compose exec nginx nginx -t
```

**Проверка проксирования:**
```bash
# Проверка backend
curl https://nardist.site/api/health

# Проверка frontend
curl -I https://nardist.site
```

