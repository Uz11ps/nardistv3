# Аудит системы турниров и рейтингов

## ✅ Что реализовано

### Турниры
- ✅ Форматы: BRACKET (брекет), ROUND_ROBIN (круговые мини-лиги)
- ✅ Расписание: registrationStart, registrationEnd, startDate, endDate
- ✅ Статусы: UPCOMING, REGISTRATION, IN_PROGRESS, FINISHED, CANCELLED
- ✅ Регистрация с проверкой билетов и NAR-coin
- ✅ Создание матчей при старте турнира

### Рейтинг
- ✅ Elo система (K_FACTOR = 32)
- ✅ Рейтинги по режимам (SHORT, LONG)
- ✅ Глобальная таблица лидеров (`GET /ratings/leaderboard`)
- ✅ Недельная таблица лидеров (`GET /ratings/leaderboard/weekly`)
- ✅ Метод получения бейджа по рейтингу (`getBadge`)

## ❌ Критические проблемы

### 1. Авто-продвижение в турнирах (BRACKET)
**Проблема:** Метод `advanceTournament` только проверяет завершение турнира, но НЕ создает матчи следующего раунда.

**Текущий код:**
```typescript
private async advanceTournament(tournamentId: string): Promise<void> {
  const tournament = await this.findOne(tournamentId);
  const unfinishedMatches = await this.matchesRepository.find({
    where: { tournamentId, status: MatchStatus.IN_PROGRESS },
  });

  if (unfinishedMatches.length === 0) {
    tournament.status = TournamentStatus.FINISHED;
    tournament.endDate = new Date();
    await this.tournamentsRepository.save(tournament);
  }
}
```

**Что нужно:**
- Проверять завершение всех матчей текущего раунда
- Создавать матчи следующего раунда с победителями
- Продвигать победителей в следующий раунд

### 2. Создание брекет-матчей
**Проблема:** В `createBracketMatches` создаются матчи без player1Id и player2Id.

**Текущий код:**
```typescript
private async createBracketMatches(tournament: Tournament): Promise<void> {
  const participants = tournament.currentParticipants;
  const rounds = Math.ceil(Math.log2(participants));
  
  for (let round = 0; round < rounds; round++) {
    const matchesInRound = Math.floor(participants / Math.pow(2, round + 1));
    for (let matchNum = 0; matchNum < matchesInRound; matchNum++) {
      await this.matchesRepository.save({
        tournamentId: tournament.id,
        round,
        matchNumber: matchNum,
        status: MatchStatus.SCHEDULED,
      });
    }
  }
}
```

**Что нужно:**
- Для первого раунда (round 0): распределить всех участников по парам
- Для следующих раундов: создавать матчи с победителями предыдущего раунда

### 3. Таблица результатов турнира
**Проблема:** Нет метода для получения таблицы результатов турнира.

**Что нужно:**
- Метод `getTournamentResults(tournamentId)` - таблица всех участников с результатами
- Метод `getRoundResults(tournamentId, round)` - результаты конкретного раунда
- Для ROUND_ROBIN: таблица с очками, победами, поражениями

### 4. Бейджи в API
**Проблема:** Метод `getBadge` есть, но не используется в контроллере.

**Что нужно:**
- Добавить бейдж в ответ `getLeaderboard`
- Добавить бейдж в ответ `getMyRatings`
- Интегрировать с системой достижений

### 5. Интеграция рейтингов с играми
**Проверка:** Нужно убедиться, что рейтинги обновляются после завершения игр.

## 📋 Что нужно доработать

1. **Исправить авто-продвижение в турнирах**
   - Переписать `advanceTournament` для создания матчей следующего раунда
   - Исправить `createBracketMatches` для распределения участников

2. **Добавить таблицу результатов**
   - Метод для получения результатов турнира
   - Метод для получения результатов раунда

3. **Добавить бейджи в API**
   - Интегрировать `getBadge` в контроллер рейтингов

4. **Проверить интеграцию рейтингов**
   - Убедиться, что `RatingsService.updateRatings` вызывается после игр

