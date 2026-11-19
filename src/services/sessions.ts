import type {ReadingSession} from '../types';
import {db, type OrpelaDatabase} from './storage/db';

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function createReadingSession(
  documentId: string,
  startWordIndex: number,
  database: OrpelaDatabase = db
): Promise<ReadingSession> {
  const session: ReadingSession = {
    id: generateSessionId(),
    documentId,
    startedAt: new Date().toISOString(),
    startWordIndex,
    endWordIndex: startWordIndex,
    wordsRead: 0,
    activeSeconds: 0,
    averageWpm: 0,
  };
  await database.sessions.put(session);
  return session;
}

export async function finalizeReadingSession(
  session: ReadingSession,
  endWordIndex: number,
  activeSeconds: number,
  database: OrpelaDatabase = db
): Promise<ReadingSession> {
  const wordsRead = Math.max(0, endWordIndex - session.startWordIndex);
  const safeSeconds = Math.max(0, activeSeconds);
  const averageWpm = safeSeconds > 0 ? Math.round((wordsRead / safeSeconds) * 60) : 0;

  const finalized: ReadingSession = {
    ...session,
    endedAt: new Date().toISOString(),
    endWordIndex,
    wordsRead,
    activeSeconds: Number(safeSeconds.toFixed(2)),
    averageWpm,
  };

  if (wordsRead === 0 && safeSeconds < 1) {
    await database.sessions.delete(session.id);
    return finalized;
  }

  await database.sessions.put(finalized);
  return finalized;
}

export async function listAllSessions(
  database: OrpelaDatabase = db
): Promise<ReadingSession[]> {
  return database.sessions.orderBy('startedAt').reverse().toArray();
}

export interface AggregateReadingStats {
  totalSessions: number;
  totalWordsRead: number;
  totalActiveSeconds: number;
  averageWpm: number;
}

export function computeAggregateStats(sessions: readonly ReadingSession[]): AggregateReadingStats {
  let totalWordsRead = 0;
  let totalActiveSeconds = 0;

  for (const s of sessions) {
    totalWordsRead += Math.max(0, s.wordsRead);
    totalActiveSeconds += Math.max(0, s.activeSeconds);
  }

  const averageWpm =
    totalActiveSeconds > 0 ? Math.round((totalWordsRead / totalActiveSeconds) * 60) : 0;

  return {
    totalSessions: sessions.length,
    totalWordsRead,
    totalActiveSeconds,
    averageWpm,
  };
}
