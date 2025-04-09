import React, { useEffect, useCallback, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Trophy } from 'lucide-react';

const GRID_SIZE = 25;
const CELL_SIZE = 20;

export const GameBoard: React.FC = () => {
  const { socket, players, food, setGameState, roomCode, setGameStarted, setRoomCode, resetGame } = useGameStore();
  const [message, setMessage] = useState<string | null>(null);
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);
  const [showEliminatedScreen, setShowEliminatedScreen] = useState(false);
  const [winner, setWinner] = useState<{ id: string; snake: { color: string }; score: number } | null>(null);
  const [isTie, setIsTie] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on('gameState', (state) => {
      const currentPlayer = players.find(p => p.id === socket.id);
      const updatedPlayer = state.players.find(p => p.id === socket.id);
      
      if (currentPlayer && !currentPlayer.eliminated && updatedPlayer?.eliminated) {
        setShowEliminatedScreen(true);
      }
      
      setGameState(state);
      setGameStarted(true);
    });

    socket.on('gameOver', ({ winner, reason }) => {
      // Only consider non-eliminated players for determining winner
      const activePlayers = players.filter(p => !p.eliminated);
      
      if (activePlayers.length === 0) {
        setMessage("Game Over! All players eliminated!");
        setShowWinnerScreen(true);
        return;
      }

      const highestScore = Math.max(...activePlayers.map(p => p.score));
      const playersWithHighestScore = activePlayers.filter(p => p.score === highestScore);
      const isTieGame = playersWithHighestScore.length > 1;

      if (isTieGame) {
        setIsTie(true);
        setWinner(null);
        setMessage(`Game Over! It's a Tie! Score: ${highestScore} points`);
      } else {
        const gameWinner = playersWithHighestScore[0];
        setIsTie(false);
        setWinner(gameWinner);
        const isWinner = gameWinner.id === socket.id;
        setMessage(
          reason === 'time' 
            ? `Game Over! ${isWinner ? 'You win with ' + gameWinner.score + ' points!' : 'Winner: Player with ' + gameWinner.score + ' points!'}`
            : isWinner ? 'You win!' : `Player ${gameWinner.snake.color} wins!`
        );
      }
      
      setShowWinnerScreen(true);
      setShowEliminatedScreen(false);
    });

    socket.on('error', (error) => {
      console.error('Game error:', error.message);
    });

    return () => {
      socket.off('gameState');
      socket.off('gameOver');
      socket.off('error');
    };
  }, [socket, setGameState, players, setGameStarted]);

  const resetGameState = useCallback(() => {
    setShowWinnerScreen(false);
    setShowEliminatedScreen(false);
    setWinner(null);
    setIsTie(false);
    setMessage(null);
    setRoomCode(null);
    resetGame();
  }, [setRoomCode, resetGame]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (showWinnerScreen || showEliminatedScreen) {
      resetGameState();
      return;
    }

    if (!socket || !roomCode) return;

    const directions: { [key: string]: string } = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    };

    const direction = directions[e.key.toLowerCase()];
    if (direction) {
      e.preventDefault();
      socket.emit('updateDirection', { roomCode, direction });
    }
  }, [socket, roomCode, showWinnerScreen, showEliminatedScreen, resetGameState]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  const currentPlayer = players.find(p => p.id === socket?.id);
  const activePlayers = players.filter(p => !p.eliminated);

  return (
    <div className="relative">
      {showEliminatedScreen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-80">
          <div className="text-center">
            <h2 className="text-6xl font-bold mb-6 text-red-500">Game Over!</h2>
            <div className="text-3xl text-white mb-8">
              <div>You've been eliminated!</div>
              <div className="text-2xl mt-4">Final Score: {currentPlayer?.score || 0} points</div>
            </div>
            <div className="animate-pulse text-gray-300">
              Press any key to return to home
            </div>
          </div>
        </div>
      )}

      {showWinnerScreen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-80">
          <div className="text-center animate-bounce-slow">
            <div className="flex justify-center mb-4">
              <Trophy className="w-24 h-24 text-yellow-400" />
            </div>
            <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-transparent bg-clip-text">
              <h2 className="text-6xl font-bold mb-4">
                {isTie ? "It's a Tie!" : (winner?.id === socket?.id ? 'Victory!' : 'Game Over!')}
              </h2>
            </div>
            <div className="text-3xl text-white mb-4">
              {isTie ? (
                <div>
                  <div>Multiple players tied for the highest score!</div>
                  <div className="text-2xl mt-2">Final Score: {activePlayers[0]?.score} points</div>
                </div>
              ) : winner?.id === socket?.id ? (
                <div>
                  <div>Congratulations! You are the winner!</div>
                  <div className="text-2xl mt-2">Final Score: {winner.score} points</div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 flex-col">
                  <div className="flex items-center gap-2">
                    Player <div className="w-6 h-6 rounded-full" style={{ backgroundColor: winner?.snake.color }}/> wins!
                  </div>
                  <div className="text-2xl">Final Score: {winner?.score} points</div>
                </div>
              )}
            </div>
            <div className="animate-pulse text-gray-300">
              Press any key to return to home
            </div>
          </div>
        </div>
      )}

      {message && !showWinnerScreen && !showEliminatedScreen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gray-900 bg-opacity-75 text-white text-4xl font-bold py-4 px-8 rounded-lg shadow-2xl">
            {message}
          </div>
        </div>
      )}

      <div className="flex gap-10">
        <div 
          className="rounded-lg p-4 shadow-2xl border-transparent"
          style={{
            width: GRID_SIZE * CELL_SIZE + 8,
            height: GRID_SIZE * CELL_SIZE + 8,
          }}
        >
          <div className="relative" style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}>
            {/* Grid */}
            <div className="absolute inset-0 grid"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
              }}
            >
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
                const row = Math.floor(i / GRID_SIZE);
                const col = i % GRID_SIZE;
                const isEdge = row === 0 || row === GRID_SIZE - 1 || col === 0 || col === GRID_SIZE - 1;
                return (
                  <div 
                    key={i} 
                    className={`grid-cell ${isEdge ? 'bg-indigo-900 bg-opacity-50' : 'bg-transparent'}`}
                    style={{
                      boxShadow: isEdge ? 'inset 0 0 2px rgba(79, 70, 229, 0.5)' : 'none',
                      border: isEdge ? '1px solid rgba(79, 70, 229, 0.3)' : 'none'
                    }}
                  />
                );
              })}
            </div>

            {/* Food */}
            {food && (
              <div
                className="absolute bg-yellow-400 rounded-full"
                style={{
                  width: CELL_SIZE - 2,
                  height: CELL_SIZE - 2,
                  left: food.x * CELL_SIZE + 1,
                  top: food.y * CELL_SIZE + 1,
                  boxShadow: '0 0 15px rgba(250, 204, 21, 0.8), 0 0 30px rgba(250, 204, 21, 0.4)'
                }}
              />
            )}

            {/* Snakes */}
            {activePlayers.map((player) => (
              player.snake.body.map((segment, i) => (
                <div
                  key={`${player.id}-${i}`}
                  className={`absolute ${i === 0 ? 'rounded-full' : 'rounded-sm'}`}
                  style={{
                    width: CELL_SIZE - 2,
                    height: CELL_SIZE - 2,
                    left: segment.x * CELL_SIZE + 1,
                    top: segment.y * CELL_SIZE + 1,
                    backgroundColor: player.snake.color,
                    boxShadow: i === 0 
                      ? `0 0 15px ${player.snake.color}99, 0 0 30px ${player.snake.color}66` 
                      : `0 0 10px ${player.snake.color}33`
                  }}
                />
              ))
            ))}
          </div>
        </div>

        {/* Right Side Panel */}
        <div className="flex flex-col gap-4" style={{ minWidth: '240px' }}>
          {/* Controls Guide */}
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-2">Controls</h2>
            <p className="text-gray-300">Use WASD to control your snake</p>
          </div>

          {/* Scoreboard */}
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700 flex-grow">
            <h2 className="text-xl font-bold mb-4">Active Players</h2>
            <div className="flex flex-col gap-4">
              {activePlayers.map((player, index) => (
                <div 
                  key={player.id} 
                  className="flex items-center gap-3"
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: player.snake.color }}
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold">
                      Player {index + 1}
                      {player.id === socket?.id && " (You)"}
                    </span>
                    <span className="text-gray-400">Score: {player.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};