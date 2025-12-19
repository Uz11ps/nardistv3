#!/bin/bash

echo "🔧 Исправление ошибок TypeScript в backend..."

cd /var/www/nardiphp/backend/src

# Исправляем bot.service.ts - добавляем метод для длинных нард
cat > bot.service.tmp << 'BOTEOF'
  private selectSimpleMove(gameState: any, dice: number[]): Array<{ from: number; to: number; die: number }> {
    const moves: Array<{ from: number; to: number; die: number }> = [];
    for (const die of dice) {
      for (let i = 0; i < 24; i++) {
        if (gameState.points[i] !== 0) {
          const to = gameState.currentPlayer === 0 ? i - die : i + die;
          if (to >= 0 && to < 24) {
            moves.push({ from: i, to, die });
            break;
          }
        }
      }
    }
    return moves;
  }
BOTEOF

# Исправляем типы в building.entity.ts
sed -i "s/incomePerHour: number;/incomePerHour: string;/" city/building.entity.ts
sed -i "s/accumulatedIncome: number;/accumulatedIncome: string;/" city/building.entity.ts

# Исправляем city.service.ts
sed -i 's/building\.accumulatedIncome = BigInt(Number(building\.accumulatedIncome) + income);/building.accumulatedIncome = (BigInt(building.accumulatedIncome || 0) + BigInt(income)).toString();/' city/city.service.ts
sed -i 's/user\.narCoin = BigInt(Number(user\.narCoin) + income);/user.narCoin = BigInt(user.narCoin || 0) + BigInt(income);/' city/city.service.ts
sed -i 's/user\.narCoin = BigInt(Number(user\.narCoin) - upgradeCost);/user.narCoin = BigInt(user.narCoin || 0) - BigInt(upgradeCost);/' city/city.service.ts
sed -i 's/building\.incomePerHour = BigInt(Number(building\.incomePerHour) \* 1\.2);/building.incomePerHour = (BigInt(building.incomePerHour || 0) * BigInt(120) \/ BigInt(100)).toString();/' city/city.service.ts

# Исправляем progress.service.ts
sed -i 's/user\.narCoin = BigInt(Number(user\.narCoin) + amount);/user.narCoin = BigInt(user.narCoin || 0) + BigInt(amount);/' progress/progress.service.ts

echo "✅ Ошибки исправлены"
echo "Пересобираем backend..."
cd /var/www/nardiphp
docker-compose build --no-cache backend
docker-compose up -d backend

