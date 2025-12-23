-- Добавление настроек автобилда города
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "autobuildMinBalance" BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS "autobuildStrategy" VARCHAR(20) DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS "autobuildPriorityDistrict" VARCHAR(255) NULL;

