# Все API Endpoints проекта Nardist

**Базовый URL:** `/api`

## 📋 Публичные Endpoints (без авторизации)

### App
- `GET /api/` - Корневой endpoint
- `GET /api/health` - Health check

### Skins
- `GET /api/skins` - Получить все скины

### Ratings
- `GET /api/ratings/leaderboard` - Получить рейтинговую таблицу
  - Query params: `mode` (GameMode), `period` (string), `limit` (number)
- `GET /api/ratings/leaderboard/weekly` - Еженедельная рейтинговая таблица
  - Query params: `mode` (GameMode), `limit` (number)

### Clans
- `GET /api/clans` - Получить список кланов
  - Query params: `type` (active/new/top), `search` (string)
- `GET /api/clans/:id` - Получить информацию о клане

### Tournaments
- `GET /api/tournaments` - Получить список турниров
  - Query params: `status` (string)
- `GET /api/tournaments/:id` - Получить информацию о турнире

### Subscription
- `GET /api/subscription/plans` - Получить доступные планы подписки

### Policy
- `GET /api/policy/:type` - Получить политику (privacy/agreement)

### Uploads (статические файлы)
- `GET /api/uploads/skins/:filename` - Получить изображение скина
- `GET /api/uploads/images/:filename` - Получить изображение

### Bot Webhook
- `POST /api/bot/webhook` - Webhook для Telegram бота

---

## 🔐 Endpoints с JWT авторизацией

### Auth
- `POST /api/auth/login` - Вход через Telegram initData
- `POST /api/auth/test-init-data` - Тестовый endpoint для проверки initData
- `POST /api/auth/guest` - Гостевой вход
- `GET /api/auth/me` - Получить текущего пользователя (из токена)

### Users
- `GET /api/users/me` - Получить профиль текущего пользователя
- `PUT /api/users/me` - Обновить профиль текущего пользователя
- `GET /api/users/onboarding-progress` - Получить прогресс онбординга
- `POST /api/users/complete-onboarding-step` - Завершить шаг онбординга
- `GET /api/users/:id` - Получить информацию о пользователе

### Games
- `GET /api/games/tables` - Получить открытые столы
- `GET /api/games/active` - Получить активную игру пользователя
- `GET /api/games/:id` - Получить состояние игры
- `GET /api/games/:id/skins` - Получить скины игры
- `POST /api/games/create-bot` - Создать игру с ботом
  - Body: `{ mode?: string }`
- `POST /api/games/create-ai` - Создать игру с ИИ (алиас для create-bot)
  - Body: `{ mode?: string }`
- `POST /api/games/:id/possible-moves` - Получить возможные ходы
  - Body: `{ pendingMoves?: Array<{ from: number; to: number; die: number }> }`
- `POST /api/games/:id/resign` - Сдаться в игре
- `POST /api/games/:id/offset` - Установить смещение
  - Body: `{ offset: number }`

### Skins
- `GET /api/skins/my` - Получить скины текущего пользователя
- `GET /api/skins/my/with-durability` - Получить скины с информацией о прочности
- `GET /api/skins/user/:userId` - Получить скины пользователя
- `GET /api/skins/selected` - Получить выбранные скины
- `GET /api/skins/selected/explicit` - Получить явно выбранные скины
- `GET /api/skins/user/:userId/selected` - Получить выбранные скины пользователя
- `POST /api/skins/update-defaults` - Обновить дефолтные скины (только админы)
- `POST /api/skins/select` - Выбрать скин
  - Body: `{ skinId: string }`
- `POST /api/skins/purchase` - Купить скин
  - Body: `{ skinId: string }`
- `GET /api/skins/:id/repair-cost` - Получить стоимость ремонта скина
- `POST /api/skins/:id/repair` - Починить скин

### City
- `GET /api/city/buildings` - Получить доступные здания
- `GET /api/city/my-buildings` - Получить здания пользователя
- `POST /api/city/buildings/purchase` - Купить здание
  - Body: `{ buildingConfigId: string }`
- `PUT /api/city/buildings/:id/upgrade` - Улучшить здание
- `POST /api/city/buildings/:id/collect` - Собрать доход с здания
- `GET /api/city/autobuild/settings` - Получить настройки автобилда
- `POST /api/city/autobuild/settings` - Сохранить настройки автобилда
  - Body: `{ minBalance: number; strategy: string; priorityBuilding?: string | null }`

### Clans
- `GET /api/clans/my` - Получить клан пользователя
- `GET /api/clans/:id/members` - Получить членов клана
- `POST /api/clans/create` - Создать клан
  - Body: `{ name: string; description?: string }`
- `POST /api/clans/:id/join` - Вступить в клан
- `POST /api/clans/:id/leave` - Покинуть клан
- `POST /api/clans/:id/disband` - Распустить клан
- `POST /api/clans/:id/contribute` - Внести вклад в клан
  - Body: `{ amount: number }`
- `POST /api/clans/:id/upgrade` - Улучшить клан
  - Body: `{ upgradeType: string }`
- `GET /api/clans/:id/treasury/transactions` - Получить транзакции казны
  - Query params: `limit` (number)
- `GET /api/clans/:id/upgrades` - Получить улучшения клана
- `GET /api/clans/:id/territories` - Получить территории клана
- `GET /api/clans/:id/territories/available` - Получить доступные территории для захвата
- `GET /api/clans/:id/territories/capture-status` - Получить статус возможности захвата
- `POST /api/clans/:id/territories/capture` - Захватить территорию
  - Body: `{ buildingType: string }`

### Tournaments
- `POST /api/tournaments/:id/register` - Зарегистрироваться на турнир

### Academy
- `GET /api/academy/courses` - Получить курсы
- `GET /api/academy/articles` - Получить статьи
- `GET /api/academy/my-materials` - Получить материалы пользователя
- `POST /api/academy/courses/:id/purchase` - Купить курс
- `GET /api/academy/materials/:id` - Получить материал по ID
- `GET /api/academy/:id` - Получить материал/статью по ID
- `POST /api/academy` - Создать статью (только админы)
- `POST /api/academy/slots/purchase` - Купить слот для статьи
  - Body: `{ price?: number }`
- `GET /api/academy/slots` - Получить слоты пользователя
- `POST /api/academy/slots/:slotId/create` - Создать статью в слоте
  - Body: `{ title: string; content: string; telegraphData?: any }`
- `POST /api/academy/courses/create` - Создать курс (для верификации)
  - Body: `{ title: string; description?: string; content: string; price: number }`
- `PUT /api/academy/my-articles/:id` - Обновить статью пользователя
  - Body: `{ title?: string; content?: string; telegraphData?: any }`
- `PUT /api/academy/:id` - Обновить статью (только админы)
- `DELETE /api/academy/:id` - Удалить статью (только админы)

### History
- `GET /api/history` - Получить историю игр пользователя
  - Query params: filters
- `GET /api/history/replay/:gameId` - Получить реплей игры
  - Query params: `step` (number)
- `GET /api/history/export/:gameId/json` - Экспорт игры в JSON
- `GET /api/history/export/:gameId/csv` - Экспорт игры в CSV

### Notifications
- `GET /api/notifications` - Получить уведомления пользователя
- `GET /api/notifications/unread-count` - Получить количество непрочитанных уведомлений
- `PUT /api/notifications/:id/read` - Отметить уведомление как прочитанное
- `POST /api/notifications/mark-all-read` - Отметить все уведомления как прочитанные

### Onboarding
- `GET /api/onboarding/status` - Получить статус онбординга
- `POST /api/onboarding/complete-profile` - Завершить настройку профиля
  - Body: `{ nickname?: string; country?: string; avatarUrl?: string }`
- `GET /api/onboarding/starter-kit-info` - Получить информацию о стартовом наборе
- `POST /api/onboarding/claim-starter-kit` - Получить стартовый набор
- `POST /api/onboarding/complete` - Завершить онбординг

### Payment
- `POST /api/payment/ton/create` - Создать платеж TON
  - Body: `{ amount: number; description: string; type: 'subscription' | 'nar_coin' | 'skin' }`
- `GET /api/payment/ton/status/:paymentId` - Получить статус платежа
- `POST /api/payment/webhook` - Webhook для обработки платежей

### Progress
- `GET /api/progress/enhancements` - Получить улучшения
- `POST /api/progress/enhancement` - Выбрать улучшение
  - Body: `{ type: EnhancementType }`
- `GET /api/progress/energy` - Получить энергию
- `GET /api/progress/lives` - Получить жизни
- `POST /api/progress/lives/buy` - Купить жизнь
- `GET /api/progress/skin-weight-limit` - Получить лимит веса скинов

### Quests
- `GET /api/quests/:type` - Получить квесты по типу
- `POST /api/quests/:id/claim` - Получить награду за квест
- `POST /api/quests/:id/check-subscription` - Проверить подписку на канал

### Ratings
- `GET /api/ratings/me` - Получить рейтинги пользователя
- `GET /api/ratings/rank/:userId` - Получить ранг пользователя
  - Query params: `mode` (GameMode)

### Referrals
- `GET /api/referrals/stats` - Получить статистику рефералов
- `POST /api/referrals/use` - Использовать реферальный код
  - Body: `{ code: string }`

### Subscription
- `GET /api/subscription/status` - Получить статус подписки
- `POST /api/subscription/purchase` - Купить подписку
  - Body: `{ plan: SubscriptionPlan }`
- `GET /api/subscription/city-autobuild/status` - Получить статус автобилда города
- `POST /api/subscription/city-autobuild/purchase` - Купить автобилд города
  - Body: `{ paymentMethod: 'usd' | 'nar' }`

### Training
- `GET /api/training/positions` - Получить позиции для тренировки
  - Query params: `difficulty` (number)
- `GET /api/training/positions/:id` - Получить позицию по ID
- `POST /api/training/positions/:id/check` - Проверить решение позиции
  - Body: `{ move: Array<{ from: number; to: number; die: number }> }`
- `GET /api/training/tasks` - Получить задачи тренировки
- `POST /api/training/tasks/:id/claim` - Получить награду за задачу

### Achievements
- `GET /api/achievements` - Получить достижения пользователя
  - Query params: `filter` (string)
- `POST /api/achievements/:id/claim` - Получить награду за достижение

### Analysis
- `GET /api/analysis/game/:gameId` - Проанализировать игру

### Upload
- `POST /api/upload/image` - Загрузить изображение (multipart/form-data, поле: `file`)

### Policy
- `POST /api/policy` - Создать политику (только админы)
  - Body: `{ type: 'privacy' | 'agreement'; content: string }`
- `PUT /api/policy/:type` - Обновить политику (только админы)
  - Body: `{ content: string }`

---

## 🔑 Админские Endpoints (требуют AdminAuthGuard)

### Admin - Auth
- `POST /api/admin/login` - Вход в админ-панель
  - Body: `{ login: string; password: string }`

### Admin - Stats
- `GET /api/admin/stats` - Получить статистику системы

### Admin - Users
- `GET /api/admin/users` - Получить всех пользователей
- `GET /api/admin/users/:id` - Получить детали пользователя
- `POST /api/admin/users/:id/ban` - Забанить пользователя
  - Body: `{ reason: string }`
- `POST /api/admin/users/:id/unban` - Разбанить пользователя
- `DELETE /api/admin/users/:id` - Удалить пользователя
- `POST /api/admin/users/:id/subscription` - Выдать подписку
  - Body: `{ plan: string; months?: number }`
- `PUT /api/admin/users/:id/balance` - Обновить баланс пользователя
  - Body: `{ narCoin: number; xp?: number }`
- `PUT /api/admin/users/:id/level` - Установить уровень пользователя
  - Body: `{ level: number }`
- `POST /api/admin/users/:id/sync-level` - Синхронизировать уровень с опытом
- `PUT /api/admin/users/:id/role` - Установить роль пользователя
  - Body: `{ isAdmin: boolean; isTrainer: boolean }`
- `POST /api/admin/users/:id/reset-progress` - Сбросить прогресс пользователя
- `PUT /api/admin/users/:id/referral-settings` - Обновить настройки рефералов
  - Body: `{ referralPercent?: number; referralBaseBonus?: number }`

### Admin - Games
- `GET /api/admin/games` - Получить все игры
- `GET /api/admin/games/:id` - Получить детали игры
- `POST /api/admin/games/create` - Создать игру
  - Body: `{ player1Id: string; player2Id?: string; mode: string; type: string }`

### Admin - Tournaments
- `GET /api/admin/tournaments` - Получить все турниры
- `GET /api/admin/tournaments/:id` - Получить турнир
- `POST /api/admin/tournaments/create` - Создать турнир
- `PUT /api/admin/tournaments/:id` - Обновить турнир
- `DELETE /api/admin/tournaments/:id` - Удалить турнир

### Admin - Academy
- `GET /api/admin/academy` - Получить все материалы академии
- `POST /api/admin/academy/create` - Создать материал академии
- `PUT /api/admin/academy/:id` - Обновить материал академии
- `DELETE /api/admin/academy/:id` - Удалить материал академии
- `GET /api/admin/courses/pending` - Получить курсы на верификации
- `POST /api/admin/courses/:id/verify` - Верифицировать курс
- `POST /api/admin/courses/:id/reject` - Отклонить курс

### Admin - Notifications
- `POST /api/admin/notifications` - Отправить уведомление (multipart/form-data, поле: `image`)
  - Body: `{ userId?: string; message: string; all?: boolean }`
- `DELETE /api/admin/notifications/:id` - Удалить уведомление
- `DELETE /api/admin/notifications/user/:userId` - Удалить все уведомления пользователя
- `DELETE /api/admin/notifications/all` - Удалить все уведомления

### Admin - Settings
- `GET /api/admin/settings` - Получить все системные настройки
- `POST /api/admin/settings` - Установить системную настройку
  - Body: `{ key: string; value: string; description?: string }`

### Admin - City
- `GET /api/admin/city/rewards` - Получить настройки наград города
- `PUT /api/admin/city/rewards` - Обновить настройки наград города

### Admin - Districts
- `GET /api/admin/districts` - Получить все районы
- `GET /api/admin/districts/:id` - Получить район
- `POST /api/admin/districts` - Создать район
- `PUT /api/admin/districts/:id` - Обновить район
- `DELETE /api/admin/districts/:id` - Удалить район

### Admin - Buildings
- `GET /api/admin/buildings` - Получить все конфигурации зданий
- `GET /api/admin/buildings/:id` - Получить конфигурацию здания
- `POST /api/admin/buildings` - Создать конфигурацию здания (multipart/form-data)
  - Fields: `icon`, `image`, другие поля конфигурации
- `PUT /api/admin/buildings/:id` - Обновить конфигурацию здания (multipart/form-data)
  - Fields: `icon`, `image`, другие поля конфигурации
- `DELETE /api/admin/buildings/:id` - Удалить конфигурацию здания

### Admin - Notification Templates
- `GET /api/admin/notification-templates` - Получить все шаблоны уведомлений
- `GET /api/admin/notification-templates/:type` - Получить шаблон по типу
- `POST /api/admin/notification-templates` - Создать шаблон уведомления
- `PUT /api/admin/notification-templates/:type` - Обновить шаблон уведомления
- `DELETE /api/admin/notification-templates/:type` - Удалить шаблон уведомления

### Admin - Skins
- `GET /api/admin/skins` - Получить все скины
- `POST /api/admin/skins` - Создать скин (multipart/form-data)
  - Fields: `preview`, `shopImage`, `boardTexture`, `diceTexture1-6`, `whiteCheckersTexture`, `blackCheckersTexture`, и другие поля
- `PUT /api/admin/skins/:id` - Обновить скин
- `DELETE /api/admin/skins/:id` - Удалить скин
- `POST /api/admin/skins/:id/upload-image` - Загрузить изображение скина (multipart/form-data, поле: `image`)
- `POST /api/admin/skins/:id/upload-textures` - Загрузить текстуры скина (multipart/form-data)
  - Fields: `preview`, `boardTexture`, `diceTexture1-6`, `whiteCheckersTexture`, `blackCheckersTexture`

### Admin - Quests
- `GET /api/admin/quests` - Получить все квесты
- `GET /api/admin/quests/:id` - Получить квест
- `POST /api/admin/quests` - Создать квест
- `PUT /api/admin/quests/:id` - Обновить квест
- `DELETE /api/admin/quests/:id` - Удалить квест

### Admin - Clans
- `GET /api/admin/clans` - Получить все кланы
- `GET /api/admin/clans/:id` - Получить клан
- `PUT /api/admin/clans/:id` - Обновить клан
- `DELETE /api/admin/clans/:id` - Удалить клан
- `DELETE /api/admin/clans/:clanId/members/:userId` - Удалить участника из клана

### Admin - Policy
- `GET /api/admin/policy/all` - Получить все политики

---

## 📝 Примечания

1. **Авторизация:**
   - JWT токен передается в заголовке `Authorization: Bearer <token>`
   - Админские endpoints требуют `AdminAuthGuard` (только для пользователей с `isAdmin: true`)

2. **Методы HTTP:**
   - `GET` - получение данных
   - `POST` - создание/действие
   - `PUT` - обновление
   - `DELETE` - удаление

3. **Форматы данных:**
   - Большинство endpoints принимают JSON в теле запроса
   - Endpoints загрузки файлов используют `multipart/form-data`

4. **WebSocket:**
   - Реальная игра использует WebSocket через `GamesGateway` (не REST endpoints)

5. **Параметры запроса:**
   - `:id`, `:gameId`, `:userId` и т.д. - параметры пути (path parameters)
   - Query параметры передаются через `?param=value`
   - Body параметры передаются в JSON теле запроса (кроме multipart/form-data)

