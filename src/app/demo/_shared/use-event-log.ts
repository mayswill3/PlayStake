'use client';

import { useState, useCallback } from 'react';
import type { LogEntry } from './types';

export function useEventLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const log = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setEntries((prev) => [...prev, { timestamp, message, level }]);
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, log, clear };
}
