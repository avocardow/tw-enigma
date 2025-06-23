'use client';

import { useEffect } from 'react';
import { initScramble } from '../lib/scramble';

interface ScrambleProviderProps {
  children: React.ReactNode;
}

export default function ScrambleProvider({ children }: ScrambleProviderProps) {
  useEffect(() => {
    // Only initialize scramble on the client side
    initScramble();
  }, []);

  return <>{children}</>;
}
