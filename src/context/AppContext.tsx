import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {WELCOME_SEEN_KEY} from '../content/guidance';
import {tokenize} from '../engine/tokenizer';
import {
  SAMPLE_PASSAGES,
  loadCatalogExcerptImportResult,
  loadSampleImportResult,
  type SamplePassage,
} from '../services/samples';
import {listAllSessions} from '../services/sessions';
import {DEFAULT_READER_SETTINGS, db} from '../services/storage/db';
import {
  deleteDocumentBundle,
  listDocumentsWithProgress,
  loadGlobalSettings,
  restoreDeletedDocumentBundle,
  saveGlobalSettings,
  saveImportedDocument,
} from '../services/storage/repositories';
import type {
  DocumentContent,
  DocumentWithProgress,
  ImportResult,
  LibraryDocument,
  ReaderSettings,
  ReadingProgress,
  ReadingSession,
} from '../types';

interface UndoDeleteState {
  document: LibraryDocument;
  content: DocumentContent;
  progress?: ReadingProgress;
}

interface AppContextValue {
  isReady: boolean;
  settings: ReaderSettings;
  documents: DocumentWithProgress[];
  sessions: ReadingSession[];
  isPlaybackActive: boolean;
  toastMessage: string | null;
  undoPayload: UndoDeleteState | null;
  welcomeShownThisVisit: boolean;
  welcomeReopenRequested: boolean;
  markWelcomeShownThisVisit: () => void;
  requestReopenWelcome: () => void;
  consumeWelcomeReopenRequest: () => void;
  setIsPlaybackActive: (active: boolean) => void;
  updateSettings: (patch: Partial<ReaderSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  saveImportToLibrary: (
    imported: ImportResult,
    sourceMeta?: {fileName?: string; url?: string}
  ) => Promise<{document: LibraryDocument; duplicate: boolean}>;
  loadSamplePassage: (sample?: SamplePassage) => Promise<LibraryDocument>;
  openPublicDomainExcerpt: (excerptId: string) => Promise<LibraryDocument>;
  deleteDocumentWithUndo: (documentId: string) => Promise<void>;
  undoLastDelete: () => Promise<void>;
  dismissUndo: () => void;
  showToast: (msg: string) => void;
  dismissToast: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function applyThemeToDom(theme: ReaderSettings['theme']): void {
  const root = window.document.documentElement;
  const prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);

  root.classList.toggle('dark', shouldBeDark);
  try {
    localStorage.setItem('orpela-theme', theme);
  } catch {
    // Ignore storage flag failure
  }
  const metaTheme = window.document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', shouldBeDark ? '#0B0D10' : '#F8F9FA');
  }
}

export const AppProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const settingsRef = useRef<ReaderSettings>(DEFAULT_READER_SETTINGS);
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [undoPayload, setUndoPayload] = useState<UndoDeleteState | null>(null);
  const [welcomeShownThisVisit, setWelcomeShownThisVisit] = useState(false);
  const [welcomeReopenRequested, setWelcomeReopenRequested] = useState(false);

  const refreshLibrary = useCallback(async () => {
    const [docs, sess] = await Promise.all([
      listDocumentsWithProgress(),
      listAllSessions(),
    ]);
    setDocuments(docs);
    setSessions(sess);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [loadedSettings, rawDocs, sess] = await Promise.all([
          loadGlobalSettings(),
          listDocumentsWithProgress(),
          listAllSessions(),
        ]);
        if (!active) return;

        // Backfill Description metadata on any previously saved default sample documents
        const docs = await Promise.all(
          rawDocs.map(async (entry) => {
            if (entry.document.description && entry.document.excerptId) {
              return entry;
            }
            const matchedSample = SAMPLE_PASSAGES.find(
              (sample) =>
                entry.document.sourceMeta?.fileName === sample.filePath ||
                entry.document.title === sample.title
            );
            if (!matchedSample) {
              return entry;
            }
            const updatedDoc: LibraryDocument = {
              ...entry.document,
              description: entry.document.description ?? matchedSample.description,
              bookId: entry.document.bookId ?? matchedSample.bookId,
              bookTitle: entry.document.bookTitle ?? matchedSample.bookTitle,
              excerptId: entry.document.excerptId ?? matchedSample.id,
              publicationYear: entry.document.publicationYear ?? matchedSample.publicationYear,
              sourceAttribution:
                entry.document.sourceAttribution ?? matchedSample.sourceAttribution,
              publicDomainStatus:
                entry.document.publicDomainStatus ?? matchedSample.publicDomainStatus,
            };
            try {
              await db.documents.put(updatedDoc);
            } catch {
              // Ignore write failure on metadata backfill
            }
            return {...entry, document: updatedDoc};
          })
        );
        if (!active) return;

        settingsRef.current = loadedSettings;
        setSettings(loadedSettings);
        applyThemeToDom(loadedSettings.theme);
        setDocuments(docs);
        setSessions(sess);
      } finally {
        if (active) setIsReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyThemeToDom(settings.theme);
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyThemeToDom('system');
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [settings.theme]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const markWelcomeShownThisVisit = useCallback(() => {
    setWelcomeShownThisVisit(true);
  }, []);

  const requestReopenWelcome = useCallback(() => {
    try {
      localStorage.removeItem(WELCOME_SEEN_KEY);
    } catch {
      // Ignore storage failure
    }
    setWelcomeReopenRequested(true);
  }, []);

  const consumeWelcomeReopenRequest = useCallback(() => {
    setWelcomeReopenRequested(false);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<ReaderSettings>) => {
    const prev = settingsRef.current;
    const next: ReaderSettings = {
      ...prev,
      ...patch,
      speedRamp: patch.speedRamp ? {...prev.speedRamp, ...patch.speedRamp} : prev.speedRamp,
      chunkExpansion: patch.chunkExpansion
        ? {...prev.chunkExpansion, ...patch.chunkExpansion}
        : prev.chunkExpansion,
    };
    settingsRef.current = next;
    setSettings(next);
    try {
      await saveGlobalSettings(next);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Unable to save settings.');
    }
  }, []);

  const resetSettings = useCallback(async () => {
    const next = {...DEFAULT_READER_SETTINGS};
    settingsRef.current = next;
    setSettings(next);
    await saveGlobalSettings(next);
    setToastMessage('Reader settings reset to defaults.');
  }, []);

  const saveImportToLibrary = useCallback(
    async (imported: ImportResult, sourceMeta?: {fileName?: string; url?: string}) => {
      const tokenized = tokenize(imported.text);
      if (tokenized.tokens.length === 0) {
        throw new Error('The imported text contains no readable words.');
      }
      const res = await saveImportedDocument(imported, tokenized.tokens.length, sourceMeta);
      await refreshLibrary();
      return res;
    },
    [refreshLibrary]
  );

  const loadSamplePassage = useCallback(
    async (sample: SamplePassage = SAMPLE_PASSAGES[0]) => {
      const imported = await loadSampleImportResult(sample);
      const {document} = await saveImportToLibrary(imported, {fileName: sample.filePath});
      return document;
    },
    [saveImportToLibrary]
  );

  const openPublicDomainExcerpt = useCallback(
    async (excerptId: string) => {
      const imported = await loadCatalogExcerptImportResult(excerptId);
      const fileName =
        excerptId === SAMPLE_PASSAGES[0].id
          ? SAMPLE_PASSAGES[0].filePath
          : `public-domain/${imported.bookId ?? 'collection'}/${excerptId}.txt`;
      const {document} = await saveImportToLibrary(imported, {fileName});
      return document;
    },
    [saveImportToLibrary]
  );

  const deleteDocumentWithUndo = useCallback(
    async (documentId: string) => {
      const snapshot = await deleteDocumentBundle(documentId);
      if (snapshot) {
        setUndoPayload(snapshot);
        await refreshLibrary();
      }
    },
    [refreshLibrary]
  );

  const undoLastDelete = useCallback(async () => {
    if (!undoPayload) return;
    await restoreDeletedDocumentBundle(undoPayload);
    setUndoPayload(null);
    await refreshLibrary();
    setToastMessage('Document restored.');
  }, [undoPayload, refreshLibrary]);

  const dismissUndo = useCallback(() => {
    setUndoPayload(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        isReady,
        settings,
        documents,
        sessions,
        isPlaybackActive,
        toastMessage,
        undoPayload,
        welcomeShownThisVisit,
        welcomeReopenRequested,
        markWelcomeShownThisVisit,
        requestReopenWelcome,
        consumeWelcomeReopenRequest,
        setIsPlaybackActive,
        updateSettings,
        resetSettings,
        refreshLibrary,
        saveImportToLibrary,
        loadSamplePassage,
        openPublicDomainExcerpt,
        deleteDocumentWithUndo,
        undoLastDelete,
        dismissUndo,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return ctx;
}
