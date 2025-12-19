# Статус реализации BACKEND (что реально работает на сервере)

## ✅ ПОЛНОСТЬЮ РЕАЛИЗОВАНО НА БЭКЕНДЕ

### 1. Основные модули и API эндпоинты

#### **Games (Игры)**
- ✅ `POST /games/create-bot` - создание игры с ботом
- ✅ `GET /games/:id` - получение игры
- ✅ WebSocket: `join_game`, `roll_dice`, `make_move`, `game_state`, `dice_rolled`, `move_made`, `game_finished`
- ✅ Игровые движки: BackgammonEngine (короткие), LongBackgammonEngine (длинные)
- ✅ Server-side RNG: rngSeed, rngHash для античита
- ✅ Валидация ходов на сервере
- ✅ Сохранение всех ходов (GameMove entity)

#### **Ratings (Рейтинги)**
- ✅ `GET /ratings/leaderboard` - глобальная таблица лидеров
- ✅ `GET /ratings/leaderboard/weekly` - недельная таблица
- ✅ `GET /ratings/me` - рейтинги текущего пользователя
- ✅ `GET /ratings/rank/:userId` - ранг пользователя
- ✅ ELO система с K-factor = 32
- ✅ Отдельные рейтинги по режимам (SHORT/LONG)
- ✅ Автоматическое обновление рейтингов после игры

#### **Tournaments (Турниры)**
- ✅ `GET /tournaments` - список турниров
- ✅ `GET /tournaments/:id` - детали турнира
- ✅ `POST /tournaments/:id/register` - регистрация
- ✅ Форматы: BRACKET, ROUND_ROBIN
- ✅ Автоматическое создание матчей (createBracketMatches, createRoundRobinMatches)
- ✅ Управление статусами (UPCOMING, REGISTRATION, IN_PROGRESS, FINISHED)

#### **Matchmaking (Поиск игры)**
- ✅ WebSocket Gateway для matchmaking
- ✅ Очередь через Redis (zadd, zrangebyscore)
- ✅ Подбор по рейтингу (диапазон ±200)
- ✅ Свободные столы (open tables)
- ✅ Тайм-аут очереди (300 секунд)

#### **Referrals (Рефералы)**
- ✅ `GET /referrals/stats` - статистика рефералов
- ✅ `POST /referrals/use` - использование реферального кода
- ✅ Генерация уникальных реферальных кодов
- ✅ Начисление наград (500 NAR + 100 XP рефереру, 200 NAR + 50 XP новичку)
- ✅ Метрики (totalReferred, activeReferred)

#### **History (История игр)**
- ✅ `GET /history` - список игр с фильтрами (mode, result)
- ✅ `GET /history/replay/:gameId` - реплей игры
- ✅ `GET /history/export/:gameId/json` - экспорт в JSON
- ✅ `GET /history/export/:gameId/csv` - экспорт в CSV
- ✅ Сохранение всех данных игры (GameMove с gameStateBefore/After)
- ✅ Фильтры по режиму, результату, типу

#### **Progress (Прогресс)**
- ✅ `GET /progress/enhancements` - получение усилений
- ✅ `POST /progress/enhancement` - выбор усиления
- ✅ `addXP(userId, amount)` - начисление опыта
- ✅ `addNarCoin(userId, amount)` - начисление NAR-coin
- ✅ Система уровней (50 уровней, 1000 XP на уровень)
- ✅ Усиления: ECONOMY, ENERGY, LIFE, STRENGTH

#### **City (Город)**
- ✅ `GET /city` - получение города пользователя
- ✅ `GET /city/districts` - список районов (7 районов)
- ✅ `GET /city/buildings` - здания пользователя
- ✅ `POST /city/buildings/:buildingId/collect` - сбор дохода
- ✅ `POST /city/districts/:districtId/capture` - захват района (заглушка)
- ✅ `POST /city/upgrade/:buildingId` - улучшение здания
- ✅ Пассивный доход (incomePerHour, accumulatedIncome)
- ✅ Кап накопления (INCOME_CAP = 10000)
- ✅ Апгрейды зданий за NAR-coin

#### **Quests (Задания)**
- ✅ `GET /quests/:type` - получение заданий (daily/weekly)
- ✅ `POST /quests/:id/claim` - получение награды
- ✅ Типы заданий: PLAY_MATCHES, WIN_STREAK, TOURNAMENT
- ✅ Прогресс заданий (QuestProgress entity)
- ✅ Награды: NAR-coin, XP, скины

#### **Subscription (Подписка)**
- ✅ `GET /subscription/status` - проверка активной подписки
- ✅ `POST /subscription/purchase` - создание подписки
- ✅ Планы: MONTH_1, MONTH_3, MONTH_12
- ✅ Автоматическая проверка срока действия
- ❌ **НЕТ проверки премиум-функций в других модулях**
- ❌ **НЕТ ограничений для бесплатных пользователей**

#### **Skins (Скины)**
- ✅ `GET /skins` - все скины
- ✅ `GET /skins/my` - скины пользователя
- ✅ `GET /skins/selected` - выбранный скин
- ✅ `POST /skins/select` - выбор скина
- ✅ Инициализация 4 стартовых скинов
- ✅ Хранение выбранного скина (UserSkin entity)

#### **Academy (Академия)**
- ✅ `GET /academy/courses` - список курсов
- ✅ `GET /academy/articles` - список статей
- ✅ `GET /academy/my-materials` - купленные материалы
- ✅ `GET /academy/:id` - детали статьи/курса
- ✅ `POST /academy` - создание (только тренер/админ)
- ✅ `PUT /academy/:id` - обновление
- ✅ `DELETE /academy/:id` - удаление
- ✅ `POST /academy/courses/:id/purchase` - покупка курса
- ✅ Роль тренера (isTrainer с 20 уровня)
- ⚠️ **Покупка работает, но нет сохранения в user_materials таблице**

#### **Clans (Кланы)**
- ✅ `GET /clans` - список кланов
- ✅ `GET /clans/:id` - детали клана
- ✅ `GET /clans/:id/members` - участники
- ✅ `POST /clans/create` - создание клана
- ✅ `POST /clans/:id/join` - вступление
- ✅ `POST /clans/:id/leave` - выход
- ✅ `POST /clans/:id/contribute` - вклад в казну
- ✅ `POST /clans/:id/upgrade` - улучшение клана
- ✅ Роли: LEADER, OFFICER, MEMBER
- ✅ Казна клана (treasury)
- ✅ Улучшения: districtStrength, economy

#### **Admin (Админка)**
- ✅ `POST /admin/login` - авторизация админа
- ✅ `GET /admin/stats` - статистика (пользователи, игры, экономика)
- ✅ `GET /admin/users` - список пользователей
- ✅ `GET /admin/users/:id` - детали пользователя
- ✅ `POST /admin/users/:id/ban` - бан пользователя
- ✅ `POST /admin/users/:id/unban` - разбан
- ✅ `GET /admin/games` - список игр
- ✅ `GET /admin/games/:id` - детали игры
- ✅ `POST /admin/games/create` - создание игры
- ✅ `POST /admin/tournaments/create` - создание турнира
- ✅ `GET /admin/tournaments` - список турниров
- ✅ `POST /admin/academy/create` - создание статьи
- ✅ `GET /admin/academy` - список статей
- ✅ `PUT /admin/academy/:id` - обновление статьи
- ✅ `DELETE /admin/academy/:id` - удаление статьи

#### **Users (Пользователи)**
- ✅ `GET /users/me` - текущий пользователь
- ✅ `PUT /users/me` - обновление профиля
- ✅ `GET /users/onboarding-progress` - прогресс онбординга
- ✅ `POST /users/complete-onboarding-step` - завершение шага
- ✅ `GET /users/:id` - пользователь по ID

#### **Auth (Авторизация)**
- ✅ `POST /auth/login` - вход через Telegram initData
- ✅ `GET /auth/me` - текущий пользователь
- ✅ Верификация Telegram initData (HMAC SHA256)
- ✅ JWT токены
- ✅ Создание пользователя при первом входе
- ✅ Обновление данных пользователя

---

## ❌ НЕ РЕАЛИЗОВАНО НА БЭКЕНДЕ

### 1. **Платежи (критично)**
- ❌ Интеграция с TON платежами
- ❌ Интеграция с USDT
- ❌ Интеграция с Telegram Stars/Tribute
- ❌ Обработка платежных вебхуков
- ❌ Создание платежных ссылок/инвойсов
- ❌ Проверка статуса платежей

### 2. **Премиум-функции подписки**
- ❌ Автоанализ игр (подсветка ошибок, рекомендации)
- ❌ API для тренажера позиций
- ❌ Ограничение истории для бесплатных (например, только последние 10 игр)
- ❌ Приоритет в матчмейкинге для премиум
- ❌ Премиум-квесты (отдельные задания)
- ❌ Премиум-значок (только флаг в User, но не используется)

### 3. **Детали реализации**
- ❌ Сохранение покупок материалов академии (user_materials таблица)
- ❌ Применение усилений в игре (снижение комиссии, лимит боев, жизни, вес скинов)
- ❌ Захват районов города кланами (captureDistrict - заглушка)
- ❌ Автоматическое отслеживание прогресса квестов (нужно вызывать updateQuestProgress при событиях)

---

## ⚠️ ЧАСТИЧНО РЕАЛИЗОВАНО

### 1. **Усиления (Enhancement)**
- ✅ Структура есть (entity, enum, методы)
- ✅ Выбор усиления работает
- ❌ Применение в игре не реализовано:
  - Экономика: снижение комиссии в играх на NAR-coin
  - Энергия: лимит боев, восстановление
  - Жизни: запас поражений, регенерация, докупка
  - Сила: лимит "веса" сетов скинов

### 2. **Академия - платные материалы**
- ✅ Покупка работает (списание NAR-coin)
- ❌ Нет таблицы user_materials для сохранения покупок
- ❌ getUserMaterials всегда возвращает пустой массив

### 3. **Подписка**
- ✅ Проверка активной подписки
- ✅ Создание подписки
- ❌ Нет использования hasActiveSubscription в других модулях
- ❌ Нет ограничений для бесплатных пользователей

---

## 📊 API ЭНДПОИНТЫ - ПОЛНЫЙ СПИСОК

### Работающие эндпоинты:

**Auth:**
- `POST /auth/login`
- `GET /auth/me`

**Users:**
- `GET /users/me`
- `PUT /users/me`
- `GET /users/onboarding-progress`
- `POST /users/complete-onboarding-step`
- `GET /users/:id`

**Games:**
- `GET /games/:id`
- `POST /games/create-bot`

**Ratings:**
- `GET /ratings/leaderboard`
- `GET /ratings/leaderboard/weekly`
- `GET /ratings/me`
- `GET /ratings/rank/:userId`

**Tournaments:**
- `GET /tournaments`
- `GET /tournaments/:id`
- `POST /tournaments/:id/register`

**History:**
- `GET /history`
- `GET /history/replay/:gameId`
- `GET /history/export/:gameId/json`
- `GET /history/export/:gameId/csv`

**Progress:**
- `GET /progress/enhancements`
- `POST /progress/enhancement`

**City:**
- `GET /city`
- `GET /city/districts`
- `GET /city/buildings`
- `POST /city/buildings/:buildingId/collect`
- `POST /city/districts/:districtId/capture`
- `POST /city/upgrade/:buildingId`

**Quests:**
- `GET /quests/:type`
- `POST /quests/:id/claim`

**Subscription:**
- `GET /subscription/status`
- `POST /subscription/purchase`

**Skins:**
- `GET /skins`
- `GET /skins/my`
- `GET /skins/selected`
- `POST /skins/select`

**Academy:**
- `GET /academy/courses`
- `GET /academy/articles`
- `GET /academy/my-materials`
- `GET /academy/:id`
- `POST /academy`
- `PUT /academy/:id`
- `DELETE /academy/:id`
- `POST /academy/courses/:id/purchase`

**Clans:**
- `GET /clans`
- `GET /clans/:id`
- `GET /clans/:id/members`
- `POST /clans/create`
- `POST /clans/:id/join`
- `POST /clans/:id/leave`
- `POST /clans/:id/contribute`
- `POST /clans/:id/upgrade`

**Referrals:**
- `GET /referrals/stats`
- `POST /referrals/use`

**Admin:**
- `POST /admin/login`
- `GET /admin/stats`
- `GET /admin/users`
- `GET /admin/users/:id`
- `POST /admin/users/:id/ban`
- `POST /admin/users/:id/unban`
- `GET /admin/games`
- `GET /admin/games/:id`
- `POST /admin/games/create`
- `POST /admin/tournaments/create`
- `GET /admin/tournaments`
- `POST /admin/academy/create`
- `GET /admin/academy`
- `PUT /admin/academy/:id`
- `DELETE /admin/academy/:id`

---

## 🎯 ВЫВОДЫ

**Что работает на бэкенде:**
- ✅ Все основные игровые механики
- ✅ Рейтинги, турниры, матчмейкинг
- ✅ Прогресс, экономика, город
- ✅ Задания, рефералы, скины
- ✅ История игр с реплеем и экспортом
- ✅ Академия с CRUD
- ✅ Админка со статистикой
- ✅ WebSocket для реального времени

**Что НЕ работает:**
- ❌ Платежи (TON/USDT/Stars)
- ❌ Премиум-функции (анализ, тренажер, ограничения)
- ❌ Применение усилений в игровом процессе
- ❌ Сохранение покупок материалов

**Процент готовности бэкенда: ~85-90%**

Основные функции реализованы. Не хватает платежей и деталей премиум-функций.

