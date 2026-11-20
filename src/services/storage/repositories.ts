import {TOKENIZER_VERSION} from '../../engine/tokenizer';
import type {
  DocumentContent,
  DocumentWithProgress,
  ImportResult,
  LibraryDocument,
  ReaderSettings,
  ReadingProgress,
} from '../../types';
import {DEFAULT_READER_SETTINGS, db, type OrpelaDatabase} from './db';

export class StorageQuotaError extends Error {
  constructor(
    message = 'Browser storage is full. Export a backup or delete unused documents to free space.'
  ) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {name?: string; message?: string; inner?: unknown};
  if (e.name === 'QuotaExceededError') return true;
  if (e.message && /quota/i.test(e.message)) return true;
  if (e.inner && isQuotaExceededError(e.inner)) return true;
  return false;
}

function wrapQuotaError(err: unknown): never {
  if (isQuotaExceededError(err)) {
    throw new StorageQuotaError();
  }
  throw err;
}

export async function computeContentHash(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic FNV-1a fallback when SubtleCrypto is unavailable
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let persistenceRequested = false;

export async function requestPersistentStorage(): Promise<boolean> {
  if (persistenceRequested) return true;
  persistenceRequested = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Degrade silently where storage persistence API is unavailable
  }
  return false;
}

export async function listDocumentsWithProgress(
  database: OrpelaDatabase = db
): Promise<DocumentWithProgress[]> {
  // Explicitly only query documents and progress, never contents
  const [docs, progresses] = await Promise.all([
    database.documents.toArray(),
    database.progress.toArray(),
  ]);

  const progressMap = new Map<string, ReadingProgress>();
  for (const p of progresses) {
    progressMap.set(p.documentId, p);
  }

  return docs.map((document) => ({
    document,
    progress: progressMap.get(document.id),
  }));
}

export async function getDocumentRecord(
  documentId: string,
  database: OrpelaDatabase = db
): Promise<{
  document: LibraryDocument;
  content: DocumentContent;
  progress?: ReadingProgress;
} | null> {
  const [document, content, progress] = await Promise.all([
    database.documents.get(documentId),
    database.contents.get(documentId),
    database.progress.get(documentId),
  ]);

  if (!document || !content) return null;
  return {document, content, progress};
}

export function remapWordIndexOnVersionChange(
  savedWordIndex: number,
  savedTokenizerVersion: number,
  previousTotalWords: number,
  currentTotalWords: number
): {wordIndex: number; remapped: boolean} {
  if (savedTokenizerVersion === TOKENIZER_VERSION) {
    const clamped = Math.max(0, Math.min(Math.max(0, currentTotalWords - 1), savedWordIndex));
    return {wordIndex: clamped, remapped: false};
  }
  if (currentTotalWords <= 1 || previousTotalWords <= 1) {
    return {wordIndex: 0, remapped: true};
  }
  const pct = Math.max(0, Math.min(1, savedWordIndex / (previousTotalWords - 1)));
  return {
    wordIndex: Math.round(pct * (currentTotalWords - 1)),
    remapped: true,
  };
}

export async function saveImportedDocument(
  imported: ImportResult,
  totalWords: number,
  sourceMeta?: {fileName?: string; url?: string},
  database: OrpelaDatabase = db
): Promise<{document: LibraryDocument; duplicate: boolean}> {
  const contentHash = await computeContentHash(imported.text);
  const existing = await database.documents.where('contentHash').equals(contentHash).first();
  if (existing) {
    const needsMetaBackfill =
      (!existing.description && imported.description) ||
      (!existing.excerptId && imported.excerptId) ||
      (!existing.bookId && imported.bookId);
    if (needsMetaBackfill) {
      const updated: LibraryDocument = {
        ...existing,
        description: existing.description ?? imported.description,
        bookId: existing.bookId ?? imported.bookId,
        bookTitle: existing.bookTitle ?? imported.bookTitle,
        excerptId: existing.excerptId ?? imported.excerptId,
        publicationYear: existing.publicationYear ?? imported.publicationYear,
        sourceAttribution: existing.sourceAttribution ?? imported.sourceAttribution,
        publicDomainStatus: existing.publicDomainStatus ?? imported.publicDomainStatus,
        updatedAt: new Date().toISOString(),
      };
      await database.documents.put(updated);
      return {document: updated, duplicate: true};
    }
    return {document: existing, duplicate: true};
  }

  const now = new Date().toISOString();
  const doc: LibraryDocument = {
    id: generateId(),
    title: imported.title.trim() || 'Untitled',
    author: imported.author?.trim() || undefined,
    description: imported.description,
    bookId: imported.bookId,
    bookTitle: imported.bookTitle,
    excerptId: imported.excerptId,
    publicationYear: imported.publicationYear,
    sourceAttribution: imported.sourceAttribution,
    publicDomainStatus: imported.publicDomainStatus,
    source: imported.source,
    sourceMeta,
    totalWords,
    contentHash,
    tokenizerVersion: TOKENIZER_VERSION,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await database.transaction('rw', database.documents, database.contents, database.progress, async () => {
      await database.documents.put(doc);
      await database.contents.put({documentId: doc.id, text: imported.text});
      await database.progress.put({
        documentId: doc.id,
        wordIndex: 0,
        tokenizerVersion: TOKENIZER_VERSION,
        updatedAt: now,
      });
    });
    await requestPersistentStorage();
    return {document: doc, duplicate: false};
  } catch (err) {
    wrapQuotaError(err);
  }
}

export async function saveReadingProgress(
  documentId: string,
  wordIndex: number,
  database: OrpelaDatabase = db
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await database.progress.put({
      documentId,
      wordIndex: Math.max(0, Math.floor(wordIndex)),
      tokenizerVersion: TOKENIZER_VERSION,
      updatedAt: now,
    });
  } catch (err) {
    wrapQuotaError(err);
  }
}

export async function deleteDocumentBundle(
  documentId: string,
  database: OrpelaDatabase = db
): Promise<{
  document: LibraryDocument;
  content: DocumentContent;
  progress?: ReadingProgress;
} | null> {
  const snapshot = await getDocumentRecord(documentId, database);
  if (!snapshot) return null;

  await database.transaction(
    'rw',
    database.documents,
    database.contents,
    database.progress,
    database.sessions,
    async () => {
      await database.documents.delete(documentId);
      await database.contents.delete(documentId);
      await database.progress.delete(documentId);
      await database.sessions.where('documentId').equals(documentId).delete();
    }
  );
  return snapshot;
}

export async function restoreDeletedDocumentBundle(
  snapshot: {
    document: LibraryDocument;
    content: DocumentContent;
    progress?: ReadingProgress;
  },
  database: OrpelaDatabase = db
): Promise<void> {
  try {
    await database.transaction('rw', database.documents, database.contents, database.progress, async () => {
      await database.documents.put(snapshot.document);
      await database.contents.put(snapshot.content);
      if (snapshot.progress) {
        await database.progress.put(snapshot.progress);
      }
    });
  } catch (err) {
    wrapQuotaError(err);
  }
}

export async function loadGlobalSettings(
  database: OrpelaDatabase = db
): Promise<ReaderSettings> {
  const stored = await database.settings.get('global');
  if (!stored) {
    return {...DEFAULT_READER_SETTINGS};
  }
  return {
    ...DEFAULT_READER_SETTINGS,
    ...stored.value,
    speedRamp: {
      ...DEFAULT_READER_SETTINGS.speedRamp,
      ...(stored.value.speedRamp ?? {}),
    },
    chunkExpansion: {
      ...DEFAULT_READER_SETTINGS.chunkExpansion,
      ...(stored.value.chunkExpansion ?? {}),
    },
  };
}

export async function saveGlobalSettings(
  settings: ReaderSettings,
  database: OrpelaDatabase = db
): Promise<void> {
  try {
    await database.settings.put({
      id: 'global',
      value: settings,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    wrapQuotaError(err);
  }
}
