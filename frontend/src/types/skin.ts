export interface Skin {
  id: string
  name: string
  description?: string
  theme: string
  imageUrl?: string
  price?: number
  rarity: string
  weight: number
  isPremium: boolean
  isDefault: boolean
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
}

