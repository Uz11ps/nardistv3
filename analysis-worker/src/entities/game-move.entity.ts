// Копия из backend/src/games/game-move.entity.ts для воркера
export interface GameMove {
  id: string;
  gameId: string;
  playerId: string | null;
  moveNumber: number;
  dice: number[];
  moves: any[];
  gameStateBefore: any;
  gameStateAfter: any;
  moveTimeMs: number | null;
  createdAt: Date;
}

