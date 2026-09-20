export interface Player {
  id: string;
  displayName: string;
  lives: number;
  isHost: boolean;
  isSpectator: boolean;
  isConnected: boolean;
  joinOrder: number;
  sessionToken?: string;
  wantsPlayAgain?: boolean;
}

export interface LastPlayedInfo {
  word: string;
  playerId: string;
  displayName?: string;
}

export interface GameOverResult {
  winner?: string | null;
  wordsChained?: number;
}

export interface RoomState {
  code: string;
  players: Player[];
  status: 'lobby' | 'in-progress' | 'finished';
  currentTurnPlayerId: string | null;
  currentPrefix: string | null;
  startingLetters: string[] | null;
  turnStartedAt: number | null;
  turnDuration: number;
  hintsLeft?: number | null;
  isPractice?: boolean;
  wordsChained: number;
  usedWords: string[];
  lastPlayed: LastPlayedInfo | null;
  gameOverResult: GameOverResult | null;
}

export interface TurnStartedData {
  playerId: string;
  letters?: string[];
  prefix?: string;
  duration: number;
}

export interface LetterSelectedData {
  letter: string;
}

export interface TypingData {
  playerId: string;
  input: string;
}

export interface WordAcceptedData {
  word: string;
  playerId: string;
  displayName?: string;
}

export interface PlayAgainStatusData {
  readyCount: number;
  totalCount: number;
  readyNames: string[];
}

export interface JoinRoomResponse {
  success?: boolean;
  error?: string;
  roomCode?: string;
  roomState?: RoomState;
}

export interface SubmitWordResponse {
  success?: boolean;
  error?: string;
  word?: string;
}

export interface RequestHintResponse {
  hint?: string;
  hintsLeft?: number;
  isFullWord?: boolean;
  error?: string;
}
