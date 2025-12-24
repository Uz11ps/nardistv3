# Руководство по настройке TON интеграции для продакшена

## 1. Установка библиотек TON

```bash
cd backend
npm install @ton/core @ton/crypto @ton/ton
```

## 2. TON Center API

### Что это?
TON Center API - это публичный API для работы с блокчейном TON. Он позволяет:
- Проверять транзакции
- Получать балансы кошельков
- Отправлять транзакции

### Где взять?
**Бесплатный вариант (для разработки):**
- URL: `https://toncenter.com/api/v2`
- Не требует API ключа
- Ограничения: ~1 запрос/сек

**Платный вариант (для продакшена):**
1. Зарегистрируйтесь на https://toncenter.com
2. Получите API ключ
3. Используйте URL: `https://toncenter.com/api/v2` с заголовком `X-API-Key: YOUR_API_KEY`

**Альтернативы:**
- TON API (https://tonapi.io) - более продвинутый API
- Собственный TON node (для максимального контроля)

### Настройка в .env:
```env
# TON Center API (бесплатный для разработки)
TON_API_URL=https://toncenter.com/api/v2

# TON Center API Key (для продакшена, опционально)
TON_API_KEY=your-api-key-here
```

## 3. Encryption Key (WALLET_ENCRYPTION_KEY)

### Что это?
Ключ для шифрования приватных ключей кошельков в базе данных. Используется AES-256-CBC шифрование.

### Как сгенерировать?
**Вариант 1: Node.js**
```javascript
const crypto = require('crypto');
const key = crypto.randomBytes(32).toString('hex');
console.log(key); // Скопируйте этот ключ
```

**Вариант 2: PowerShell (Windows)**
```powershell
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

**Вариант 3: OpenSSL**
```bash
openssl rand -hex 32
```

### Важно:
- Ключ должен быть **32 байта** (64 символа в hex формате)
- **НЕ КОММИТЬТЕ** ключ в git!
- Храните ключ в безопасном месте
- Если ключ потерян - приватные ключи нельзя расшифровать!

### Настройка в .env:
```env
# Ключ шифрования приватных ключей (32 байта в hex)
WALLET_ENCRYPTION_KEY=ваш-64-символьный-hex-ключ-здесь
```

## 4. Структура для продакшена

После установки библиотек `@ton/core` и `@ton/crypto`, `TonService` будет использовать полноценную генерацию кошельков вместо упрощенной версии.

## 5. Проверка работы

1. Установите библиотеки: `npm install @ton/core @ton/crypto @ton/ton`
2. Настройте `.env` с `WALLET_ENCRYPTION_KEY` и `TON_API_URL`
3. Создайте кошелек через API: `POST /subscription/wallet`
4. Проверьте адрес кошелька в админ панели

## 6. Безопасность

- ✅ Приватные ключи хранятся в зашифрованном виде
- ✅ Расшифровка доступна только в админ панели
- ✅ Каждый пользователь имеет свой кошелек
- ⚠️ Храните `WALLET_ENCRYPTION_KEY` в секрете!
- ⚠️ Не логируйте приватные ключи!

