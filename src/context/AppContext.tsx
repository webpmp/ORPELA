import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {tokenize} from '../engine/tokenizer';
import {SAMPLE_PASSAGES, loadSampleImportResult, type SamplePassage} from '../services/samples';
import {listAllSessions} from '../services/sessions';
import {DEFAULT_READER_SETTINGS} from '../services/storage/db';
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
  setIsPlaybackActive: (active: boolean) => void;
  updateSettings: (patch: Partial<ReaderSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  saveImportToLibrary: (
    imported: ImportResult,
    sourceMeta?: {fileName?: string; url?: string}
  ) => Promise<{document: LibraryDocument; duplicate: boolean}>;
  loadSamplePassage: (sample?: SamplePassage) => Promise<LibraryDocument>;
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
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [undoPayload, setUndoPayload] = useState<UndoDeleteState | null>(null);

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
        const [loadedSettings, docs, sess] = await Promise.all([
          loadGlobalSettings(),
          listDocumentsWithProgress(),
          listAllSessions(),
        ]);
        if (!active) return;
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

  const updateSettings = useCallback(
    async (patch: Partial<ReaderSettings>) => {
      setSettings((prev) => {
        const next: ReaderSettings = {
          ...prev,
          ...patch,
          speedRamp: patch.speedRamp ? {...prev.speedRamp, ...patch.speedRamp} : prev.speedRamp,
          chunkExpansion: patch.chunkExpansion
            ? {...prev.chunkExpansion, ...patch.chunkExpansion}
            : prev.chunkExpansion,
        };
        void saveGlobalSettings(next).catch((err) => {
          setToastMessage(err instanceof Error ? err.message : 'Unable to save settings.');
        });
        return next;
      });
    },
    []
  );

  const resetSettings = useCallback(async () => {
    const next = {...DEFAULT_READER_SETTINGS};
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
        setIsPlaybackActive,
        updateSettings,
        resetSettings,
        refreshLibrary,
        saveImportToLibrary,
        loadSamplePassage,
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
