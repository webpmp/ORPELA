import {OPEN_LIBRARY_USER_AGENT} from '../config';

export const OPEN_LIBRARY_COVERS_BASE = 'https://covers.openlibrary.org/b';
export const OPEN_LIBRARY_SEARCH_BASE = 'https://openlibrary.org/search.json';
export const OPEN_LIBRARY_SEARCH_FIELDS = 'key,title,author_name,isbn,cover_i,cover_edition_key';
export const OPEN_LIBRARY_SEARCH_LIMIT = 10;
export const OPEN_LIBRARY_CACHE_KEY = 'orpela-openlibrary-covers-v2';

/**
 * Open Library enforces 1 req/sec by default and 3 req/sec for identified clients.
 * Keep spacing safely under each ceiling.
 */
export const IDENTIFIED_MIN_INTERVAL_MS = 350;
export const UNIDENTIFIED_MIN_INTERVAL_MS = 1050;
const CACHE_HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_MISS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 200;

export type OpenLibraryCoverKey = 'isbn' | 'olid' | 'id' | 'oclc' | 'lccn';
export type OpenLibraryCoverSize = 'S' | 'M' | 'L';

/**
 * Strict Open Library Covers API key preference order.
 */
export const COVER_KEY_PRIORITY: readonly OpenLibraryCoverKey[] = [
  'isbn',
  'olid',
  'id',
  'oclc',
  'lccn',
] as const;

export interface OpenLibraryCoverIdentifier {
  key: OpenLibraryCoverKey;
  value: string;
}

export interface OpenLibraryCoverIdentifiers {
  isbn?: string | readonly string[];
  olid?: string;
  id?: number | string;
  oclc?: string;
  lccn?: string;
}

export interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  cover_edition_key?: string;
}

export interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

export interface OpenLibraryCoverResolution {
  candidates: OpenLibraryCoverIdentifier[];
  workKey?: string;
  matchedTitle?: string;
}

interface CachedCoverEntry {
  candidates: OpenLibraryCoverIdentifier[];
  workKey?: string;
  matchedTitle?: string;
  fetchedAt: number;
}

type CoverCacheStore = Record<string, CachedCoverEntry>;

function normalizeIsbn(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]+/g, '').toUpperCase();
  if (/^\d{13}$/.test(cleaned)) return cleaned;
  if (/^\d{9}[\dX]$/.test(cleaned)) return cleaned;
  return null;
}

function normalizeIdentifierValue(key: OpenLibraryCoverKey, raw: string | number): string | null {
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  switch (key) {
    case 'isbn':
      return normalizeIsbn(trimmed);
    case 'olid':
      // Edition OLIDs look like OL7353617M (also allow general alphanumeric OLIDs safely)
      return /^OL[0-9A-Za-z]+$/.test(trimmed) ? trimmed : null;
    case 'id':
      return /^\d+$/.test(trimmed) && Number(trimmed) > 0 ? trimmed : null;
    case 'oclc':
    case 'lccn':
      return /^[0-9A-Za-z._-]+$/.test(trimmed) ? trimmed : null;
  }
}

function dedupeCandidates(
  candidates: OpenLibraryCoverIdentifier[]
): OpenLibraryCoverIdentifier[] {
  const seen = new Set<string>();
  const result: OpenLibraryCoverIdentifier[] = [];
  for (const item of candidates) {
    const token = `${item.key}:${item.value}`;
    if (!seen.has(token)) {
      seen.add(token);
      result.push(item);
    }
  }
  return result;
}

/**
 * Extracts ordered cover candidates strictly following Open Library key priority:
 * isbn (preferring ISBN-13 over ISBN-10) -> olid -> id -> oclc -> lccn.
 */
export function extractCoverCandidatesFromIdentifiers(
  identifiers?: OpenLibraryCoverIdentifiers
): OpenLibraryCoverIdentifier[] {
  if (!identifiers) return [];

  const candidates: OpenLibraryCoverIdentifier[] = [];

  for (const key of COVER_KEY_PRIORITY) {
    if (key === 'isbn' && identifiers.isbn) {
      const list = Array.isArray(identifiers.isbn) ? identifiers.isbn : [identifiers.isbn];
      const normalized = list
        .map((entry) => normalizeIsbn(entry))
        .filter((value): value is string => value !== null);

      // Prefer ISBN-13 before ISBN-10
      const isbn13 = normalized.filter((v) => v.length === 13);
      const isbn10 = normalized.filter((v) => v.length === 10);
      const ordered = [...isbn13, ...isbn10];

      // Keep at most 2 ISBN candidates so 404 failover doesn't spam covers.openlibrary.org
      for (const value of ordered.slice(0, 2)) {
        candidates.push({key: 'isbn', value});
      }
      continue;
    }

    const raw = identifiers[key];
    if (typeof raw === 'string' || typeof raw === 'number') {
      const normalized = normalizeIdentifierValue(key, raw);
      if (normalized) {
        candidates.push({key, value: normalized});
      }
    }
  }

  return dedupeCandidates(candidates);
}

/**
 * Builds an Open Library Covers API URL with `?default=false` so missing covers
 * return HTTP 404 instead of a 1x1 transparent pixel.
 */
export function buildOpenLibraryCoverUrl(
  identifier: OpenLibraryCoverIdentifier,
  size: OpenLibraryCoverSize = 'M'
): string {
  const value = normalizeIdentifierValue(identifier.key, identifier.value);
  if (!value) {
    throw new Error(`Invalid Open Library ${identifier.key} identifier: "${identifier.value}"`);
  }
  return `${OPEN_LIBRARY_COVERS_BASE}/${identifier.key}/${encodeURIComponent(value)}-${size}.jpg?default=false`;
}

/**
 * Builds a minimal Open Library Search API URL restricted with `fields` and `limit=10`.
 */
export function buildOpenLibrarySearchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query.trim(),
    fields: OPEN_LIBRARY_SEARCH_FIELDS,
    limit: String(OPEN_LIBRARY_SEARCH_LIMIT),
  });
  return `${OPEN_LIBRARY_SEARCH_BASE}?${params.toString()}`;
}

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips excerpt/subtitle suffixes (e.g. "Meditations — Book IV (Excerpt)") so
 * Open Library title searches match the underlying work reliably.
 */
export function cleanSearchTitle(title: string): string {
  const withoutParens = title.replace(/\s*\((?:excerpt|abridged|sample)\)\s*$/i, '').trim();
  const primary = withoutParens.split(/\s+[—–-]\s+|\s*:\s+/)[0]?.trim();
  return primary && primary.length >= 2 ? primary : withoutParens;
}

/**
 * Strips attribution/translator suffixes (e.g. "Marcus Aurelius · Translated by George Long")
 * so Open Library author queries stay focused on the author's name.
 */
export function cleanSearchAuthor(author?: string): string | undefined {
  if (!author) return undefined;
  const primary = author
    .split(/\s*[·|]\s*/)[0]
    ?.replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return primary || undefined;
}

function scoreSearchDoc(doc: OpenLibrarySearchDoc, targetTitle: string, targetAuthor?: string): number {
  const hasAnyCover = Boolean(doc.cover_i || doc.cover_edition_key || (doc.isbn && doc.isbn.length > 0));
  if (!hasAnyCover) return -1;

  let score = 0;
  const docTitle = normalizeMatchText(doc.title ?? '');
  const normTitle = normalizeMatchText(targetTitle);

  if (docTitle === normTitle) {
    score += 100;
  } else if (docTitle && normTitle && (docTitle.includes(normTitle) || normTitle.includes(docTitle))) {
    score += 65;
  } else if (docTitle && normTitle) {
    const titleWords = normTitle.split(' ').filter((w) => w.length > 2);
    const matchedWords = titleWords.filter((w) => docTitle.includes(w)).length;
    if (titleWords.length > 0) {
      score += Math.round((matchedWords / titleWords.length) * 45);
    }
  }

  if (targetAuthor && doc.author_name && doc.author_name.length > 0) {
    const normAuthor = normalizeMatchText(targetAuthor);
    const authorTokens = normAuthor.split(' ').filter((w) => w.length > 1);
    const lastToken = authorTokens[authorTokens.length - 1] ?? normAuthor;
    const docAuthors = doc.author_name.map(normalizeMatchText);
    if (docAuthors.some((a) => a === normAuthor)) {
      score += 50;
    } else if (docAuthors.some((a) => a.includes(lastToken))) {
      score += 35;
    }
  }

  // Prefer results confirmed by Open Library to have a scanned cover
  if (doc.cover_edition_key) score += 15;
  if (doc.cover_i) score += 12;
  if (doc.isbn && doc.isbn.length > 0) score += 8;

  return score;
}

/**
 * Selects the best matching Open Library search document and returns cover
 * candidates in strict key preference order (isbn -> olid -> id).
 */
export function extractCoverCandidatesFromSearchDocs(
  docs: readonly OpenLibrarySearchDoc[],
  title: string,
  author?: string
): OpenLibraryCoverResolution {
  let bestDoc: OpenLibrarySearchDoc | null = null;
  let bestScore = -1;

  for (const doc of docs) {
    const score = scoreSearchDoc(doc, title, author);
    if (score > bestScore) {
      bestScore = score;
      bestDoc = doc;
    }
  }

  if (!bestDoc || bestScore < 0) {
    return {candidates: []};
  }

  const candidates = extractCoverCandidatesFromIdentifiers({
    isbn: bestDoc.isbn,
    olid: bestDoc.cover_edition_key,
    id: bestDoc.cover_i,
  });

  return {
    candidates,
    workKey: bestDoc.key,
    matchedTitle: bestDoc.title,
  };
}

// --- Persistent localStorage cache ---

function makeCacheKey(title: string, author?: string): string {
  return `${normalizeMatchText(title)}::${normalizeMatchText(author ?? '')}`;
}

function readCacheStore(): CoverCacheStore {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OPEN_LIBRARY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CoverCacheStore;
    }
  } catch {
    // Ignore storage read errors (private mode, quota, corrupt data)
  }
  return {};
}

function writeCacheStore(store: CoverCacheStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const keys = Object.keys(store);
    if (keys.length > MAX_CACHE_ENTRIES) {
      keys
        .sort((a, b) => (store[a]?.fetchedAt ?? 0) - (store[b]?.fetchedAt ?? 0))
        .slice(0, keys.length - MAX_CACHE_ENTRIES)
        .forEach((oldestKey) => {
          delete store[oldestKey];
        });
    }
    localStorage.setItem(OPEN_LIBRARY_CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota/storage errors
  }
}

function getCachedResolution(cacheKey: string, now = Date.now()): OpenLibraryCoverResolution | null {
  const store = readCacheStore();
  const entry = store[cacheKey];
  if (!entry || !Array.isArray(entry.candidates)) return null;

  const ttl = entry.candidates.length > 0 ? CACHE_HIT_TTL_MS : CACHE_MISS_TTL_MS;
  if (now - entry.fetchedAt > ttl) {
    return null;
  }

  return {
    candidates: entry.candidates,
    workKey: entry.workKey,
    matchedTitle: entry.matchedTitle,
  };
}

function setCachedResolution(
  cacheKey: string,
  resolution: OpenLibraryCoverResolution,
  now = Date.now()
): void {
  const store = readCacheStore();
  store[cacheKey] = {
    candidates: resolution.candidates,
    workKey: resolution.workKey,
    matchedTitle: resolution.matchedTitle,
    fetchedAt: now,
  };
  writeCacheStore(store);
}

// --- Client-side serialized rate limiter & in-flight deduplication ---

let nextAllowedRequestAt = 0;
let rateLimitChain: Promise<void> = Promise.resolve();
let customHeaderRejected = false;
const inFlightLookups = new Map<string, Promise<OpenLibraryCoverResolution>>();

function waitMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, {once: true});
  });
}

function getMinRequestIntervalMs(): number {
  return customHeaderRejected ? UNIDENTIFIED_MIN_INTERVAL_MS : IDENTIFIED_MIN_INTERVAL_MS;
}

function scheduleRateLimitedTask<T>(
  task: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const run = async (): Promise<T> => {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const waitTime = Math.max(0, nextAllowedRequestAt - Date.now());
    if (waitTime > 0) {
      await waitMs(waitTime, signal);
    }
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    nextAllowedRequestAt = Date.now() + getMinRequestIntervalMs();
    return task();
  };

  const resultPromise = rateLimitChain.then(run, run);
  rateLimitChain = resultPromise.then(
    () => undefined,
    () => undefined
  );
  return resultPromise;
}

function parseRetryAfterMs(headerValue: string | null): number {
  if (!headerValue) return 2000;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 60_000);
  }
  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) {
    return Math.min(Math.max(dateMs - Date.now(), 1000), 60_000);
  }
  return 2000;
}

async function fetchOpenLibrarySearch(
  url: string,
  signal?: AbortSignal
): Promise<Response | null> {
  if (!customHeaderRejected) {
    try {
      return await fetch(url, {
        headers: {
          'X-User-Agent': OPEN_LIBRARY_USER_AGENT,
        },
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      // If a browser rejects the X-User-Agent CORS preflight while online, fall back once
      // to a simple CORS request and slow the client limiter to < 1 req/sec.
      if (
        error instanceof TypeError &&
        (typeof navigator === 'undefined' || navigator.onLine !== false)
      ) {
        customHeaderRejected = true;
        nextAllowedRequestAt = Math.max(
          nextAllowedRequestAt,
          Date.now() + UNIDENTIFIED_MIN_INTERVAL_MS
        );
        try {
          return await fetch(url, {signal});
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  try {
    return await fetch(url, {signal});
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return null;
  }
}

export interface ResolveBookCoverInput {
  title: string;
  author?: string;
  identifiers?: OpenLibraryCoverIdentifiers;
  signal?: AbortSignal;
}

/**
 * Resolves Open Library cover candidates for a book:
 * 1. Direct identifiers (`isbn`, `olid`, `id`, `oclc`, `lccn`) resolve immediately with zero network calls.
 * 2. Cached title+author lookups resolve immediately from localStorage.
 * 3. Uncached lookups query the Open Library Search API through a deduplicated, rate-limited queue
 *    sending `X-User-Agent: Orpela (webpmp@gmail.com)`.
 */
export async function resolveBookCover({
  title,
  author,
  identifiers,
  signal,
}: ResolveBookCoverInput): Promise<OpenLibraryCoverResolution> {
  const directCandidates = extractCoverCandidatesFromIdentifiers(identifiers);
  if (directCandidates.length > 0) {
    return {candidates: directCandidates};
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return {candidates: []};
  }

  const cleanedTitle = cleanSearchTitle(trimmedTitle);
  const cleanedAuthor = cleanSearchAuthor(author);

  const cacheKey = makeCacheKey(cleanedTitle, cleanedAuthor);
  const cached = getCachedResolution(cacheKey);
  if (cached) {
    return cached;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {candidates: []};
  }

  if (typeof fetch !== 'function') {
    return {candidates: []};
  }

  const existingInFlight = inFlightLookups.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const query = cleanedAuthor ? `${cleanedTitle} ${cleanedAuthor}` : cleanedTitle;
  const searchUrl = buildOpenLibrarySearchUrl(query);

  const lookupPromise = scheduleRateLimitedTask(async (): Promise<OpenLibraryCoverResolution> => {
    const response = await fetchOpenLibrarySearch(searchUrl, signal);
    if (!response) {
      return {candidates: []};
    }

    if (response.status === 429) {
      const backoffMs = parseRetryAfterMs(response.headers.get('Retry-After'));
      nextAllowedRequestAt = Math.max(nextAllowedRequestAt, Date.now() + backoffMs);
      return {candidates: []};
    }

    if (!response.ok) {
      return {candidates: []};
    }

    const payload = (await response.json()) as OpenLibrarySearchResponse;
    const docs = Array.isArray(payload?.docs) ? payload.docs : [];
    const resolution = extractCoverCandidatesFromSearchDocs(docs, cleanedTitle, cleanedAuthor);
    setCachedResolution(cacheKey, resolution);
    return resolution;
  }, signal)
    .catch((): OpenLibraryCoverResolution => ({candidates: []}))
    .finally(() => {
      inFlightLookups.delete(cacheKey);
    });

  inFlightLookups.set(cacheKey, lookupPromise);
  return lookupPromise;
}

/**
 * Resets internal rate-limiter and in-flight state for isolated unit tests.
 */
export function resetOpenLibraryCoverStateForTests(): void {
  nextAllowedRequestAt = 0;
  rateLimitChain = Promise.resolve();
  customHeaderRejected = false;
  inFlightLookups.clear();
}
