import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useGameStore } from './store/gameStore';
import { GameBoard } from './components/GameBoard';
import { Gamepad2, Users, Clock, Timer, User, Swords } from 'lucide-react';

function App() {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [selectedTime, setSelectedTime] = useState(0);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState(2);
  const { setSocket, setRoomCode, roomCode, gameStarted, players, timeRemaining, setMaxPlayers } = useGameStore();

  useEffect(() => {
    const socket = io('http://localhost:3000');
    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [setSocket]);

  const handleCreateGame = () => {
    if (selectedTime === 0) return;
    
    const socket = useGameStore.getState().socket;
    if (socket) {
      setMaxPlayers(selectedPlayerCount);
      socket.emit('createGame', { 
        gameTime: selectedTime,
        maxPlayers: selectedPlayerCount 
      });
      socket.on('gameCreated', ({ roomCode }) => {
        setRoomCode(roomCode);
      });
    }
  };

  const handleJoinGame = () => {
    const socket = useGameStore.getState().socket;
    if (socket && joinCode) {
      socket.emit('joinGame', { roomCode: joinCode });
      setRoomCode(joinCode);
    }
  };

  const timeOptions = [
    { value: 10, label: '10 seconds' },
    { value: 20, label: '20 seconds' },
    { value: 30, label: '30 seconds' }
  ];

  const playerCountOptions = [2, 3, 4];

  const currentPlayer = players.find(p => p.id === useGameStore.getState().socket?.id);
  const maxPlayers = useGameStore.getState().maxPlayers;
  const remainingPlayers = maxPlayers - players.length;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Gamepad2 className="w-10 h-10" />
            Snake Battle
            <Swords className="w-10 h-10" />
          </h1>
          <p className="text-gray-400 mb-8">Challenge your friends in this multiplayer snake adventure!</p>
        </div>

        {!roomCode ? (
          <div className="max-w-md mx-auto">
            <div className="flex flex-col gap-4">
              <div className="bg-gray-800 p-6 rounded-lg mb-4">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6" />
                  Game Settings
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Game Duration</label>
                    <div className="grid grid-cols-3 gap-3">
                      {timeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setSelectedTime(option.value)}
                          className={`p-3 rounded-lg transition-colors ${
                            selectedTime === option.value
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Number of Players</label>
                    <div className="grid grid-cols-3 gap-3">
                      {playerCountOptions.map((count) => (
                        <button
                          key={count}
                          onClick={() => setSelectedPlayerCount(count)}
                          className={`p-3 rounded-lg transition-colors ${
                            selectedPlayerCount === count
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {count} Players
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateGame}
                disabled={selectedTime === 0}
                className={`bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  selectedTime === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Users />
                Create New Game
              </button>
              
              {!showJoinInput ? (
                <button
                  onClick={() => setShowJoinInput(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Join Existing Game
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="bg-gray-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={6}
                  />
                  <button
                    onClick={handleJoinGame}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                  >
                    Join Game
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-800 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Room Code:</span>
                    <span className="font-mono font-bold">{roomCode}</span>
                  </div>
                  
                  {currentPlayer && (
                    <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                      <User className="w-5 h-5 text-gray-400" />
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border-2 border-white"
                          style={{ backgroundColor: currentPlayer.snake.color }}
                        />
                        <span>Player {players.findIndex(p => p.id === currentPlayer.id) + 1}</span>
                      </div>
                    </div>
                  )}

                  {timeRemaining !== null && (
                    <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                      <Timer className="w-5 h-5 text-yellow-400" />
                      <span className="font-bold">{timeRemaining}s</span>
                    </div>
                  )}
                </div>
                
                {!gameStarted && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="w-5 h-5" />
                    <span>
                      Waiting for {remainingPlayers-1} more player{remainingPlayers !== 1 ? 's' : ''} to join...
                    </span>
                  </div>
                )}
              </div>
            </div>
            <GameBoard />
            
          </div>
          
        )}
        <footer className="mt-8 text-center text-gray-500">Made with ❤️ by Sahil Vrutika Sarthak</footer>
      </div>
    </div>
  );
}

export default App;