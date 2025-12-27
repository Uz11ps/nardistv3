-- Миграция: Добавление полей настроек пользователя
-- Все настройки по умолчанию включены (true)

ALTER TABLE users ADD COLUMN IF NOT EXISTS vibration BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sound BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS match_notifications BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS economic_events BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clan_events BOOLEAN DEFAULT true;

