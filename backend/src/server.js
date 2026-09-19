const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const {
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  STARTING_LIVES,
  TURN_TIMER_SECONDS,
  ROOM_CODE_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_HINTS_PER_PRACTICE_SESSION
} = require('./constants');

const engine = require('./engine');
engine.loadDictionary();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// State: Map<roomCode, Room>
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude 0,O,1,I
  let code;
  do {
    code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function getSerializedRoomState(room) {
  return {
    code: room.code,
    players: room.players.map(p => ({
      id: p.id,
      displayName: p.displayName,
      lives: p.lives,
      isHost: p.isHost,
      isSpectator: p.isSpectator,
      isConnected: p.isConnected,
      joinOrder: p.joinOrder
    })),
    status: room.status,
    currentTurnPlayerId: room.currentTurnPlayerId,
    currentPrefix: room.currentPrefix,
    startingLetters: room.startingLetters || null,
    turnStartedAt: room.turnStartedAt,
    turnDuration: TURN_TIMER_SECONDS,
    hintsLeft: room.hintsLeft ?? null,
    isPractice: !!room.isPractice,
    wordsChained: room.usedWords ? room.usedWords.size : 0,
    usedWords: room.usedWords ? Array.from(room.usedWords) : [],
    lastPlayed: room.lastPlayed || null,
    gameOverResult: room.gameOverResult || null
  };
}

function emitRoomState(room) {
  io.to(room.code).emit('room-state', getSerializedRoomState(room));
}

function startTurn(room, playerId, fallbackLetters = null) {
  if (room.turnTimeoutHandle) clearTimeout(room.turnTimeoutHandle);
  
  room.currentTurnPlayerId = playerId;
  room.turnStartedAt = Date.now();
  room.hintsUsedOnCurrentWord = 0;
  room.currentHintWord = null;
  room.hintRevealedLength = 0;
  
  if (fallbackLetters) {
    room.currentPrefix = null;
    room.startingLetters = fallbackLetters;
    io.to(room.code).emit('turn-started', {
      playerId,
      letters: fallbackLetters,
      duration: TURN_TIMER_SECONDS
    });
  } else {
    room.startingLetters = null;
    io.to(room.code).emit('turn-started', {
      playerId,
      prefix: room.currentPrefix,
      duration: TURN_TIMER_SECONDS
    });
  }
  
  // Set timeout
  room.turnTimeoutHandle = setTimeout(() => {
    handleTimeout(room, playerId);
  }, TURN_TIMER_SECONDS * 1000);
  
  emitRoomState(room);
}

function handleTimeout(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.isSpectator) return;
  
  if (room.isPractice) {
    player.lives -= 1;
    if (player.lives <= 0) {
      endPractice(room);
    } else {
      const letters = engine.getStartingLetters(room.usedWords);
      startTurn(room, playerId, letters);
    }
    return;
  }
  
  // Multiplayer timeout
  player.lives -= 1;
  if (player.lives <= 0) {
    player.isSpectator = true;
    checkWinCondition(room);
  }
  
  if (room.status === 'in-progress') {
    advanceTurnWithFallback(room);
  }
}

function advanceTurnWithFallback(room) {
  const nextPlayerId = getNextPlayerId(room);
  if (nextPlayerId) {
    const letters = engine.getStartingLetters(room.usedWords);
    startTurn(room, nextPlayerId, letters);
  }
}

function getNextPlayerId(room) {
  const activePlayers = room.players.filter(p => !p.isSpectator).sort((a, b) => a.joinOrder - b.joinOrder);
  if (activePlayers.length === 0) return null;
  
  if (!room.currentTurnPlayerId) return activePlayers[0].id;
  
  const currentIndex = activePlayers.findIndex(p => p.id === room.currentTurnPlayerId);
  if (currentIndex === -1) return activePlayers[0].id;
  
  return activePlayers[(currentIndex + 1) % activePlayers.length].id;
}

function checkWinCondition(room) {
  const activePlayers = room.players.filter(p => !p.isSpectator);
  if (activePlayers.length === 1) {
    room.status = 'finished';
    room.gameOverResult = { winner: activePlayers[0].displayName };
    if (room.turnTimeoutHandle) clearTimeout(room.turnTimeoutHandle);
    io.to(room.code).emit('game-over', room.gameOverResult);
    emitRoomState(room);
  } else if (activePlayers.length === 0) {
    room.status = 'finished';
    room.gameOverResult = { winner: null };
    if (room.turnTimeoutHandle) clearTimeout(room.turnTimeoutHandle);
    io.to(room.code).emit('game-over', room.gameOverResult);
    emitRoomState(room);
  }
}

function endPractice(room) {
  room.status = 'finished';
  room.gameOverResult = { wordsChained: room.usedWords.size };
  if (room.turnTimeoutHandle) clearTimeout(room.turnTimeoutHandle);
  io.to(room.code).emit('game-over', room.gameOverResult);
  emitRoomState(room);
}

io.on('connection', (socket) => {
  socket.on('join-room', (data, callback) => {
    let { roomCode, displayName, sessionToken } = data;
    
    displayName = (displayName || 'Player').trim().substring(0, MAX_DISPLAY_NAME_LENGTH);
    if (!displayName) {
      return callback({ error: 'Display name is required' });
    }
    
    if (roomCode) {
      roomCode = roomCode.toUpperCase();
    } else {
      // Create new room
      roomCode = generateRoomCode();
      rooms.set(roomCode, {
        code: roomCode,
        players: [],
        status: 'lobby',
        currentTurnPlayerId: null,
        currentPrefix: null,
        startingLetters: null,
        usedWords: new Set(),
        turnStartedAt: null,
        turnTimeoutHandle: null,
        gameStartedAt: null,
        createdAt: Date.now()
      });
    }

    const room = rooms.get(roomCode);
    if (!room) {
      return callback({ error: 'Room not found' });
    }
    
    // Check for reconnect
    const existingPlayerIndex = room.players.findIndex(p => p.sessionToken === sessionToken);
    
    if (existingPlayerIndex !== -1) {
      const p = room.players[existingPlayerIndex];
      const oldId = p.id;
      p.id = socket.id;
      p.isConnected = true;
      p.displayName = displayName;
      
      // If player was on turn, update currentTurnPlayerId to the new socket id
      if (room.currentTurnPlayerId === oldId) {
        room.currentTurnPlayerId = socket.id;
      }

      socket.join(roomCode);
      emitRoomState(room);
      return callback({ success: true, roomCode, roomState: getSerializedRoomState(room) });
    }

    // New join
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      return callback({ error: 'This game is full (5/5 players)' });
    }
    
    if (room.status !== 'lobby') {
      return callback({ error: 'This game has already started' });
    }
    
    const isHost = room.players.length === 0;
    room.players.push({
      id: socket.id,
      sessionToken,
      displayName,
      lives: STARTING_LIVES,
      isHost,
      isSpectator: false,
      isConnected: true,
      joinOrder: room.players.length
    });
    
    socket.join(roomCode);
    emitRoomState(room);
    callback({ success: true, roomCode, roomState: getSerializedRoomState(room) });
  });

  socket.on('start-game', (data) => {
    const { roomCode } = data;
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) return;
    
    if (room.players.length < MIN_PLAYERS_TO_START) return;
    
    room.status = 'in-progress';
    room.gameStartedAt = Date.now();
    room.usedWords.clear();
    
    // reset all players
    room.players.forEach(p => {
      p.lives = STARTING_LIVES;
      p.isSpectator = false;
    });
    
    // Random first player
    const activePlayers = room.players.filter(p => !p.isSpectator);
    const firstPlayer = activePlayers[Math.floor(Math.random() * activePlayers.length)];
    
    const letters = engine.getStartingLetters(room.usedWords);
    startTurn(room, firstPlayer.id, letters);
  });
  
  socket.on('select-letter', (data) => {
    const { roomCode, letter } = data;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'in-progress' || room.currentTurnPlayerId !== socket.id) return;
    if (room.currentPrefix) return;
    
    room.currentPrefix = letter.toLowerCase();
    room.startingLetters = null;
    io.to(room.code).emit('letter-selected', { letter: room.currentPrefix });
    emitRoomState(room);
  });

  socket.on('typing', (data) => {
    const { roomCode, input } = data;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'in-progress' || room.currentTurnPlayerId !== socket.id) return;
    
    socket.to(room.code).emit('typing', { playerId: socket.id, input });
  });
  
  socket.on('submit-word', (data, callback) => {
    const { roomCode, word } = data;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'in-progress') return;
    
    const valResult = engine.validateWord(socket.id, room.currentTurnPlayerId, word, room.currentPrefix, room.usedWords);
    
    if (!valResult.valid) {
      if (!valResult.isSenderError && typeof callback === 'function') {
        callback({ error: valResult.reason });
      }
      return;
    }
    
    // Valid word
    room.usedWords.add(valResult.word);
    const player = room.players.find(p => p.id === socket.id);
    room.lastPlayed = {
      word: valResult.word,
      playerId: socket.id,
      displayName: player ? player.displayName : 'Player'
    };
    if (room.turnTimeoutHandle) clearTimeout(room.turnTimeoutHandle);
    
    io.to(room.code).emit('word-accepted', {
      word: valResult.word,
      playerId: socket.id,
      displayName: player ? player.displayName : 'Player'
    });
    if (typeof callback === 'function') {
      callback({ success: true, word: valResult.word });
    }
    
    if (room.isPractice) {
      // Bot turn
      doBotTurn(room, valResult.word);
    } else {
      // Next player
      const nextPrefix = engine.getNextPrefix(valResult.word, (Date.now() - room.gameStartedAt) / 1000, room.usedWords);
      const nextPlayerId = getNextPlayerId(room);
      
      if (!nextPlayerId) return;
      
      if (nextPrefix) {
        room.currentPrefix = nextPrefix;
        startTurn(room, nextPlayerId);
      } else {
        const letters = engine.getStartingLetters(room.usedWords);
        startTurn(room, nextPlayerId, letters);
      }
    }
  });

  socket.on('leave-room', (data) => {
    const { roomCode } = data;
    handleLeaveOrDisconnect(socket, roomCode, true);
  });

  socket.on('disconnecting', () => {
    for (const roomCode of socket.rooms) {
      if (roomCode !== socket.id) {
        handleLeaveOrDisconnect(socket, roomCode, false);
      }
    }
  });

  // --- Practice Mode ---
  socket.on('start-practice', (data, callback) => {
    let { displayName, sessionToken } = data;
    displayName = (displayName || 'Player').trim().substring(0, MAX_DISPLAY_NAME_LENGTH);
    const roomCode = 'PRACTICE_' + crypto.randomUUID().substring(0, 8);
    
    const letters = engine.getStartingLetters(new Set());
    
    const room = {
      code: roomCode,
      isPractice: true,
      players: [{
        id: socket.id,
        sessionToken,
        displayName,
        lives: STARTING_LIVES,
        isHost: true,
        isSpectator: false,
        isConnected: true,
        joinOrder: 0
      }],
      status: 'in-progress',
      currentTurnPlayerId: socket.id,
      currentPrefix: null,
      startingLetters: letters,
      usedWords: new Set(),
      turnStartedAt: Date.now(),
      turnTimeoutHandle: null,
      gameStartedAt: Date.now(),
      createdAt: Date.now(),
      hintsLeft: MAX_HINTS_PER_PRACTICE_SESSION
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    // Set turn timeout
    room.turnTimeoutHandle = setTimeout(() => {
      handleTimeout(room, socket.id);
    }, TURN_TIMER_SECONDS * 1000);

    emitRoomState(room);
    
    if (typeof callback === 'function') {
      callback({
        success: true,
        roomCode,
        roomState: getSerializedRoomState(room)
      });
    }
  });

  socket.on('request-hint', (data, callback) => {
    const { roomCode } = data;
    const room = rooms.get(roomCode);
    if (!room || !room.isPractice || room.status !== 'in-progress' || room.currentTurnPlayerId !== socket.id) {
      return callback({ error: 'Not your turn' });
    }
    
    if (room.hintsLeft <= 0) {
      return callback({ error: 'No hints left' });
    }
    
    const elapsed = (Date.now() - room.gameStartedAt) / 1000;
    const isOver4Minutes = elapsed > 240;
    const isThirdHintOverall = (room.hintsLeft === 1);

    // Pick or keep hint word for the current turn
    if (!room.currentHintWord) {
      room.currentHintWord = engine.getHint(room.currentPrefix, room.usedWords);
      room.hintRevealedLength = (room.currentPrefix ? room.currentPrefix.length : 0);
    }
    
    const word = room.currentHintWord;
    if (!word) {
      return callback({ error: 'No hint available' });
    }
    
    room.hintsLeft -= 1;
    room.hintsUsedOnCurrentWord = (room.hintsUsedOnCurrentWord || 0) + 1;
    
    let revealedText = '';
    
    // Rule: If time > 4 minutes and it's the 3rd hint overall -> reveal the whole word
    if (isOver4Minutes && isThirdHintOverall) {
      revealedText = word;
      room.hintRevealedLength = word.length;
    }
    // Rule: If 3rd hint used on one single word -> reveal the whole word
    else if (room.hintsUsedOnCurrentWord >= 3) {
      revealedText = word;
      room.hintRevealedLength = word.length;
    }
    // Rule: If 2nd hint on the same word -> show next 3 letters
    else if (room.hintsUsedOnCurrentWord === 2) {
      const nextLen = Math.min(word.length, room.hintRevealedLength + 3);
      room.hintRevealedLength = nextLen;
      revealedText = word.slice(0, nextLen);
    }
    // Rule: 1st hint on this word -> reveal a single letter
    else {
      const nextLen = Math.min(word.length, room.hintRevealedLength + 1);
      room.hintRevealedLength = nextLen;
      revealedText = word.slice(0, nextLen);
    }
    
    callback({
      hint: revealedText,
      hintsLeft: room.hintsLeft,
      isFullWord: (revealedText.length === word.length)
    });
  });
  
  socket.on('play-again', (data) => {
     const { roomCode } = data;
     const room = rooms.get(roomCode);
     if (!room) return;
     
     if (room.isPractice) {
       room.status = 'in-progress';
       room.gameStartedAt = Date.now();
       room.usedWords.clear();
       room.lastPlayed = null;
       room.hintsLeft = MAX_HINTS_PER_PRACTICE_SESSION;
       room.players[0].lives = STARTING_LIVES;
       const letters = engine.getStartingLetters(room.usedWords);
       startTurn(room, socket.id, letters);
     } else {
       const player = room.players.find(p => p.id === socket.id);
       if (player && player.isHost) {
         room.status = 'lobby';
         room.usedWords.clear();
         room.lastPlayed = null;
         emitRoomState(room);
       }
     }
  });
});

function doBotTurn(room, playerWord) {
  const elapsed = (Date.now() - room.gameStartedAt) / 1000;
  const nextPrefix = engine.getNextPrefix(playerWord, elapsed, room.usedWords);
  
  if (!nextPrefix) {
    const letters = engine.getStartingLetters(room.usedWords);
    startTurn(room, room.players[0].id, letters);
    return;
  }
  
  room.currentPrefix = nextPrefix;
  room.startingLetters = null;
  room.currentTurnPlayerId = 'bot';
  room.turnStartedAt = Date.now();
  
  io.to(room.code).emit('turn-started', {
    playerId: 'bot',
    prefix: nextPrefix,
    duration: 0
  });
  emitRoomState(room);
  
  // Fast bot think time for snappy gameplay: 400-750ms
  const botThinkTime = Math.floor(Math.random() * 350) + 400;
  
  setTimeout(() => {
    if (room.status !== 'in-progress' || room.currentTurnPlayerId !== 'bot') return;
    
    const botWord = engine.getBotMove(nextPrefix, (Date.now() - room.gameStartedAt) / 1000, room.usedWords);
    
    if (!botWord) {
      const letters = engine.getStartingLetters(room.usedWords);
      startTurn(room, room.players[0].id, letters);
      return;
    }
    
    room.usedWords.add(botWord);
    room.lastPlayed = {
      word: botWord,
      playerId: 'bot',
      displayName: 'Bot'
    };
    io.to(room.code).emit('word-accepted', {
      word: botWord,
      playerId: 'bot',
      displayName: 'Bot'
    });
    
    const nextHumanPrefix = engine.getNextPrefix(botWord, (Date.now() - room.gameStartedAt) / 1000, room.usedWords);
    if (nextHumanPrefix) {
      room.currentPrefix = nextHumanPrefix;
      startTurn(room, room.players[0].id);
    } else {
      const letters = engine.getStartingLetters(room.usedWords);
      startTurn(room, room.players[0].id, letters);
    }
    
  }, botThinkTime);
}

function handleLeaveOrDisconnect(socket, roomCode, isExplicitLeave) {
  const room = rooms.get(roomCode);
  if (!room) return;
  
  const player = room.players.find(p => p.id === socket.id);
  if (!player) return;
  
  if (isExplicitLeave) {
    player.isSpectator = true;
    player.lives = 0;
    io.to(roomCode).emit('player-left', { playerId: socket.id });
    
    if (room.status === 'in-progress' && room.currentTurnPlayerId === socket.id) {
       advanceTurnWithFallback(room);
    }
    checkWinCondition(room);
  } else {
    player.isConnected = false;
    io.to(roomCode).emit('player-disconnected', { playerId: socket.id });
  }
  emitRoomState(room);
}

// Cleanup inactive rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.isPractice && !room.players[0].isConnected && (now - room.createdAt > 300000)) {
       rooms.delete(code);
       continue;
    }
    if (room.players.every(p => !p.isConnected) && (now - room.createdAt > 300000)) {
      rooms.delete(code);
    }
  }
}, 60000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
