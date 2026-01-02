-- Добавление недостающих курсов для длинных и коротких нард
-- Цель: по 3 курса в каждом фильтре

-- Добавляем еще 2 курса для длинных нард
INSERT INTO articles (id, title, content, type, price, "isVerified", assignment, "rewardNarCoin", "rewardXP", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  'Продвинутая тактика длинных нард',
  '<h2>Продвинутая тактика</h2><p>Изучите продвинутые тактические приемы в длинных нардах для повышения мастерства.</p><h3>Тактические приемы:</h3><ul><li>Блокировка соперника</li><li>Создание препятствий</li><li>Оптимальное использование дублей</li></ul>',
  'course',
  0,
  true,
  '{"quiz": {"questions": [{"id": 1, "question": "Какой главный принцип блокировки в длинных нардах?", "options": ["Блокировать все точки", "Создавать препятствия на пути соперника", "Блокировать только дом", "Не блокировать вообще"], "correctAnswer": 1}, {"id": 2, "question": "Что важнее в длинных нардах: скорость или безопасность?", "options": ["Только скорость", "Только безопасность", "Баланс между скоростью и безопасностью", "Зависит от позиции"], "correctAnswer": 2}, {"id": 3, "question": "Когда лучше создавать блоки в длинных нардах?", "options": ["В начале игры", "В середине игры", "В конце игры", "Зависит от позиции"], "correctAnswer": 3}]}}'::jsonb,
  120,
  60,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM articles WHERE type = 'course' AND title = 'Продвинутая тактика длинных нард'
);

INSERT INTO articles (id, title, content, type, price, "isVerified", assignment, "rewardNarCoin", "rewardXP", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  'Дом и вынос в длинных нардах',
  '<h2>Дом и вынос</h2><p>Освойте правильную стратегию заведения шашек в дом и их выноса в длинных нардах.</p><h3>Стратегия дома:</h3><ul><li>Правильное заведение шашек в дом</li><li>Оптимизация выноса</li><li>Избежание ошибок</li></ul>',
  'course',
  0,
  true,
  '{"quiz": {"questions": [{"id": 1, "question": "Когда нужно начинать заводить шашки в дом в длинных нардах?", "options": ["Как можно раньше", "Когда все шашки прошли мимо соперника", "Когда у соперника осталось 5 шашек", "Зависит от позиции"], "correctAnswer": 1}, {"id": 2, "question": "Можно ли выносить шашку, если есть шашки дальше от края в длинных нардах?", "options": ["Да, всегда", "Нет, сначала дальние", "Только при дубле", "Только в конце игры"], "correctAnswer": 1}, {"id": 3, "question": "Что важнее при выносе в длинных нардах?", "options": ["Скорость", "Безопасность", "Баланс", "Зависит от позиции"], "correctAnswer": 3}]}}'::jsonb,
  130,
  65,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM articles WHERE type = 'course' AND title = 'Дом и вынос в длинных нардах'
);

-- Добавляем еще 2 курса для коротких нард
INSERT INTO articles (id, title, content, type, price, "isVerified", assignment, "rewardNarCoin", "rewardXP", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  'Блокировка и примочки в коротких нардах',
  '<h2>Блокировка и примочки</h2><p>Изучите искусство создания блоков и примочек в коротких нардах для контроля доски.</p><h3>Техники блокировки:</h3><ul><li>Создание примочек</li><li>Блокировка ключевых точек</li><li>Контроль доски</li></ul>',
  'course',
  0,
  true,
  '{"quiz": {"questions": [{"id": 1, "question": "Что такое примочка в коротких нардах?", "options": ["Блок из 6 шашек на 6 последовательных точках", "Одна шашка на точке", "Шашка на баре", "Дубль"], "correctAnswer": 0}, {"id": 2, "question": "Сколько шашек нужно для создания примочки?", "options": ["4", "5", "6", "7"], "correctAnswer": 2}, {"id": 3, "question": "На сколько точек должна растянуться примочка?", "options": ["4", "5", "6", "7"], "correctAnswer": 2}]}}'::jsonb,
  160,
  80,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM articles WHERE type = 'course' AND title = 'Блокировка и примочки в коротких нардах'
);

INSERT INTO articles (id, title, content, type, price, "isVerified", assignment, "rewardNarCoin", "rewardXP", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  'Сбивание и бар в коротких нардах',
  '<h2>Сбивание и бар</h2><p>Освойте тактику сбивания шашек соперника и работы с баром в коротких нардах.</p><h3>Тактика сбивания:</h3><ul><li>Когда сбивать шашки</li><li>Работа с баром</li><li>Возврат с бара</li></ul>',
  'course',
  0,
  true,
  '{"quiz": {"questions": [{"id": 1, "question": "Когда можно сбить шашку соперника в коротких нардах?", "options": ["Всегда", "Когда на точке одна шашка соперника", "Только в доме", "Никогда"], "correctAnswer": 1}, {"id": 2, "question": "Что происходит со сбитой шашкой?", "options": ["Удаляется с доски", "Идет на бар", "Возвращается в дом", "Остается на месте"], "correctAnswer": 1}, {"id": 3, "question": "Можно ли ходить другими шашками, если есть шашка на баре?", "options": ["Да, всегда", "Нет, сначала нужно вернуть с бара", "Только при дубле", "Зависит от позиции"], "correctAnswer": 1}]}}'::jsonb,
  170,
  85,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM articles WHERE type = 'course' AND title = 'Сбивание и бар в коротких нардах'
);

-- Проверка результата
SELECT 
  CASE 
    WHEN title ILIKE '%длинн%' OR title ILIKE '%длинные%' THEN 'Длинные нарды'
    WHEN title ILIKE '%коротк%' OR title ILIKE '%короткие%' THEN 'Короткие нарды'
    ELSE 'Общие'
  END as category,
  COUNT(*) as count
FROM articles
WHERE type = 'course'
GROUP BY category
ORDER BY category;

