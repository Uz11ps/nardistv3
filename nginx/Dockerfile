FROM nginx:alpine

# Копируем конфигурацию
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем директории для SSL
RUN mkdir -p /etc/nginx/ssl

# Копируем SSL сертификаты (если есть)
# Если сертификаты на хосте, они будут смонтированы через volumes

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

