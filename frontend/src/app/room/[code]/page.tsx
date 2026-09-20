'use client';
import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import Keyboard from '@/components/Keyboard';
import {
  RoomState,
  GameOverResult,
  TurnStartedData,
  LetterSelectedData,
  TypingData,
  WordAcceptedData,
  PlayAgainStatusData,
  JoinRoomResponse,
  SubmitWordResponse,
  LastPlayedInfo,
  Player
} from '@/types/game';

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.code.toUpperCase();
  const router = useRouter();
  const { socket, isConnected, getSessionToken, getDisplayName, saveDisplayName } = useSocket();
  
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [input, setInput] = useState('');
  const [liveTyping, setLiveTyping] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [startingLetters, setStartingLetters] = useState<string[] | null>(null);
  const [gameOverResult, setGameOverResult] = useState<GameOverResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastPlayed, setLastPlayed] = useState<LastPlayedInfo | null>(null);
  const [hasClickedPlayAgain, setHasClickedPlayAgain] = useState(false);
  const [playAgainStatus, setPlayAgainStatus] = useState<PlayAgainStatusData | null>(null);

  const localPlayer = roomState?.players?.find((p: Player) => p.id === socket?.id);
  const isMyTurn = roomState?.status === 'in-progress' && roomState?.currentTurnPlayerId === socket?.id;
  const activePlayer = roomState?.players?.find((p: Player) => p.id === roomState?.currentTurnPlayerId);
  const effectiveGameOver = gameOverResult || roomState?.gameOverResult || (roomState?.status === 'finished' ? { winner: null } : null);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      const saved = getDisplayName();
      if (saved) setDisplayNameInput(saved);
    });
  }, [getDisplayName]);

  // Connection & Room Sync
  useEffect(() => {
    if (!socket || !isConnected || !mounted) return;

    // Auto-join if displayName is known and no roomState yet
    const name = getDisplayName();
    if (name && !roomState) {
      socket.emit('join-room', { roomCode, displayName: name, sessionToken: getSessionToken() }, (res: JoinRoomResponse) => {
        if (res?.error) setError(res.error);
        else if (res?.roomState) {
          setRoomState(res.roomState);
          if (res.roomState.startingLetters) setStartingLetters(res.roomState.startingLetters);
        }
      });
    }

    const onRoomState = (state: RoomState) => {
      setRoomState(state);
      if (state.lastPlayed) {
        setLastPlayed(state.lastPlayed);
      }
      if (state.startingLetters) {
        setStartingLetters(state.startingLetters);
      } else {
        setStartingLetters(null);
      }
      if (state.status === 'in-progress') {
        if (state.turnDuration) setTimeLeft(state.turnDuration);
        setGameOverResult(null);
        setHasClickedPlayAgain(false);
        setPlayAgainStatus(null);
      }
    };

    const onTurnStarted = (data: TurnStartedData) => {
      setTimeLeft(data.duration);
      if (data.letters) {
        setStartingLetters(data.letters);
        setInput('');
      } else if (data.prefix) {
        setStartingLetters(null);
        if (data.playerId === socket.id) {
          setInput(data.prefix);
        }
      }
    };

    const onLetterSelected = (data: LetterSelectedData) => {
      setStartingLetters(null);
      if (roomState?.currentTurnPlayerId === socket.id) {
        setInput(data.letter);
      }
    };

    const onTyping = (data: TypingData) => {
      if (data.playerId !== socket.id) {
        setLiveTyping(data.input);
      }
    };

    const onWordAccepted = (data: WordAcceptedData) => {
      setLiveTyping('');
      setInput('');
      setError('');
      if (data?.word) {
        setLastPlayed({
          word: data.word,
          playerId: data.playerId,
          displayName: data.displayName
        });
      }
    };

    const onGameOver = (data: GameOverResult) => {
      setGameOverResult(data);
      setHasClickedPlayAgain(false);
      setPlayAgainStatus(null);
    };

    const onPlayAgainStatus = (data: PlayAgainStatusData) => {
      setPlayAgainStatus(data);
    };

    socket.on('room-state', onRoomState);
    socket.on('turn-started', onTurnStarted);
    socket.on('letter-selected', onLetterSelected);
    socket.on('typing', onTyping);
    socket.on('word-accepted', onWordAccepted);
    socket.on('game-over', onGameOver);
    socket.on('play-again-status', onPlayAgainStatus);

    return () => {
      socket.off('room-state', onRoomState);
      socket.off('turn-started', onTurnStarted);
      socket.off('letter-selected', onLetterSelected);
      socket.off('typing', onTyping);
      socket.off('word-accepted', onWordAccepted);
      socket.off('game-over', onGameOver);
      socket.off('play-again-status', onPlayAgainStatus);
    };
  }, [socket, isConnected, mounted, roomCode, roomState, getSessionToken, getDisplayName]);

  // Timer countdown
  useEffect(() => {
    if (roomState?.status !== 'in-progress' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [roomState?.status, timeLeft]);

  // Typing broadcast
  useEffect(() => {
    if (isMyTurn && socket) {
      socket.emit('typing', { roomCode, input });
    }
  }, [input, isMyTurn, socket, roomCode]);

  const handleJoinDirect = () => {
    const name = displayNameInput.trim() || 'Player';
    saveDisplayName(name);
    socket?.emit('join-room', { roomCode, displayName: name, sessionToken: getSessionToken() }, (res: JoinRoomResponse) => {
      if (res?.error) setError(res.error);
      else if (res?.roomState) {
        setRoomState(res.roomState);
        if (res.roomState.startingLetters) setStartingLetters(res.roomState.startingLetters);
      }
    });
  };

  const handleStartGame = () => {
    socket?.emit('start-game', { roomCode });
  };

  const handleLeave = () => {
    socket?.emit('leave-room', { roomCode });
    router.push('/');
  };

  // Keyboard input handlers
  const handleKeyPress = useCallback((key: string) => {
    if (!isMyTurn || startingLetters) return;
    setInput(prev => prev + key);
    setError('');
  }, [isMyTurn, startingLetters]);

  const handleBackspace = useCallback(() => {
    if (!isMyTurn || startingLetters) return;
    if (roomState?.currentPrefix && input.length <= roomState.currentPrefix.length) return;
    setInput(prev => prev.slice(0, -1));
  }, [isMyTurn, startingLetters, roomState, input]);

  const handleSubmit = useCallback(() => {
    if (!isMyTurn || startingLetters) return;
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;

    if (roomState?.usedWords && roomState.usedWords.includes(trimmed)) {
      setError(`"${trimmed.toUpperCase()}" has already been used in this game`);
      return;
    }

    socket?.emit('submit-word', { roomCode, word: trimmed }, (res: SubmitWordResponse) => {
      if (res?.error) setError(res.error);
    });
  }, [isMyTurn, startingLetters, input, socket, roomCode, roomState]);

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!isMyTurn || startingLetters) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key.toLowerCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMyTurn, startingLetters, handleKeyPress, handleBackspace, handleSubmit]);

  const handleSelectLetter = (letter: string) => {
    if (!isMyTurn) return;
    socket?.emit('select-letter', { roomCode, letter });
    setInput(letter);
    setStartingLetters(null);
  };

  const handlePlayAgain = () => {
    socket?.emit('play-again', { roomCode });
    setHasClickedPlayAgain(true);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4 bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
      </div>
    );
  }

  if (error && !roomState) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4 bg-[var(--background)] text-[var(--foreground)]">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-red-500">{error}</h1>
          <button 
            onClick={() => router.push('/')} 
            className="px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded font-semibold hover:opacity-90 cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4 bg-[var(--background)] text-[var(--foreground)]">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Join Room {roomCode}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Enter your display name to join the game</p>
          </div>
          <input
            type="text"
            value={displayNameInput}
            onChange={e => setDisplayNameInput(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-color)] rounded bg-[var(--card-bg)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]"
            maxLength={10}
            placeholder="Display Name"
            onKeyDown={e => e.key === 'Enter' && handleJoinDirect()}
          />
          <button 
            onClick={handleJoinDirect} 
            className="w-full py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 relative bg-[var(--background)] text-[var(--foreground)]">
      {/* Top Bar */}
      <div className="p-4 flex justify-between items-center border-b border-[var(--border-color)] text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-widest font-mono text-[var(--foreground)]">{roomCode}</span>
          <button 
            onClick={handleCopyLink}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline transition-colors cursor-pointer"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        {localPlayer && (
          <div className="font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span>Lives:</span>
            <span className="text-red-500 font-mono text-base">{'♥'.repeat(Math.max(0, localPlayer.lives))}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-2xl mx-auto">
        
        {/* Lobby View */}
        {roomState.status === 'lobby' && (
          <div className="w-full text-center space-y-6">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">
              Lobby ({roomState.players.length}/5 Players)
            </h2>
            
            <div className="max-w-md mx-auto bg-[var(--card-bg)] border border-[var(--border-color)] rounded divide-y divide-[var(--border-color)]">
              {roomState.players.map((p: Player) => (
                <div key={p.id} className="px-4 py-3 flex justify-between items-center text-sm font-medium">
                  <span className="text-[var(--foreground)]">
                    {p.displayName} {p.id === socket?.id && '(You)'}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
                    {p.isHost ? 'Host' : 'Player'}
                  </span>
                </div>
              ))}
            </div>

            {localPlayer?.isHost ? (
              <div className="space-y-2 pt-4">
                <button 
                  onClick={handleStartGame}
                  disabled={roomState.players.length < 2}
                  className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] rounded font-bold hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Start Game
                </button>
                {roomState.players.length < 2 && (
                  <p className="text-xs text-[var(--muted-foreground)]">Need at least 2 players to start</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)] animate-pulse pt-4">
                Waiting for host to start the game...
              </p>
            )}
          </div>
        )}

        {/* In-Game View */}
        {roomState.status === 'in-progress' && !effectiveGameOver && (
          <div className="w-full flex flex-col items-center justify-center space-y-8">
            <div className={`text-5xl font-mono font-bold ${timeLeft <= 3 ? 'text-red-500 animate-bounce' : 'text-[var(--foreground)]'}`}>
              {timeLeft}s
            </div>

            <div className="text-center w-full flex flex-col items-center space-y-4">
              {/* Previous word display */}
              {lastPlayed && !startingLetters && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] text-sm shadow-sm">
                  <span className="text-[var(--muted-foreground)]">
                    {lastPlayed.displayName ? `${lastPlayed.displayName} played:` : 'Previous word:'}
                  </span>
                  <span className="font-mono font-bold uppercase tracking-wider text-[var(--foreground)] text-base">
                    {lastPlayed.word}
                  </span>
                </div>
              )}

              <div className="text-lg font-medium text-[var(--muted-foreground)]">
                {activePlayer ? (
                  <span>
                    {activePlayer.displayName}&apos;s turn {activePlayer.id === socket?.id && '(You)'}
                    {roomState?.currentPrefix && !startingLetters && (
                      <span> — start with <strong className="text-[var(--foreground)] font-mono font-bold uppercase">&quot;{roomState.currentPrefix}&quot;</strong></span>
                    )}
                  </span>
                ) : (
                  <span>Next turn starting...</span>
                )}
              </div>

              {startingLetters ? (
                <div className="flex justify-center gap-4 mt-6">
                  {startingLetters.map(l => (
                    <button 
                      key={l}
                      onClick={() => handleSelectLetter(l)}
                      disabled={!isMyTurn}
                      className="w-16 h-16 text-3xl uppercase border-2 border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--foreground)] flex items-center justify-center font-bold rounded hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex flex-col items-center">
                  <div className="text-4xl font-mono font-bold tracking-widest min-h-[48px] uppercase text-[var(--foreground)] flex items-center justify-center">
                    <span>{isMyTurn ? input : liveTyping}</span>
                    <span className="animate-pulse text-[var(--foreground)] font-light ml-1">|</span>
                  </div>
                  {error && (
                    <div className="text-red-500 dark:text-red-400 text-sm mt-3 font-semibold bg-red-500/10 px-3 py-1 rounded">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {localPlayer?.isSpectator && (
              <div className="px-4 py-2 border border-[var(--border-color)] bg-[var(--card-bg)] rounded text-[var(--muted-foreground)] text-xs">
                You are out of lives — spectating
              </div>
            )}
          </div>
        )}

        {/* Game Over View */}
        {effectiveGameOver && (
          <div className="w-full text-center space-y-6">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">
              {effectiveGameOver.winner ? `${effectiveGameOver.winner} wins!` : 'Game Over'}
            </h2>
            <div className="flex flex-col items-center gap-4 pt-4">
              {!hasClickedPlayAgain ? (
                <button 
                  onClick={handlePlayAgain} 
                  className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded font-bold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Play Again
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="px-6 py-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded font-bold text-[var(--muted-foreground)]">
                    ✓ Ready
                  </div>
                  {playAgainStatus && (
                    <p className="text-sm text-[var(--muted-foreground)] animate-pulse">
                      Waiting for {playAgainStatus.totalCount - playAgainStatus.readyCount} more player{playAgainStatus.totalCount - playAgainStatus.readyCount !== 1 ? 's' : ''}...
                    </p>
                  )}
                </div>
              )}
              <button 
                onClick={handleLeave} 
                className="px-6 py-3 border border-[var(--border-color)] text-[var(--foreground)] rounded font-bold hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard */}
      {roomState?.status === 'in-progress' && !effectiveGameOver && !startingLetters && !localPlayer?.isSpectator && (
        <div className="pb-4">
          <Keyboard 
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onEnter={handleSubmit}
            disabled={!isMyTurn}
          />
        </div>
      )}

      {/* Bottom Bar for leaving */}
      <div className="p-3 border-t border-[var(--border-color)] flex justify-between items-center text-xs px-4">
        <button 
          onClick={handleLeave} 
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors underline cursor-pointer"
        >
          Leave Game
        </button>
        <span className="font-bold text-[var(--muted-foreground)] select-none">
          A Product by Aarnav Kothawade
        </span>
      </div>
    </div>
  );
}
