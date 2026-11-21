// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {OPEN_LIBRARY_USER_AGENT} from '../../config';
import {
  IDENTIFIED_MIN_INTERVAL_MS,
  OPEN_LIBRARY_CACHE_KEY,
  buildOpenLibraryCoverUrl,
  buildOpenLibrarySearchUrl,
  extractCoverCandidatesFromIdentifiers,
  extractCoverCandidatesFromSearchDocs,
  resetOpenLibraryCoverStateForTests,
  resolveBookCover,
} from '../openLibraryCovers';

describe('Open Library Covers & Search API service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    resetOpenLibraryCoverStateForTests();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('builds Covers API URLs with ?default=false for all supported keys and S/M/L sizes', () => {
    expect(buildOpenLibraryCoverUrl({key: 'isbn', value: '978-0-14-143951-8'}, 'S')).toBe(
      'https://covers.openlibrary.org/b/isbn/9780141439518-S.jpg?default=false'
    );
    expect(buildOpenLibraryCoverUrl({key: 'olid', value: 'OL7353617M'}, 'M')).toBe(
      'https://covers.openlibrary.org/b/olid/OL7353617M-M.jpg?default=false'
    );
    expect(buildOpenLibraryCoverUrl({key: 'id', value: '8225261'}, 'L')).toBe(
      'https://covers.openlibrary.org/b/id/8225261-L.jpg?default=false'
    );
    expect(buildOpenLibraryCoverUrl({key: 'oclc', value: '28419896'}, 'M')).toBe(
      'https://covers.openlibrary.org/b/oclc/28419896-M.jpg?default=false'
    );
    expect(buildOpenLibraryCoverUrl({key: 'lccn', value: '93005405'}, 'L')).toBe(
      'https://covers.openlibrary.org/b/lccn/93005405-L.jpg?default=false'
    );
  });

  it('orders cover identifier candidates strictly by isbn (ISBN-13 before ISBN-10) -> olid -> id -> oclc -> lccn', () => {
    const candidates = extractCoverCandidatesFromIdentifiers({
      lccn: '93005405',
      oclc: '28419896',
      id: 8225261,
      olid: 'OL7353617M',
      isbn: ['0141439513', '978-0-14-143951-8'],
    });

    expect(candidates).toEqual([
      {key: 'isbn', value: '9780141439518'},
      {key: 'isbn', value: '0141439513'},
      {key: 'olid', value: 'OL7353617M'},
      {key: 'id', value: '8225261'},
      {key: 'oclc', value: '28419896'},
      {key: 'lccn', value: '93005405'},
    ]);
  });

  it('builds Search API URL with restricted fields and limit=10', () => {
    const url = new URL(buildOpenLibrarySearchUrl('Dracula Bram Stoker'));
    expect(url.origin + url.pathname).toBe('https://openlibrary.org/search.json');
    expect(url.searchParams.get('q')).toBe('Dracula Bram Stoker');
    expect(url.searchParams.get('fields')).toBe(
      'key,title,author_name,isbn,cover_i,cover_edition_key'
    );
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('selects the best matching search doc and extracts candidates in key preference order', () => {
    const resolution = extractCoverCandidatesFromSearchDocs(
      [
        {
          key: '/works/OL1W',
          title: 'Dracula Study Guide',
          author_name: ['Someone Else'],
          cover_i: 11111,
        },
        {
          key: '/works/OL85892W',
          title: 'Dracula',
          author_name: ['Bram Stoker'],
          isbn: ['014143984X', '9780141439846'],
          cover_edition_key: 'OL7353617M',
          cover_i: 8225261,
        },
      ],
      'Dracula',
      'Bram Stoker'
    );

    expect(resolution.workKey).toBe('/works/OL85892W');
    expect(resolution.candidates).toEqual([
      {key: 'isbn', value: '9780141439846'},
      {key: 'isbn', value: '014143984X'},
      {key: 'olid', value: 'OL7353617M'},
      {key: 'id', value: '8225261'},
    ]);
  });

  it('sends X-User-Agent on Search API fetch requests, caches results in localStorage, and avoids repeat network calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL66554W',
              title: 'Pride and Prejudice',
              author_name: ['Jane Austen'],
              isbn: ['9780141439518'],
              cover_edition_key: 'OL24364628M',
              cover_i: 8231856,
            },
          ],
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}}
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await resolveBookCover({
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('https://openlibrary.org/search.json?');
    expect(calledUrl).toContain(
      'fields=key%2Ctitle%2Cauthor_name%2Cisbn%2Ccover_i%2Ccover_edition_key'
    );
    expect(calledUrl).toContain('limit=10');
    expect((calledInit.headers as Record<string, string>)['X-User-Agent']).toBe(
      OPEN_LIBRARY_USER_AGENT
    );
    expect(first.candidates[0]).toEqual({key: 'isbn', value: '9780141439518'});
    expect(localStorage.getItem(OPEN_LIBRARY_CACHE_KEY)).toContain('9780141439518');

    // Second lookup resolves from localStorage cache with zero network calls
    const second = await resolveBookCover({
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.candidates).toEqual(first.candidates);
  });

  it('skips Search API entirely when direct cover identifiers are provided', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await resolveBookCover({
      title: 'Meditations',
      author: 'Marcus Aurelius',
      identifiers: {olid: 'OL7353617M'},
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.candidates).toEqual([{key: 'olid', value: 'OL7353617M'}]);
  });

  it('enforces client-side rate limiting between sequential Search API requests', async () => {
    vi.useFakeTimers();
    const callTimestamps: number[] = [];

    const fetchMock = vi.fn().mockImplementation(async () => {
      callTimestamps.push(Date.now());
      return new Response(JSON.stringify({docs: []}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p1 = resolveBookCover({title: 'Book One', author: 'Author A'});
    const p2 = resolveBookCover({title: 'Book Two', author: 'Author B'});

    await vi.advanceTimersByTimeAsync(IDENTIFIED_MIN_INTERVAL_MS * 2);
    await Promise.all([p1, p2]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(callTimestamps[1] - callTimestamps[0]).toBeGreaterThanOrEqual(
      IDENTIFIED_MIN_INTERVAL_MS
    );
  });

  it('falls back cleanly to a simple CORS request when X-User-Agent triggers a TypeError, and skips fetch when offline', async () => {
    let attempts = 0;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      attempts += 1;
      if (attempts === 1 && init?.headers) {
        throw new TypeError('Failed to fetch (CORS preflight)');
      }
      return new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL1W',
              title: 'Walden',
              author_name: ['Henry David Thoreau'],
              cover_i: 6412345,
            },
          ],
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}}
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await resolveBookCover({
      title: 'Walden',
      author: 'Henry David Thoreau',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toEqual([{key: 'id', value: '6412345'}]);

    // When offline, no fetch is attempted
    fetchMock.mockClear();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    const offlineResult = await resolveBookCover({
      title: 'Uncached Offline Book',
      author: 'Nobody',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(offlineResult.candidates).toEqual([]);
  });

  it('handles HTTP 429 without caching a false negative miss', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Too Many Requests', {
        status: 429,
        headers: {'Retry-After': '1'},
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await resolveBookCover({
      title: 'Moby-Dick',
      author: 'Herman Melville',
    });

    expect(result.candidates).toEqual([]);
    expect(localStorage.getItem(OPEN_LIBRARY_CACHE_KEY)).toBeNull();
  });

  it('strips excerpt subtitles and attribution suffixes so legacy saved excerpts resolve cleanly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL1532333W',
              title: 'Meditations',
              author_name: ['Marcus Aurelius'],
              cover_edition_key: 'OL40348052M',
              cover_i: 13202688,
            },
          ],
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}}
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await resolveBookCover({
      title: 'Meditations — Book IV (Excerpt)',
      author: 'Marcus Aurelius · Translated by George Long (Public Domain)',
    });

    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    const parsed = new URL(calledUrl);
    expect(parsed.searchParams.get('q')).toBe('Meditations Marcus Aurelius');
    expect(result.candidates).toEqual([
      {key: 'olid', value: 'OL40348052M'},
      {key: 'id', value: '13202688'},
    ]);
  });
});
