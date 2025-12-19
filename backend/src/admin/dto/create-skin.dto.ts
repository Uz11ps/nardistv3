export class CreateSkinDto {
  name: string;
  description?: string;
  theme: string;
  boardConfig: any;
  diceConfig: any;
  isDefault?: boolean;
  isPremium?: boolean;
  weight?: number;
  imageUrl?: string;
  price?: number;
  rarity?: string;
}

