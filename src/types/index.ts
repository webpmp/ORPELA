export type DocumentSource = 'paste' | 'txt' | 'pdf' | 'epub';

export type ReadingDescription = 'Accessible' | 'Intermediate' | 'Advanced' | 'Expert';

export const READING_DESCRIPTIONS: readonly ReadingDescription[] = [
  'Accessible',
  'Intermediate',
  'Advanced',
  'Expert',
] as const;

export interface LibraryDocument {
  id: string;
  title: string;
  author?: string;
  description?: ReadingDescription;
  bookId?: string;
  bookTitle?: string;
  excerptId?: string;
  publicationYear?: string;
  sourceAttribution?: string;
  publicDomainStatus?: string;
  source: DocumentSource;
  sourceMeta?: {
    fileName?: string;
    url?: string;
  };
  totalWords: number;
  contentHash: string;
  tokenizerVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentContent {
  documentId: string;
  text: string;
}

export interface ReadingProgress {
  documentId: string;
  wordIndex: number;
  tokenizerVersion: number;
  updatedAt: string;
}

export interface ReadingSession {
  id: string;
  documentId: string;
  startedAt: string;
  endedAt?: string;
  startWordIndex: number;
  endWordIndex: number;
  wordsRead: number;
  activeSeconds: number;
  averageWpm: number;
}

export interface SpeedRampConfig {
  enabled: boolean;
  stepWpm: number;
  everySeconds: number;
  maxWpm: number;
}

export interface ChunkExpansionConfig {
  enabled: boolean;
}

export type FontFamilyOption =
  | 'sans'
  | 'serif'
  | 'dyslexic'
  | 'mono'
  | 'system';

export interface ReaderSettings {
  wpm: number;
  wordsPerFlash: 1 | 2 | 3 | 4;
  orpEnabled: boolean;
  orpColor: string;
  punctuationPauseStrength: number; // 0 to 2
  paragraphAutoPause: boolean;
  contextPane: 'off' | 'faded';
  fontSize: number;
  fontWeight: number;
  fontFamily: FontFamilyOption | string;
  readingWidth: number;
  countdownSeconds: number; // 0 to 5
  maxWpmCap?: number;
  speedRamp: SpeedRampConfig;
  chunkExpansion: ChunkExpansionConfig;
  theme: 'dark' | 'light' | 'system';
  textColor?: string;
  backgroundColor?: string;
}

export interface ImportResult {
  title: string;
  author?: string;
  description?: ReadingDescription;
  bookId?: string;
  bookTitle?: string;
  excerptId?: string;
  publicationYear?: string;
  sourceAttribution?: string;
  publicDomainStatus?: string;
  text: string;
  source: DocumentSource;
  warnings: string[];
}

export interface DocumentWithProgress {
  document: LibraryDocument;
  progress?: ReadingProgress;
}

export interface OrpelaBackupPayload {
  schemaVersion: number;
  exportedAt: string;
  appName: string;
  documents: LibraryDocument[];
  contents: DocumentContent[];
  progress: ReadingProgress[];
  sessions: ReadingSession[];
  settings?: ReaderSettings;
}
