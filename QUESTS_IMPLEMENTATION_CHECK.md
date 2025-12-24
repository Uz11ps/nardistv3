# Проверка реализации квестов

## ✅ Реализовано

### 1. Типы квестов
- ✅ Ежедневные (DAILY)
- ✅ Недельные (WEEKLY)
- ✅ Специальные (SPECIAL)

### 2. Цели квестов (QuestTarget)
- ✅ PLAY_MATCHES - сыграть N матчей
- ✅ WIN_STREAK - серия побед
- ✅ COLLECT_INCOME - забрать доход (из города)
- ✅ TOURNAMENT - участие в турнире
- ✅ SUBSCRIBE_CHANNEL - подписка на канал ✅

### 3. Награды
- ✅ NAR-coin - реализовано в `claimQuest`
- ✅ XP - реализовано в `claimQuest`
- ✅ Скины - реализовано в `claimQuest` (через `SkinsService.addSkinToUser`)
- ✅ Билеты на турниры - реализовано в `claimQuest` (через `TournamentTicketsService.addTickets`)

### 4. Подписка на канал
- ✅ Реализовано в `checkChannelSubscription`
- ✅ Использует Telegram Bot API (`getChatMember`)
- ✅ Проверяет статус подписки (member, administrator, creator)
- ✅ Автоматически обновляет прогресс квеста при подписке
- ✅ Endpoint: `POST /quests/:id/check-subscription`

### 5. Выдача наград
**ИСПРАВЛЕНО:** Метод `claimQuest` теперь выдает все награды:
- ✅ NAR-coin начисляется на баланс пользователя
- ✅ XP начисляется через `ProgressService.addXP`
- ✅ Скины добавляются через `SkinsService.addSkinToUser`
- ✅ Билеты добавляются через `TournamentTicketsService.addTickets`

**Файл:** `backend/src/quests/quests.service.ts:147-235`

## ⚠️ Требует доработки

### 1. Билеты на турниры
- ✅ Entity создан: `TournamentTicket`
- ✅ Сервис создан: `TournamentTicketsService`
- ✅ Интеграция в `claimQuest` - реализовано
- ⚠️ Интеграция в `TournamentsService.registerForTournament` - частично реализовано (проверка билета добавлена, но нужно протестировать)

### 2. Сброс ежедневных/недельных квестов
- ✅ Логика сброса реализована в `getQuestsByType` (вычисление resetTime)
- ⚠️ Автоматический сброс прогресса не реализован (нужен cron job)

### 3. Формат rewardSkin
Поддерживаются форматы:
- Строка (ID скина): `"skin-id-here"`
- Объект с id: `{ id: "skin-id-here" }`
- Объект с данными скина: `{ name: "...", type: "board", ... }` (требует доработки)

## 📋 Структура квеста

```typescript
{
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'special';
  target: 'play_matches' | 'win_streak' | 'collect_income' | 'tournament' | 'subscribe_channel';
  targetValue: number; // Целевое значение (например, 5 матчей)
  rewardNarCoin: bigint; // Награда в NAR-coin
  rewardXP: number; // Награда в XP
  rewardSkin: any; // ID скина или объект с данными
  rewardTickets: number; // Количество билетов на турнир
  channelUsername: string; // Для квестов на подписку (например, "@channelname")
  isPremium: boolean; // Только для премиум пользователей
  startDate: Date;
  endDate: Date;
}
```

## 🔄 Процесс выполнения квеста

1. Пользователь получает список активных квестов: `GET /quests/:type`
2. Система автоматически обновляет прогресс при выполнении действий:
   - `PLAY_MATCHES` - при завершении игры
   - `WIN_STREAK` - при победе в игре
   - `COLLECT_INCOME` - при сборе дохода из города
   - `TOURNAMENT` - при регистрации в турнире
   - `SUBSCRIBE_CHANNEL` - при проверке подписки через API
3. Когда прогресс достигает `targetValue`, квест помечается как `completed`
4. Пользователь забирает награду: `POST /quests/:id/claim`
5. Система выдает все награды и помечает квест как `claimed`

## ✅ Итоговая оценка

**Реализация квестов: 95%**

### Полностью реализовано:
- ✅ Все типы квестов
- ✅ Все цели квестов (включая подписку на канал)
- ✅ Выдача всех типов наград (NAR, XP, скины, билеты)
- ✅ Проверка подписки на канал

### Требует доработки:
- ⚠️ Автоматический сброс ежедневных/недельных квестов (cron job)
- ⚠️ Тестирование выдачи билетов и их использования в турнирах
- ⚠️ Поддержка создания скинов из данных в rewardSkin

