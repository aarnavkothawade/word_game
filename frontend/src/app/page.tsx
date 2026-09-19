'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';

export default function Home() {
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { socket, isConnected, getSessionToken, saveDisplayName, getDisplayName } = useSocket();

  useEffect(() => {
    setMounted(true);
    const saved = getDisplayName();
    if (saved) setDisplayName(saved);
  }, []);

  const handleCreate = () => {
    const name = displayName.trim() || 'Player';
    if (!socket || !isConnected) {
      setError('Connecting to game server...');
      return;
    }
    saveDisplayName(name);

    socket.emit('join-room', { 
      displayName: name, 
      sessionToken: getSessionToken() 
    }, (res: any) => {
      if (res?.error) setError(res.error);
      else if (res?.roomCode) router.push(`/room/${res.roomCode}`);
    });
  };

  const handleJoin = () => {
    const name = displayName.trim() || 'Player';
    if (!roomCode.trim()) {
      setError('Room code is required');
      return;
    }

    if (!socket || !isConnected) {
      setError('Connecting to game server...');
      return;
    }
    saveDisplayName(name);

    socket.emit('join-room', { 
      roomCode: roomCode.trim().toUpperCase(), 
      displayName: name, 
      sessionToken: getSessionToken() 
    }, (res: any) => {
      if (res?.error) setError(res.error);
      else if (res?.roomCode) router.push(`/room/${res.roomCode}`);
    });
  };

  const handlePractice = () => {
    const name = displayName.trim() || 'Player';
    saveDisplayName(name);
    router.push('/practice');
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] mb-8">Word Chain</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between flex-1 p-4 relative min-h-[calc(100vh-73px)]">
      <div className="w-full flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center mb-2">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)]">Word Chain</h1>
          </div>
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 text-sm text-center rounded font-medium">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border-color)] rounded bg-[var(--card-bg)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]"
              maxLength={10}
              placeholder="Your name (e.g. Alex)"
            />
          </div>

          <div className="space-y-4 pt-2">
            <button 
              onClick={handleCreate}
              className="w-full py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded font-semibold hover:opacity-90 transition-opacity"
            >
              Create Multiplayer Game
            </button>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-[var(--border-color)] rounded bg-[var(--card-bg)] text-[var(--foreground)] uppercase font-mono placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]"
                maxLength={6}
                placeholder="ROOM CODE"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
              <button 
                onClick={handleJoin}
                className="px-5 py-2 border border-[var(--border-color)] rounded font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors"
              >
                Join
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--border-color)]">
            <button 
              onClick={handlePractice}
              className="w-full py-2.5 border border-[var(--border-color)] rounded font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors"
            >
              Practice vs Bot
            </button>
          </div>
        </div>
      </div>

      <div className="w-full sm:w-auto flex justify-center sm:justify-end sm:absolute sm:bottom-4 sm:right-6 pt-4 pb-2 select-none">
        <span className="text-xs font-bold tracking-wide text-[var(--muted-foreground)]">
          A Product by Aarnav Kothawade
        </span>
      </div>
    </div>
  );
}
