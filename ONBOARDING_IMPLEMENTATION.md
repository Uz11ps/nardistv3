# Реализация онбординга по Figma

## Описание

Реализован полный онбординг согласно дизайну из Figma с 4 шагами:

1. **Приветственная страница (Welcome)** - первый экран с кнопкой "Начать"
2. **Создание профиля (CreateProfile)** - заполнение никнейма, имени, страны, аватарки
3. **Стартовый набор (StarterKit)** - получение базовой доски, костей и 1000 NAR-coin
4. **Главное меню (Home)** - финальный экран после завершения онбординга

## Структура файлов

### Backend

- `backend/src/onboarding/onboarding.service.ts` - бизнес-логика онбординга
- `backend/src/onboarding/onboarding.controller.ts` - API endpoints
- `backend/src/onboarding/onboarding.module.ts` - модуль NestJS
- `backend/src/users/user.entity.ts` - добавлены поля:
  - `onboardingCompleted` - завершен ли онбординг
  - `profileSetupCompleted` - заполнен ли профиль
  - `starterKitClaimed` - получен ли стартовый набор

### Frontend

- `frontend/src/pages/Welcome.tsx` - приветственная страница
- `frontend/src/pages/CreateProfile.tsx` - создание профиля
- `frontend/src/pages/StarterKit.tsx` - стартовый набор
- `frontend/src/pages/Onboarding.tsx` - роутер онбординга

## API Endpoints

### GET `/onboarding/status`
Получить статус онбординга пользователя

**Response:**
```json
{
  "welcomeShown": true,
  "profileSetupCompleted": false,
  "starterKitClaimed": false,
  "onboardingCompleted": false
}
```

### POST `/onboarding/complete-profile`
Сохранить данные профиля

**Body:**
```json
{
  "nickname": "string",
  "country": "string",
  "avatarUrl": "string (optional)"
}
```

### POST `/onboarding/claim-starter-kit`
Получить стартовый набор (1000 NAR-coin)

**Response:**
```json
{
  "narCoin": 1000,
  "starterKit": {
    "board": "Базовая доска",
    "dice": "Базовые кости"
  }
}
```

### POST `/onboarding/complete`
Завершить онбординг (вызывается автоматически после получения стартового набора)

## Поток онбординга

1. Пользователь открывает приложение через Telegram бота
2. Если пользователь новый, показывается Welcome страница
3. При нажатии "Начать" происходит авторизация через Telegram (если не авторизован)
4. После авторизации показывается CreateProfile страница
5. Пользователь заполняет:
   - Никнейм (подтягивается из Telegram, можно изменить)
   - Имя (подтягивается из Telegram, можно изменить)
   - Страна (выбор из списка)
   - Аватарка (можно использовать из Telegram)
6. При нажатии "Продолжить" данные сохраняются, переход на StarterKit
7. На странице StarterKit показывается:
   - Базовая доска
   - Базовые кости
   - 1000 NAR-coin
8. При нажатии "Забрать набор":
   - Начисляется 1000 NAR-coin
   - Отмечается `starterKitClaimed = true`
   - Если профиль заполнен - `onboardingCompleted = true`
   - Автоматический переход на главный экран (Home)

## Логика проверки онбординга

При загрузке приложения:
- Если `onboardingCompleted = true` → показывается главный экран
- Если `profileSetupCompleted = false` → показывается CreateProfile
- Если `profileSetupCompleted = true` и `starterKitClaimed = false` → показывается StarterKit
- Если не авторизован → показывается Welcome

## Миграция базы данных

Добавлены новые поля в таблицу `users`:
- `onboardingCompleted BOOLEAN DEFAULT false`
- `profileSetupCompleted BOOLEAN DEFAULT false`
- `starterKitClaimed BOOLEAN DEFAULT false`

TypeORM автоматически создаст эти поля при следующем запуске (если `synchronize: true`).

## Примечания

- Стартовый набор можно получить только один раз (проверка `starterKitClaimed`)
- При создании нового пользователя все флаги онбординга устанавливаются в `false`
- После завершения онбординга пользователь автоматически переходит на главный экран
- Если пользователь не прошел онбординг, он не может попасть на главный экран (будет редирект на онбординг)

