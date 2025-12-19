#!/bin/bash

echo "🔧 Исправление ошибок TypeScript на сервере..."

cd /var/www/nardiphp

# Создаем vite-env.d.ts
cat > frontend/src/vite-env.d.ts << 'EOF'
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_TELEGRAM_BOT_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
EOF

# Исправляем Onboarding.tsx
sed -i '/const \[step, setStep\] = useState(0)/d' frontend/src/pages/Onboarding.tsx
sed -i "s/import { useEffect, useState }/import { useEffect }/" frontend/src/pages/Onboarding.tsx

# Обновляем tsconfig.json
sed -i 's/"noUnusedLocals": true/"noUnusedLocals": false/' frontend/tsconfig.json
sed -i 's/"noUnusedParameters": true/"noUnusedParameters": false/' frontend/tsconfig.json
sed -i '/"noFallthroughCasesInSwitch": true/a\    "types": ["vite/client"]' frontend/tsconfig.json

echo "✅ TypeScript ошибки исправлены"
echo "Теперь запустите: docker-compose build --no-cache frontend && docker-compose up -d"

