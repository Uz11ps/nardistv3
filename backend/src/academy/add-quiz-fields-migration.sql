-- Миграция: добавление полей для тестов в таблицу user_materials

ALTER TABLE user_materials 
ADD COLUMN IF NOT EXISTS quiz_passed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS quiz_passed_at TIMESTAMP NULL;

-- Создаем индекс для быстрого поиска пройденных тестов
CREATE INDEX IF NOT EXISTS idx_user_materials_quiz_passed ON user_materials(user_id, quiz_passed) WHERE quiz_passed = TRUE;

