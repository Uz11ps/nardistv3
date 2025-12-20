-- Миграция для добавления поля isGuest в таблицу users
-- Дата: 2025-12-20

-- Добавляем поле isGuest если его еще нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'isGuest'
    ) THEN
        ALTER TABLE users ADD COLUMN "isGuest" BOOLEAN DEFAULT false;
        -- Обновляем существующие записи (все существующие пользователи не являются гостями)
        UPDATE users SET "isGuest" = false WHERE "isGuest" IS NULL;
    END IF;
END $$;

-- Создаем индекс для быстрого поиска гостевых пользователей (опционально)
CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users("isGuest") WHERE "isGuest" = true;

