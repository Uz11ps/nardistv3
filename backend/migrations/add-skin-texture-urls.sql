-- Добавляем поля для хранения URL файлов текстур скинов
ALTER TABLE skins 
ADD COLUMN IF NOT EXISTS "boardTextureUrl" VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS "diceTextureUrl" VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS "checkersTextureUrl" VARCHAR(255) NULL;

-- Комментарии для документации
COMMENT ON COLUMN skins."boardTextureUrl" IS 'URL файла текстуры доски (для скинов типа board)';
COMMENT ON COLUMN skins."diceTextureUrl" IS 'URL файла текстуры кубиков (для скинов типа dice)';
COMMENT ON COLUMN skins."checkersTextureUrl" IS 'URL файла текстуры шашек (для скинов типа checkers)';

