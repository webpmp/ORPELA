import Dexie, {type Table} from 'dexie';
import type {
  DocumentContent,
  LibraryDocument,
  ReaderSettings,
  ReadingProgress,
  ReadingSession,
} from '../../types';

export interface StoredSettingsRecord {
  id: string;
  value: ReaderSettings;
  updatedAt: string;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  wpm: 300,
  wordsPerFlash: 1,
  orpEnabled: true,
  orpColor: '#DC2626',
  punctuationPauseStrength: 1,
  paragraphAutoPause: false,
  contextPane: 'off',
  fontSize: 44,
  fontWeight: 500,
  fontFamily: 'sans',
  readingWidth: 680,
  countdownSeconds: 2,
  maxWpmCap: undefined,
  speedRamp: {
    enabled: false,
    stepWpm: 25,
    everySeconds: 30,
    maxWpm: 600,
  },
  chunkExpansion: {
    enabled: false,
  },
  theme: 'system',
  textColor: undefined,
  backgroundColor: undefined,
};

export class OrpelaDatabase extends Dexie {
  public documents!: Table<LibraryDocument, string>;
  public contents!: Table<DocumentContent, string>;
  public progress!: Table<ReadingProgress, string>;
  public sessions!: Table<ReadingSession, string>;
  public settings!: Table<StoredSettingsRecord, string>;

  constructor(name = 'orpela-db', options?: {indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange}) {
    super(name, options);

    // Version 1 schema: keep large document text in separate `contents` store
    // so library listing queries never read large text payloads.
    this.version(1).stores({
      documents: 'id, title, createdAt, updatedAt, contentHash',
      contents: 'documentId',
      progress: 'documentId, updatedAt',
      sessions: 'id, documentId, startedAt',
      settings: 'id',
    });
  }
}

export const db = new OrpelaDatabase();
