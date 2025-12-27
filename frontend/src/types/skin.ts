export interface Skin {
  id: string
  name: string
  description?: string
  type: string // 'board' | 'dice' | 'checkers'
  theme: string
  imageUrl?: string // Превью для инвентаря и общего отображения
  shopImageUrl?: string // Отдельное изображение для магазина
  boardTextureUrl?: string // URL файла текстуры доски (для типа 'board')
  diceTextureUrl?: string // URL файла текстуры кубиков (для типа 'dice')
  checkersTextureUrl?: string // URL файла текстуры шашек (для типа 'checkers') - устаревшее
  whiteCheckersTextureUrl?: string // URL файла текстуры белых шашек (для типа 'checkers')
  blackCheckersTextureUrl?: string // URL файла текстуры черных шашек (для типа 'checkers')
  price?: number
  rarity: string
  weight: number
  isPremium: boolean
  isDefault: boolean
  maxDurability?: number
  xpBonusPercent?: number
  moneyBonusPercent?: number
  boardConfig?: {
    color?: string
    pattern?: string
    [key: string]: any
  }
  diceConfig?: {
    color?: string
    dotColor?: string
    [key: string]: any
  }
  checkersConfig?: {
    color?: string
    style?: string
    [key: string]: any
  }
}

