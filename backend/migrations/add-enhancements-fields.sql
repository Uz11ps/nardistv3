-- Миграция: Добавление полей для усилений и подписки
-- Выполните этот скрипт на вашей базе данных

-- Добавляем поля энергии и жизней в таблицу users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS energy INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS max_energy INT DEFAULT 100,
ADD COLUMN IF NOT EXISTS last_energy_restore TIMESTAMP,
ADD COLUMN IF NOT EXISTS lives INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_lives INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS last_life_restore TIMESTAMP;

-- Добавляем поле weight в таблицу skins
ALTER TABLE skins
ADD COLUMN IF NOT EXISTS weight INT DEFAULT 1;

-- Обновляем существующие скины с весами
UPDATE skins SET weight = 1 WHERE weight IS NULL OR weight = 0;

-- Устанавливаем вес для существующих скинов (если есть)
UPDATE skins SET weight = 1 WHERE theme = 'classic';
UPDATE skins SET weight = 1 WHERE theme = 'dark';
UPDATE skins SET weight = 2 WHERE theme = 'ocean';
UPDATE skins SET weight = 2 WHERE theme = 'forest';

-- Добавляем поля для изображений и цен скинов
ALTER TABLE skins
ADD COLUMN IF NOT EXISTS image_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS price INT,
ADD COLUMN IF NOT EXISTS rarity VARCHAR(50) DEFAULT 'common';

-- Устанавливаем редкость для существующих скинов
UPDATE skins SET rarity = 'common' WHERE rarity IS NULL;

