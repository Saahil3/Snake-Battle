import { create } from 'zustand';
import { Socket } from 'socket.io-client';

interface GameState {
  socket: Socket | null;
  roomCode: string | null;
  players: Player[];
  food: Position;
  gameTimer: number;
  gameStarted: boolean;
  timeRemaining: number | null;
  maxPlayers: number;
  setSocket: (socket: Socket) => void;
  setRoomCode: (code: string | null) => void;
  setGameState: (state: { players: Player[]; food: Position; timeRemaining: number }) => void;
  setGameTimer: (timer: number) => void;
  setGameStarted: (started: boolean) => void;
  setMaxPlayers: (count: number) => void;
  resetGame: () => void;
}

interface Position {
  x: number;
  y: number;
}

interface Snake {
  body: Position[];
  direction: string;
  color: string;
}

interface Player {
  id: string;
  snake: Snake;
  score: number;
  eliminated: boolean;
}

const initialState = {
  socket: null,
  roomCode: null,
  players: [],
  food: { x: 10, y: 10 },
  gameTimer: 0,
  gameStarted: false,
  timeRemaining: null,
  maxPlayers: 2,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setSocket: (socket) => set({ socket }),
  setRoomCode: (code) => set({ roomCode: code }),
  setGameState: (state) => set({ 
    players: state.players, 
    food: state.food,
    timeRemaining: state.timeRemaining 
  }),
  setGameTimer: (timer) => set({ gameTimer: timer }),
  setGameStarted: (started) => set({ gameStarted: started }),
  setMaxPlayers: (count) => set({ maxPlayers: count }),
  resetGame: () => set({ ...initialState, socket: useGameStore.getState().socket }),
}));