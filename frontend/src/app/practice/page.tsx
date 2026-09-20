'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import Keyboard from '@/components/Keyboard';
import {
  RoomState,
  GameOverResult,
  TurnStartedData,
  LetterSelectedData,
  WordAcceptedData,
  SubmitWordResponse,
  RequestHintResponse,
  LastPlayedInfo
} from '@/types/game';

export default function PracticePage() {
  const router = useRouter();
  const { socket, isConnected, getSessionToken, getDisplayName } = useSocket();
  
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [startingLetters, setStartingLetters] = useState<string[] | null>(null);
  const [gameOverResult, setGameOverResult] = useState<GameOverResult | null>(null);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [roomCode, setRoomCode] = useState<string>('');
  const [lastPlayed, setLastPlayed] = useState<LastPlayedInfo | null>(null);
  const initStartedRef = useRef(false);

  const isMyTurn = roomState?.status === 'in-progress' && roomState?.currentTurnPlayerId === socket?.id;
  const localPlayer = roomState?.players?.[0];
  const effectiveGameOver = gameOverResult || roomState?.gameOverResult || (roomState?.status === 'finished' ? { wordsChained: roomState?.wordsChained ?? 0 } : null);

  // Initialize practice session on mount
  useEffect(() => {
    if (!socket || !isConnected || initStartedRef.current) return;
    initStartedRef.current = true;

    const name = getDisplayName() || 'Player';
    const token = getSessionToken();

    socket.emit('start-practice', { displayName: name, sessionToken: token }, (res: { success?: boolean; roomCode?: string; roomState?: RoomState; error?: string }) => {
      if (res?.success && res?.roomState) {
        setRoomCode(res.roomCode || '');
        setRoomState(res.roomState);
        setHintsLeft(res.roomState.hintsLeft ?? 3);
        if (res.roomState.startingLetters) {
          setStartingLetters(res.roomState.startingLetters);
        }
      } else if (res?.error) {
        setError(res.error);
      }
    });
  }, [socket, isConnected, getDisplayName, getSessionToken]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const onRoomState = (state: RoomState) => {
      setRoomState(state);
      setHintsLeft(state.hintsLeft ?? 3);
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

    const onWordAccepted = (data: WordAcceptedData) => {
      setError('');
      if (data.word) {
        setLastPlayed({
          word: data.word,
          playerId: data.playerId,
          displayName: data.displayName || (data.playerId === 'bot' ? 'Bot' : 'You')
        });
      }
      if (data.playerId === socket.id) {
        setInput('');
      }
    };

    const onGameOver = (data: GameOverResult) => {
      setGameOverResult(data);
    };

    socket.on('room-state', onRoomState);
    socket.on('turn-started', onTurnStarted);
    socket.on('letter-selected', onLetterSelected);
    socket.on('word-accepted', onWordAccepted);
    socket.on('game-over', onGameOver);

    return () => {
      socket.off('room-state', onRoomState);
      socket.off('turn-started', onTurnStarted);
      socket.off('letter-selected', onLetterSelected);
      socket.off('word-accepted', onWordAccepted);
      socket.off('game-over', onGameOver);
    };
  }, [socket, isConnected, roomState?.currentTurnPlayerId]);

  // Timer countdown
  useEffect(() => {
    if (roomState?.status !== 'in-progress' || timeLeft <= 0 || !isMyTurn) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [roomState?.status, timeLeft, isMyTurn]);

  // Key actions
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

    socket?.emit('submit-word', { roomCode: roomCode || roomState?.code, word: trimmed }, (res: SubmitWordResponse) => {
      if (res?.error) setError(res.error);
    });
  }, [isMyTurn, startingLetters, input, socket, roomCode, roomState]);

  // Physical Keyboard Listener
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
    const code = roomCode || roomState?.code;
    socket?.emit('select-letter', { roomCode: code, letter });
    setInput(letter);
    setStartingLetters(null);
  };

  const [hintMessage, setHintMessage] = useState('');

  const handleHint = () => {
    if (!isMyTurn || hintsLeft <= 0 || startingLetters) return;
    const code = roomCode || roomState?.code;
    socket?.emit('request-hint', { roomCode: code }, (res: RequestHintResponse) => {
      if (res?.hint) {
        setInput(res.hint);
        if (typeof res.hintsLeft === 'number') setHintsLeft(res.hintsLeft);
        if (res.isFullWord) {
          setHintMessage('Full word revealed!');
        } else {
          setHintMessage(`Hint: "${res.hint.toUpperCase()}"`);
        }
        setTimeout(() => setHintMessage(''), 3000);
      } else if (res?.error) {
        setError(res.error);
      }
    });
  };

  const handlePlayAgain = () => {
    const code = roomCode || roomState?.code;
    socket?.emit('play-again', { roomCode: code });
  };

  const handleLeave = () => {
    const code = roomCode || roomState?.code;
    if (code) socket?.emit('leave-room', { roomCode: code });
    router.push('/');
  };

  if (!roomState) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <div className="text-center space-y-3">
          <div className="text-xl font-bold tracking-widest text-[var(--foreground)] animate-pulse">
            STARTING PRACTICE...
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">Connecting vs Bot</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 relative bg-[var(--background)] text-[var(--foreground)]">
      {/* Top Bar */}
      <div className="p-4 flex justify-between items-center border-b border-[var(--border-color)] text-sm">
        <div className="font-bold tracking-widest text-[var(--foreground)]">PRACTICE MODE</div>
        {localPlayer && (
          <div className="font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span>Lives:</span>
            <span className="text-red-500 font-mono text-base">{'♥'.repeat(Math.max(0, localPlayer.lives))}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-2xl mx-auto">
        {roomState.status === 'in-progress' && !effectiveGameOver && (
          <div className="w-full flex flex-col items-center justify-center space-y-8">
            <div className={`text-5xl font-mono font-bold ${isMyTurn ? (timeLeft <= 3 ? 'text-red-500 animate-bounce' : 'text-[var(--foreground)]') : 'text-[var(--muted-foreground)]'}`}>
              {isMyTurn ? `${timeLeft}s` : 'BOT'}
            </div>

            <div className="text-center w-full flex flex-col items-center space-y-4">
              {/* Previous word display (Bot's or Player's word) */}
              {lastPlayed && !startingLetters && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] text-sm shadow-sm">
                  <span className="text-[var(--muted-foreground)]">
                    {lastPlayed.playerId === 'bot' ? '🤖 Bot played:' : 'You played:'}
                  </span>
                  <span className="font-mono font-bold uppercase tracking-wider text-[var(--foreground)] text-base">
                    {lastPlayed.word}
                  </span>
                </div>
              )}

              <div className="text-lg font-medium text-[var(--muted-foreground)]">
                {isMyTurn ? (
                  startingLetters ? (
                    'Select a starting letter'
                  ) : roomState?.currentPrefix ? (
                    <span>Your Turn — start with <strong className="text-[var(--foreground)] font-mono font-bold uppercase">&quot;{roomState.currentPrefix}&quot;</strong></span>
                  ) : (
                    'Your Turn'
                  )
                ) : (
                  'Bot is thinking...'
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
                    <span>{isMyTurn ? input : '...'}</span>
                    {isMyTurn && <span className="animate-pulse text-[var(--foreground)] font-light ml-1">|</span>}
                  </div>
                  {error && (
                    <div className="text-red-500 dark:text-red-400 text-sm mt-3 font-semibold bg-red-500/10 px-3 py-1 rounded">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Hint System */}
            {hintsLeft > 0 && isMyTurn && !startingLetters && (
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={handleHint}
                  className="px-4 py-2 border border-[var(--border-color)] rounded text-[var(--foreground)] bg-[var(--card-bg)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors text-sm font-medium cursor-pointer"
                >
                  Hint ({hintsLeft} left)
                </button>
                {hintMessage && (
                  <div className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 animate-pulse">
                    {hintMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {effectiveGameOver && (
          <div className="w-full text-center space-y-6">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">
              Practice Over
            </h2>
            <p className="text-xl text-[var(--muted-foreground)]">
              Words successfully chained: <span className="font-bold text-[var(--foreground)]">{effectiveGameOver.wordsChained ?? 0}</span>
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <button 
                onClick={handlePlayAgain} 
                className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Play Again
              </button>
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
      {roomState?.status === 'in-progress' && !effectiveGameOver && !startingLetters && (
        <div className="pb-4">
          <Keyboard 
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onEnter={handleSubmit}
            disabled={!isMyTurn}
          />
        </div>
      )}

      {/* Bottom bar for leaving */}
      <div className="p-3 border-t border-[var(--border-color)] flex justify-between items-center text-xs px-4">
        <button 
          onClick={handleLeave} 
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors underline cursor-pointer"
        >
          Quit Practice
        </button>
        <span className="font-bold text-[var(--muted-foreground)] select-none">
          A Product by Aarnav Kothawade
        </span>
      </div>
    </div>
  );
}
