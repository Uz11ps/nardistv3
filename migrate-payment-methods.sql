-- Миграция: обновление старых значений method = "ton" и "usdt" на новые значения
-- Выполнить ПЕРЕД запуском приложения

-- Обновляем все записи с method = 'ton' на 'telegram_stars'
UPDATE payment_transactions 
SET method = 'telegram_stars' 
WHERE method = 'ton';

-- Обновляем все записи с method = 'usdt' на 'telegram_stars'
UPDATE payment_transactions 
SET method = 'telegram_stars' 
WHERE method = 'usdt';

-- Проверяем результат
SELECT method, COUNT(*) as count 
FROM payment_transactions 
GROUP BY method;

