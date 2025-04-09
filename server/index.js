import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const games = new Map();
const GRID_SIZE = 25;
const GAME_SPEED = 100;

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const createInitialSnake = (playerIndex) => {
  const positions = [
    { x: 2, y: 2 },
    { x: 12, y: 12 },
    { x: 2, y: 22 },
    { x: 22, y: 22 }
  ];
  
  const position = positions[playerIndex];
  return {
    body: [
      { ...position },
      { x: position.x - 1, y: position.y },
      { x: position.x - 2, y: position.y }
    ],
    direction: 'right',
    color: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'][playerIndex],
    lastUpdate: Date.now()
  };
};

const generateFood = () => {
  return {
    x: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1,
    y: Math.floor(Math.random() * (GRID_SIZE - 2)) + 1
  };
};

const getNextPosition = (currentPos, direction) => {
  const nextPos = { ...currentPos };
  
  switch (direction) {
    case 'up':
      nextPos.y = (nextPos.y - 1 + GRID_SIZE) % GRID_SIZE;
      break;
    case 'down':
      nextPos.y = (nextPos.y + 1) % GRID_SIZE;
      break;
    case 'left':
      nextPos.x = (nextPos.x - 1 + GRID_SIZE) % GRID_SIZE;
      break;
    case 'right':
      nextPos.x = (nextPos.x + 1) % GRID_SIZE;
      break;
  }
  
  return nextPos;
};

const calculateDistance = (pos1, pos2) => {
  // Manhattan distance
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
};

const moveSnake = (snake) => {
  const now = Date.now();
  if (now - snake.lastUpdate < GAME_SPEED) {
    return null;
  }
  
  const newHead = getNextPosition(snake.body[0], snake.direction);
  snake.body.unshift(newHead);
  snake.body.pop();
  snake.lastUpdate = now;
  return newHead;
};

const checkCollision = (pos, snakeBody) => {
  return snakeBody.some((segment, index) => {
    if (index === 0) return false;
    return segment.x === pos.x && segment.y === pos.y;
  });
};

const checkCollisionWithOtherSnakes = (pos, players, currentPlayerId) => {
  for (const player of players) {
    if (player.id === currentPlayerId || player.eliminated) continue;
    if (player.snake.body.some(segment => segment.x === pos.x && segment.y === pos.y)) {
      return true;
    }
  }
  return false;
};

const handleFoodCollision = (game, playersAtFood) => {
  if (playersAtFood.length === 0) return;

  // Sort players using multiple tiebreakers
  playersAtFood.sort((a, b) => {
    // First tiebreaker: Manhattan distance
    const distA = calculateDistance(a.snake.body[0], game.food);
    const distB = calculateDistance(b.snake.body[0], game.food);
    if (distA !== distB) return distA - distB;

    // Second tiebreaker: Snake length
    const lengthA = a.snake.body.length;
    const lengthB = b.snake.body.length;
    if (lengthA !== lengthB) return lengthB - lengthA; // Longer snake gets priority

    // Third tiebreaker: Current score
    if (a.score !== b.score) return b.score - a.score; // Higher score gets priority

    // Final tiebreaker: Random selection
    return Math.random() - 0.5;
  });

  // Give food to the winning player
  const winner = playersAtFood[0];
  winner.snake.body.push({ ...winner.snake.body[winner.snake.body.length - 1] });
  winner.score += 10;

  // Generate new food
  game.food = generateFood();
};

const updateGameState = (game) => {
  if (!game.active) return game;

  const playersAtFood = [];

  for (const player of game.players) {
    if (player.eliminated) continue;

    const newHead = moveSnake(player.snake);
    if (!newHead) continue;
    
    // Check if snake ate food
    if (newHead.x === game.food.x && newHead.y === game.food.y) {
      playersAtFood.push(player);
    }
    
    // Check for collisions with walls
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      player.score = Math.max(0, player.score - 5);
      if (player.score === 0) {
        player.eliminated = true;
      } else {
        player.snake = createInitialSnake(game.players.indexOf(player));
      }
      continue;
    }
    
    // Check for collisions with self or other snakes
    if (checkCollision(newHead, player.snake.body) || 
        checkCollisionWithOtherSnakes(newHead, game.players, player.id)) {
      player.score = Math.max(0, player.score - 5);
      if (player.score === 0) {
        player.eliminated = true;
      } else {
        player.snake = createInitialSnake(game.players.indexOf(player));
      }
    }
  }

  // Handle food collision after all snakes have moved
  if (playersAtFood.length > 0) {
    handleFoodCollision(game, playersAtFood);
  }
  
  return game;
};

const startGameLoop = (roomCode) => {
  const game = games.get(roomCode);
  if (!game || game.interval) return;

  game.startTime = Date.now();
  game.active = true;

  game.interval = setInterval(() => {
    const currentGame = games.get(roomCode);
    if (!currentGame || !currentGame.active) {
      clearInterval(game.interval);
      return;
    }

    const timeElapsed = Math.floor((Date.now() - currentGame.startTime) / 1000);
    const timeRemaining = currentGame.gameTime - timeElapsed;

    if (timeRemaining <= 0) {
      // Game over - find winner by highest score
      const winner = currentGame.players.reduce((highest, player) => 
        !highest || player.score > highest.score ? player : highest
      , null);

      clearInterval(currentGame.interval);
      currentGame.active = false;
      io.to(roomCode).emit('gameOver', { winner, reason: 'time' });
      return;
    }

    updateGameState(currentGame);
    io.to(roomCode).emit('gameState', {
      players: currentGame.players,
      food: currentGame.food,
      timeRemaining
    });
  }, GAME_SPEED / 3);
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createGame', ({ gameTime, maxPlayers }) => {
    const roomCode = generateRoomCode();
    const game = {
      players: [{
        id: socket.id,
        snake: createInitialSnake(0),
        score: 0,
        eliminated: false
      }],
      food: generateFood(),
      active: false,
      gameTime,
      maxPlayers,
      startTime: null
    };
    
    games.set(roomCode, game);
    socket.join(roomCode);
    socket.emit('gameCreated', { roomCode });

    // Start the game when enough players have joined
    if (game.players.length >= maxPlayers) {
      startGameLoop(roomCode);
    }
  });

  socket.on('joinGame', ({ roomCode }) => {
    const game = games.get(roomCode);
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (game.players.length >= game.maxPlayers) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }

    const newPlayer = {
      id: socket.id,
      snake: createInitialSnake(game.players.length),
      score: 0,
      eliminated: false
    };
    
    game.players.push(newPlayer);
    socket.join(roomCode);

    // Start the game when enough players have joined
    if (game.players.length >= game.maxPlayers && !game.active) {
      startGameLoop(roomCode);
    }

    io.to(roomCode).emit('gameState', {
      players: game.players,
      food: game.food,
      timeRemaining: game.gameTime
    });
  });

  socket.on('updateDirection', ({ roomCode, direction }) => {
    const game = games.get(roomCode);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    const oppositeDirections = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
    };

    if (oppositeDirections[direction] !== player.snake.direction) {
      player.snake.direction = direction;
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    games.forEach((game, roomCode) => {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        game.players[playerIndex].eliminated = true;
        
        // Check if only one player remains
        const activePlayers = game.players.filter(p => !p.eliminated);
        if (activePlayers.length === 1) {
          clearInterval(game.interval);
          game.active = false;
          io.to(roomCode).emit('gameOver', { winner: activePlayers[0], reason: 'lastPlayer' });
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});