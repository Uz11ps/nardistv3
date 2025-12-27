-- Очистка базы данных БЕЗ удаления самой базы
-- Удаляет все таблицы и данные, но сохраняет базу

-- Отключаем все активные соединения к базе
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = current_database()
  AND pid <> pg_backend_pid();

-- Удаляем схему public и все её содержимое
DROP SCHEMA IF EXISTS public CASCADE;

-- Создаем схему public заново
CREATE SCHEMA public;

-- Восстанавливаем стандартные права доступа
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

