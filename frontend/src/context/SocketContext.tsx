'use client';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  sessionToken: string;
  displayName: string;
  saveDisplayName: (name: string) => void;
  getSessionToken: () => string;
  getDisplayName: () => string;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [displayName, setDisplayNameState] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);

  // Initialize session token and display name once on mount
  useEffect(() => {
    let token = localStorage.getItem('sessionToken');
    if (!token) {
      token = uuidv4();
      localStorage.setItem('sessionToken', token);
    }
    setSessionToken(token);

    const savedName = localStorage.getItem('displayName') || '';
    setDisplayNameState(savedName);
  }, []);

  useEffect(() => {
    if (socketRef.current) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const saveDisplayName = (name: string) => {
    localStorage.setItem('displayName', name);
    setDisplayNameState(name);
  };

  const getSessionToken = () => {
    if (typeof window === 'undefined') return '';
    let token = localStorage.getItem('sessionToken');
    if (!token) {
      token = uuidv4();
      localStorage.setItem('sessionToken', token);
    }
    return token;
  };

  const getDisplayName = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('displayName') || '';
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        sessionToken,
        displayName,
        saveDisplayName,
        getSessionToken,
        getDisplayName
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return ctx;
}
