'use client';
import { useSocketContext } from '@/context/SocketContext';

export function useSocket() {
  return useSocketContext();
}
