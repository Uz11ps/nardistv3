# Реализация оплаты подписки через TON/USDT

## ✅ Реализовано

### 1. Структура данных

#### UserWallet Entity
- Хранит адрес кошелька TON для каждого пользователя
- Приватный ключ хранится в зашифрованном виде (AES-256-CBC)
- IV (Initialization Vector) хранится отдельно для расшифровки
- Публичный ключ для проверки подписей
- Тип кошелька (v4R2)

**Файл:** `backend/src/payment/user-wallet.entity.ts`

#### PaymentTransaction Entity
- Отслеживает все платежи пользователей
- Статусы: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
- Методы оплаты: TON, USDT, TELEGRAM_STARS (позже)
- Типы платежей: SUBSCRIPTION, NAR_COIN, SKIN
- Хранит хеш транзакции, LT, адреса отправителя/получателя
- Комментарий для идентификации платежа

**Файл:** `backend/src/payment/payment-transaction.entity.ts`

### 2. Сервисы

#### TonService
- Генерация новых кошельков TON
- Шифрование/расшифровка приватных ключей
- Проверка транзакций в блокчейне через TON Center API
- Получение баланса кошелька
- Генерация и парсинг комментариев для идентификации платежей

**Файл:** `backend/src/payment/ton.service.ts`

**Примечание:** В текущей реализации используется упрощенная генерация кошельков. Для продакшена нужно интегрировать библиотеки `@ton/core` и `@ton/crypto` для полноценной работы с TON блокчейном.

#### WalletService
- Создание кошелька для пользователя (автоматически при первом запросе)
- Получение кошелька пользователя
- Расшифровка приватного ключа (только для админа)
- Получение баланса кошелька
- Получение всех кошельков (для админ панели)

**Файл:** `backend/src/payment/wallet.service.ts`

#### PaymentTransactionService
- Создание транзакции для оплаты подписки
- Проверка статуса транзакции в блокчейне
- Обработка завершенных транзакций (активация подписки, начисление NAR-coin)
- Обновление хеша транзакции (когда пользователь отправил платеж)
- Получение транзакций пользователя

**Файл:** `backend/src/payment/payment-transaction.service.ts`

### 3. API Endpoints

#### SubscriptionController

**POST /subscription/payment/create**
- Создает транзакцию для оплаты подписки
- Возвращает адрес кошелька, сумму, комментарий для платежа
- Параметры: `{ plan: SubscriptionPlan, method?: PaymentMethod }`

**POST /subscription/payment/:transactionId/confirm**
- Подтверждает платеж (когда пользователь отправил транзакцию)
- Параметры: `{ txHash: string }`

**GET /subscription/payment/:transactionId/status**
- Проверяет статус платежа в блокчейне

**GET /subscription/wallet**
- Получает адрес кошелька пользователя и баланс

**Файл:** `backend/src/subscription/subscription.controller.ts`

#### AdminController

**GET /admin/wallets**
- Получить все кошельки пользователей

**GET /admin/wallets/:walletId/private-key**
- Получить расшифрованный приватный ключ кошелька (только для админа)

**GET /admin/users/:userId/transactions**
- Получить транзакции пользователя

**GET /admin/transactions**
- Получить все транзакции (с лимитом)

**POST /admin/transactions/:transactionId/check**
- Проверить статус транзакции в блокчейне

**Файл:** `backend/src/admin/admin.controller.ts`

### 4. Цены подписок

- **MONTH_1**: 3 TON
- **MONTH_3**: 7 TON
- **MONTH_12**: 22 TON

### 5. Процесс оплаты

1. Пользователь выбирает план подписки
2. Система создает транзакцию (`PaymentTransaction`) со статусом `PENDING`
3. Система возвращает пользователю:
   - Адрес кошелька для оплаты
   - Сумму в TON
   - Комментарий для идентификации платежа
4. Пользователь отправляет TON на указанный адрес с комментарием
5. Пользователь подтверждает платеж через API (`/subscription/payment/:transactionId/confirm`) с хешем транзакции
6. Система периодически проверяет транзакцию в блокчейне
7. Когда транзакция подтверждена:
   - Статус меняется на `COMPLETED`
   - Создается подписка для пользователя
   - Начисляется реферальный бонус (если есть реферер)

### 6. Безопасность

- Приватные ключи хранятся в зашифрованном виде (AES-256-CBC)
- Ключ шифрования задается через переменную окружения `WALLET_ENCRYPTION_KEY`
- Расшифровка приватных ключей доступна только в админ панели
- Каждый пользователь имеет свой отдельный кошелек

### 7. Переменные окружения

Добавьте в `.env`:

```env
# TON API
TON_API_URL=https://toncenter.com/api/v2

# Шифрование приватных ключей (32 байта в hex формате)
WALLET_ENCRYPTION_KEY=your-32-byte-hex-key-here
```

### 8. Миграции

Необходимо создать миграцию для таблиц:
- `user_wallets`
- `payment_transactions`

Также обновить таблицу `subscriptions` для добавления поля `paymentTransactionId`.

### 9. TODO для продакшена

1. **Интеграция с @ton/core и @ton/crypto**
   - Заменить упрощенную генерацию кошельков на полноценную
   - Использовать `WalletContractV4` для создания кошельков
   - Использовать `mnemonicToWalletKey` для генерации ключей из мнемоники

2. **Периодическая проверка транзакций**
   - Создать cron job для проверки ожидающих транзакций
   - Использовать `PaymentTransactionService.getPendingTransactions()`

3. **Webhook для уведомлений о транзакциях**
   - Настроить webhook от TON Center для получения уведомлений о новых транзакциях

4. **Поддержка USDT**
   - Добавить проверку USDT транзакций через TON Center API

5. **Telegram Stars/Tribute**
   - Реализовать интеграцию с Telegram Stars (позже)

### 10. Пример использования

```typescript
// Создание транзакции для подписки
POST /subscription/payment/create
{
  "plan": "month_3",
  "method": "ton"
}

// Ответ:
{
  "transactionId": "uuid",
  "walletAddress": "EQ...",
  "amount": 7,
  "comment": "userId:transactionId",
  "method": "ton",
  "status": "pending",
  "instructions": {
    "ton": "Отправьте 7 TON на адрес EQ... с комментарием: userId:transactionId"
  }
}

// Подтверждение платежа
POST /subscription/payment/{transactionId}/confirm
{
  "txHash": "transaction_hash_from_blockchain"
}

// Проверка статуса
GET /subscription/payment/{transactionId}/status
```

## Структура файлов

```
backend/src/payment/
├── user-wallet.entity.ts          # Entity для кошельков
├── payment-transaction.entity.ts  # Entity для транзакций
├── ton.service.ts                 # Сервис для работы с TON
├── wallet.service.ts              # Сервис для управления кошельками
├── payment-transaction.service.ts # Сервис для управления транзакциями
├── payment.service.ts             # Старый сервис (можно удалить или обновить)
├── payment.controller.ts          # Контроллер платежей
└── payment.module.ts              # Модуль платежей

backend/src/subscription/
├── subscription.entity.ts         # Обновлен (добавлено paymentTransactionId)
├── subscription.service.ts        # Обновлен (поддержка paymentTransactionId)
├── subscription.controller.ts     # Обновлен (добавлены методы оплаты)
└── subscription.module.ts         # Обновлен (импорт PaymentModule)

backend/src/admin/
├── admin.service.ts               # Добавлены методы для работы с кошельками
└── admin.controller.ts            # Добавлены endpoints для админ панели
```

