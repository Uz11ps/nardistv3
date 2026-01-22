// Копия из backend/src/games/game.entity.ts для воркера
export enum GameMode {
  SHORT = 'short',
  LONG = 'long',
}

export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

export interface Game {
  id: string;
  mode: GameMode;
  status: GameStatus;
  player1Id: string;
  player2Id: string | null;
  winnerId: string | null;
  createdAt: Date;
}

