FROM nginx:alpine

# Копируем конфигурацию (полный конфиг)
COPY nginx.conf /etc/nginx/nginx.conf

# Создаем директории для SSL
RUN mkdir -p /etc/nginx/ssl && \
    mkdir -p /var/log/nginx && \
    mkdir -p /usr/share/nginx/html

# Создаем простые страницы ошибок
RUN echo '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1></body></html>' > /usr/share/nginx/html/404.html && \
    echo '<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Server Error</h1></body></html>' > /usr/share/nginx/html/50x.html

# Проверяем конфигурацию
RUN nginx -t

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

