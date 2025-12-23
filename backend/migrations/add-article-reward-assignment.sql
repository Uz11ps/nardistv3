-- Миграция для добавления полей награды и задания в таблицу articles
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS "rewardNarCoin" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "rewardXP" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS assignment JSONB;

