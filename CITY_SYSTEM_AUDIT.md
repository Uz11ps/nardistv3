# Аудит системы города и пассивного дохода

## ✅ Реализовано

### 1. Районы (Districts)
- ✅ **7 районов**: Реализованы через `DistrictConfig` и enum `District` (DISTRICT_1 - DISTRICT_7)
- ✅ **Конфигурация**: Каждый район имеет код, название, описание, иконку, изображение
- ✅ **Доход для кланов**: `baseIncomePerDay` - базовый доход в день для кланов
- ⚠️ **Связь с предприятиями**: Районы используются только для захвата кланами, НЕ связаны напрямую с предприятиями игроков

### 2. Предприятия (Buildings)
- ✅ **Типы предприятий**: Реализованы через `BuildingConfig` (shop, factory, club, workshop, school и т.д.)
- ✅ **Покупка**: Игрок может купить предприятие за NAR-coin
- ✅ **Уровни**: Предприятия имеют уровни (1-maxLevel, по умолчанию 10)
- ⚠️ **Привязка к районам**: НЕТ явной привязки предприятий к районам (возможно, не требуется)

### 3. Доход NAR-coin/час
- ✅ **Формула дохода**: `incomePerHour = baseIncomePerHour * 1.2^level`
  - Уровень 1: `baseIncomePerHour * 1.2`
  - Уровень 2: `baseIncomePerHour * 1.44`
  - Уровень 3: `baseIncomePerHour * 1.728`
  - И т.д.
- ✅ **Накопление**: Доход накапливается в `accumulatedIncome` с момента `lastIncomeCollection`
- ✅ **Расчет**: `incomeToAdd = incomePerHour * hoursPassed`
- ✅ **Бонус пассивного дохода**: Теперь применяется из ветки Экономика
  - Формула: `passiveIncomeMultiplier = 1 + 0.015 * min(econSp, 40)`
  - Максимальный бонус: +60% (при 40 SP в Экономике)
- ✅ **Захват кланом**: Если предприятие захвачено кланом, доход уменьшается на 50%

### 4. Кап накопления
- ✅ **Максимальное накопление**: Задается в `BuildingConfig.maxAccumulation`
- ✅ **Ограничение**: `finalIncome = min(accumulatedIncome, maxAccumulation)`
- ✅ **Рекомендация**: Забирать 1-2 раза в день (реализовано через ручной сбор)

### 5. Апгрейды за NAR
- ✅ **Формула цены**: `upgradePrice = basePrice * multiplier^level`
  - По умолчанию `multiplier = 1.4`
  - Уровень 1→2: `basePrice * 1.4`
  - Уровень 2→3: `basePrice * 1.96`
  - И т.д.
- ✅ **Увеличение дохода**: При апгрейде доход пересчитывается: `newIncomePerHour = baseIncomePerHour * 1.2^newLevel`

## 🔧 Исправлено

### 1. Бонус пассивного дохода
- **Проблема**: Бонус пассивного дохода из ветки Экономика не применялся при сборе дохода
- **Исправление**: Добавлено применение `passiveIncomeMultiplier` в методе `collectIncome`
- **Формула**: `incomePerHour = baseIncomePerHour * captureMultiplier * passiveIncomeMultiplier`

### 2. Расчет дохода при покупке
- **Проблема**: При покупке предприятия уровень 1, доход рассчитывался как `baseIncomePerHour` без учета формулы
- **Исправление**: Теперь доход для уровня 1 рассчитывается как `baseIncomePerHour * 1.2^1`

## 📊 Структура данных

### Building Entity
```typescript
{
  id: string;
  userId: string;
  type: string; // Тип предприятия
  level: number; // Уровень (1-maxLevel)
  accumulatedIncome: string; // Накопленный доход
  incomePerHour: string; // Доход в час
  lastIncomeCollection: Date; // Время последнего сбора
  capturedByClanId: string | null; // Захват кланом
  capturedAt: Date | null;
  captureExpiresAt: Date | null;
}
```

### BuildingConfig Entity
```typescript
{
  id: string;
  type: string; // Тип предприятия
  name: string;
  basePrice: string; // Базовая цена
  baseIncomePerHour: string; // Базовый доход в час
  maxAccumulation: string; // Максимальное накопление
  maxLevel: number; // Максимальный уровень
  upgradeMultiplier: number; // Множитель для цены апгрейда (по умолчанию 1.4)
}
```

### DistrictConfig Entity
```typescript
{
  id: string;
  code: string; // district_1, district_2, etc.
  name: string;
  baseIncomePerDay: string; // Доход для кланов
  requiredLevel: number; // Требуемый уровень для доступа
}
```

## 🎯 Формулы

### Доход предприятия
```
incomePerHour = baseIncomePerHour * 1.2^level * captureMultiplier * passiveIncomeMultiplier

где:
- captureMultiplier = 0.5 (если захвачено кланом) или 1.0
- passiveIncomeMultiplier = 1 + 0.015 * min(econSp, 40)
```

### Накопленный доход
```
accumulatedIncome = min(
  currentAccumulated + incomePerHour * hoursPassed,
  maxAccumulation
)
```

### Цена апгрейда
```
upgradePrice = basePrice * upgradeMultiplier^currentLevel
```

## ⚠️ Замечания

1. **Связь районов с предприятиями**: 
   - Районы используются только для захвата кланами
   - Предприятия игроков не привязаны к конкретным районам
   - Если требуется привязка, нужно добавить поле `districtCode` в `Building`

2. **Кап накопления**:
   - Рекомендуется устанавливать `maxAccumulation` так, чтобы игрок мог собирать доход 1-2 раза в день
   - Например, если доход 100 NAR/час, то кап 1200-2400 NAR позволит собирать раз в 12-24 часа

3. **Бонус пассивного дохода**:
   - Максимальный бонус +60% при 40 SP в Экономике
   - Применяется ко всем предприятиям игрока
   - Учитывается при расчете накопленного дохода

## ✅ Проверено

- ✅ Формула дохода: `baseIncomePerHour * 1.2^level`
- ✅ Формула цены апгрейда: `basePrice * multiplier^level`
- ✅ Кап накопления применяется корректно
- ✅ Бонус пассивного дохода применяется
- ✅ Захват кланом уменьшает доход на 50%
- ✅ Накопление дохода работает по времени

