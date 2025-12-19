-- Миграция: Создание таблицы user_materials для сохранения покупок материалов академии

CREATE TABLE IF NOT EXISTS user_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    price_paid BIGINT NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_user_materials_user_id ON user_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_materials_article_id ON user_materials(article_id);

