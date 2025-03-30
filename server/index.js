// Update the server index.js to use the game logic
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { generatePuzzleBoard, validateQueenPlacement } = require('./gameLogic');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game rooms storage
const gameRooms = {};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create a new game room
  socket.on('createGame', ({ playerName }) => {
    // Generate a unique room ID
    const roomId = generateRoomId();
    
    // Create the game room
    gameRooms[roomId] = {
      id: roomId,
      players: [{
        id: socket.id,
        name: playerName,
        ready: false,
        queens: [],
        marks: []
      }],
      gameStarted: false,
      board: null
    };
    
    // Join the room
    socket.join(roomId);
    
    // Send room info back to creator
    socket.emit('gameCreated', {
      roomId,
      playerId: socket.id,
      playerName
    });
    
    console.log(`Game room created: ${roomId} by ${playerName}`);
  });

  // Join an existing game room
  socket.on('joinGame', ({ roomId, playerName }) => {
    const room = gameRooms[roomId];
    
    // Check if room exists
    if (!room) {
      socket.emit('error', { message: 'Game room not found' });
      return;
    }
    
    // Check if room is full
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Game room is full' });
      return;
    }
    
    // Add player to room
    room.players.push({
      id: socket.id,
      name: playerName,
      ready: false,
      queens: [],
      marks: []
    });
    
    // Join the room
    socket.join(roomId);
    
    // Send room info back to joiner
    socket.emit('gameJoined', {
      roomId,
      playerId: socket.id,
      playerName,
      opponent: room.players[0]
    });
    
    // Notify the room creator
    socket.to(roomId).emit('playerJoined', {
      playerId: socket.id,
      playerName
    });
    
    console.log(`Player ${playerName} joined room: ${roomId}`);
  });

  // Player ready state change
  socket.on('playerReady', ({ roomId, ready }) => {
    const room = gameRooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: 'Game room not found' });
      return;
    }
    
    // Find player and update ready state
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.ready = ready;
      
      // Broadcast ready state to all players in room
      io.to(roomId).emit('playerReadyChanged', {
        playerId: socket.id,
        ready
      });
      
      // Check if all players are ready to start the game
      const allReady = room.players.length === 2 && room.players.every(p => p.ready);
      if (allReady && !room.gameStarted) {
        // Generate a puzzle board
        const board = generatePuzzleBoard();
        room.board = board;
        room.gameStarted = true;
        
        // Start countdown and then start game
        io.to(roomId).emit('gameCountdown');
        
        // After countdown, send the board to all players
        setTimeout(() => {
          io.to(roomId).emit('gameStart', { board });
        }, 3000); // 3 seconds countdown
      }
    }
  });

  // Player places a queen
  socket.on('placeQueen', ({ roomId, row, col }) => {
    const room = gameRooms[roomId];
    
    if (!room || !room.gameStarted) {
      socket.emit('error', { message: 'Game not started' });
      return;
    }
    
    // Find player
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    
    // Validate queen placement
    const validation = validateQueenPlacement(room.board, row, col, player.queens);
    
    if (!validation.valid) {
      socket.emit('invalidMove', { message: validation.message });
      return;
    }
    
    // Add queen to player's queens
    player.queens.push({ row, col });
    
    // Notify all players in room
    io.to(roomId).emit('queenPlaced', {
      playerId: socket.id,
      row,
      col
    });
    
    // Check if player has placed all 8 queens
    if (player.queens.length === 8) {
      // Player has won
      io.to(roomId).emit('gameWon', {
        playerId: socket.id,
        playerName: player.name
      });
      
      // Reset game state
      room.gameStarted = false;
      room.players.forEach(p => {
        p.ready = false;
        p.queens = [];
        p.marks = [];
      });
    }
  });

  // Player marks a cell with X
  socket.on('markCell', ({ roomId, row, col }) => {
    const room = gameRooms[roomId];
    
    if (!room || !room.gameStarted) {
      socket.emit('error', { message: 'Game not started' });
      return;
    }
    
    // Find player
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    
    // Check if cell already has a queen
    if (player.queens.some(q => q.row === row && q.col === col)) {
      socket.emit('invalidMove', { message: 'Cell already has a queen' });
      return;
    }
    
    // Check if cell already marked
    if (player.marks.some(m => m.row === row && m.col === col)) {
      // Remove mark (toggle)
      player.marks = player.marks.filter(m => !(m.row === row && m.col === col));
      
      // Notify all players in room
      io.to(roomId).emit('cellUnmarked', {
        playerId: socket.id,
        row,
        col
      });
    } else {
      // Add mark
      player.marks.push({ row, col });
      
      // Notify all players in room
      io.to(roomId).emit('cellMarked', {
        playerId: socket.id,
        row,
        col
      });
    }
  });

  // Player requests to restart the game
  socket.on('restartGame', ({ roomId }) => {
    const room = gameRooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: 'Game room not found' });
      return;
    }
    
    // Reset game state
    room.gameStarted = false;
    room.board = null;
    room.players.forEach(p => {
      p.ready = false;
      p.queens = [];
      p.marks = [];
    });
    
    // Notify all players in room
    io.to(roomId).emit('gameRestarted');
  });

  // Player requests a new puzzle
  socket.on('newPuzzle', ({ roomId }) => {
    const room = gameRooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: 'Game room not found' });
      return;
    }
    
    // Reset game state
    room.gameStarted = false;
    room.board = null;
    room.players.forEach(p => {
      p.ready = false;
      p.queens = [];
      p.marks = [];
    });
    
    // Notify all players in room
    io.to(roomId).emit('newPuzzleRequested');
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Find all rooms the player is in
    Object.keys(gameRooms).forEach(roomId => {
      const room = gameRooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        // Remove player from room
        const playerName = room.players[playerIndex].name;
        room.players.splice(playerIndex, 1);
        
        // Notify other players
        io.to(roomId).emit('playerDisconnected', {
          playerId: socket.id,
          playerName
        });
        
        // If room is empty, remove it
        if (room.players.length === 0) {
          delete gameRooms[roomId];
          console.log(`Room ${roomId} removed as it's empty`);
        }
      }
    });
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Helper function to generate a unique room ID
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
