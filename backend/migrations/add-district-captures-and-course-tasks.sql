-- Миграция для захвата районов и системы заданий

-- Таблица для захваченных районов
CREATE TABLE IF NOT EXISTS district_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_code VARCHAR(50) NOT NULL,
  captured_by_clan_id UUID NOT NULL,
  captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  total_income_collected BIGINT DEFAULT 0,
  last_income_collection TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_district_captures_district_code ON district_captures(district_code);
CREATE INDEX idx_district_captures_clan_id ON district_captures(captured_by_clan_id);
CREATE INDEX idx_district_captures_district_clan ON district_captures(district_code, captured_by_clan_id);

-- Таблица для заданий курсов
CREATE TABLE IF NOT EXISTS course_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  "order" INTEGER DEFAULT 0,
  requirements JSONB,
  reward_nar_coin BIGINT DEFAULT 0,
  reward_xp INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  is_onboarding BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_tasks_course_id ON course_tasks(course_id);
CREATE INDEX idx_course_tasks_course_order ON course_tasks(course_id, "order");
CREATE INDEX idx_course_tasks_onboarding ON course_tasks(is_onboarding) WHERE is_onboarding = true;

-- Таблица для прогресса выполнения заданий
CREATE TABLE IF NOT EXISTS course_task_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES course_tasks(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  target_progress INTEGER,
  is_completed BOOLEAN DEFAULT false,
  is_reward_claimed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  reward_claimed_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

CREATE INDEX idx_course_task_progress_user_id ON course_task_progress(user_id);
CREATE INDEX idx_course_task_progress_task_id ON course_task_progress(task_id);
CREATE INDEX idx_course_task_progress_user_task ON course_task_progress(user_id, task_id);

