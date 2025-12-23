-- Миграция для добавления поля diceTextureUrls в таблицу skins
ALTER TABLE skins 
ADD COLUMN IF NOT EXISTS "diceTextureUrls" JSONB;

