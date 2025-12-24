-- Миграция для системы прогресса и уровней

-- Таблица истории матчей между игроками (анти-фарм)
CREATE TABLE IF NOT EXISTS player_match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id VARCHAR(255) NOT NULL,
  player2_id VARCHAR(255) NOT NULL,
  match_count INTEGER DEFAULT 1,
  first_match_at TIMESTAMP NOT NULL,
  last_match_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player1_id, player2_id)
);

CREATE INDEX IF NOT EXISTS idx_player_match_history_player1 ON player_match_history(player1_id);
CREATE INDEX IF NOT EXISTS idx_player_match_history_player2 ON player_match_history(player2_id);
CREATE INDEX IF NOT EXISTS idx_player_match_history_first_match ON player_match_history(first_match_at);

-- Таблица покупок энергии и жизней
CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('energy', 'lives')),
  amount INTEGER NOT NULL,
  cost BIGINT NOT NULL,
  purchase_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_purchases_user_type_date ON user_purchases(user_id, type, purchase_date);
CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_type ON user_purchases(type);
CREATE INDEX IF NOT EXISTS idx_user_purchases_date ON user_purchases(purchase_date);

