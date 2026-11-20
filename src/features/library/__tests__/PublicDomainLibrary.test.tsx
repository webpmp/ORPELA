// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import App from '../../../App';
import {WELCOME_SEEN_KEY} from '../../../content/guidance';
import {
  DEFAULT_EXCERPT_ID,
  PUBLIC_DOMAIN_BOOKS,
  PUBLIC_DOMAIN_EXCERPTS,
  loadPublicDomainExcerptText,
} from '../../../content/publicDomainCatalog';
import {tokenize} from '../../../engine/tokenizer';
import {SAMPLE_PASSAGES} from '../../../services/samples';
import {db} from '../../../services/storage/db';
import {READING_DESCRIPTIONS} from '../../../types';

function installBrowserStubs() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}

async function resetAppState() {
  localStorage.clear();
  localStorage.setItem(WELCOME_SEEN_KEY, '1');
  window.location.hash = '#/';
  await db.documents.clear();
  await db.contents.clear();
  await db.progress.clear();
  await db.sessions.clear();
  await db.settings.clear();
}

describe('public-domain collection & Description filtering', () => {
  beforeEach(async () => {
    installBrowserStubs();
    await resetAppState();
  });

  afterEach(() => {
    cleanup();
  });

  it('contains all 22 public-domain books, 110 new excerpts (500-1000 words each), and the preserved default Meditations Book IV excerpt without duplication', async () => {
    expect(PUBLIC_DOMAIN_BOOKS).toHaveLength(22);

    const defaultExcerpts = PUBLIC_DOMAIN_EXCERPTS.filter((e) => e.id === DEFAULT_EXCERPT_ID);
    expect(defaultExcerpts).toHaveLength(1);
    expect(defaultExcerpts[0].bookId).toBe('meditations');
    expect(defaultExcerpts[0].isDefault).toBe(true);
    expect(defaultExcerpts[0].description).toBe('Advanced');
    expect(SAMPLE_PASSAGES[0].id).toBe(DEFAULT_EXCERPT_ID);
    expect(SAMPLE_PASSAGES[0].description).toBe('Advanced');

    const newExcerpts = PUBLIC_DOMAIN_EXCERPTS.filter((e) => !e.isDefault);
    expect(newExcerpts).toHaveLength(110);

    // Every book has 5 new excerpts (Meditations has 5 new + 1 preserved default = 6)
    for (const book of PUBLIC_DOMAIN_BOOKS) {
      const bookNew = newExcerpts.filter((e) => e.bookId === book.id);
      expect(bookNew).toHaveLength(5);
      expect(book.sourceName).toMatch(/Project Gutenberg/);
      expect(book.publicDomainStatus).toContain('Public Domain');
      expect(book.publicationYear.length).toBeGreaterThan(0);
    }

    // Every excerpt has a valid Description, non-empty verbatim text, and 500-1000 words
    const validDescriptions = new Set<string>(READING_DESCRIPTIONS);
    const seenDescriptions = new Set<string>();
    const booksWithMixedDescriptions = new Set<string>();

    for (const book of PUBLIC_DOMAIN_BOOKS) {
      const bookDescs = new Set(
        PUBLIC_DOMAIN_EXCERPTS.filter((e) => e.bookId === book.id).map((e) => e.description)
      );
      if (bookDescs.size > 1) {
        booksWithMixedDescriptions.add(book.id);
      }
    }
    expect(booksWithMixedDescriptions.size).toBeGreaterThanOrEqual(10);

    for (const ex of newExcerpts) {
      expect(validDescriptions.has(ex.description)).toBe(true);
      seenDescriptions.add(ex.description);
      const text = await loadPublicDomainExcerptText(ex.bookId, ex.id);
      expect(text).toBeTruthy();
      const count = tokenize(text!).tokens.length;
      expect(count).toBeGreaterThanOrEqual(500);
      expect(count).toBeLessThanOrEqual(1000);
      expect(count).toBe(ex.wordCount);
      // Confirm no duplicate of the preserved default Meditations Book IV passage
      expect(text).not.toContain('Men seek retreats for themselves');
    }

    expect(seenDescriptions.size).toBe(4);
  });

  it('renders all 22 books, supports all four Description filters and All Descriptions, and includes the preserved default excerpt appropriately', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', {name: 'Library'})).toBeTruthy();
    });

    // All 22 books are visible under All Descriptions and collapsed by default
    for (const book of PUBLIC_DOMAIN_BOOKS) {
      expect(screen.getByTestId(`book-card-${book.id}`)).toBeTruthy();
    }
    expect(screen.getByRole('button', {name: 'Expand all'})).toBeTruthy();
    expect(screen.queryByTestId(`excerpt-row-${DEFAULT_EXCERPT_ID}`)).toBeNull();

    // Expand all books to inspect excerpt filtering
    fireEvent.click(screen.getByRole('button', {name: 'Expand all'}));
    expect(screen.getByRole('button', {name: 'Collapse all'})).toBeTruthy();

    // Never uses "Level" terminology or numbered levels
    const filterGroup = screen.getByRole('group', {name: 'Filter by Description'});
    expect(filterGroup.textContent).not.toMatch(/Level\s*[1-4]?/i);

    // Preserved default Meditations Book IV excerpt is present under All Descriptions
    expect(screen.getByTestId(`excerpt-row-${DEFAULT_EXCERPT_ID}`)).toBeTruthy();

    // Filter by Accessible -> default excerpt (Advanced) is hidden, Accessible excerpts shown
    fireEvent.click(screen.getByTestId('description-filter-Accessible'));
    expect(screen.queryByTestId(`excerpt-row-${DEFAULT_EXCERPT_ID}`)).toBeNull();
    expect(screen.getByTestId('excerpt-row-sherlock-bohemia-opening')).toBeTruthy();
    expect(screen.queryByTestId('excerpt-row-republic-allegory-cave')).toBeNull();

    // Filter by Intermediate -> default excerpt hidden, Intermediate excerpts shown
    fireEvent.click(screen.getByTestId('description-filter-Intermediate'));
    expect(screen.queryByTestId(`excerpt-row-${DEFAULT_EXCERPT_ID}`)).toBeNull();
    expect(screen.getByTestId('excerpt-row-meditations-book-2-morning')).toBeTruthy();

    // Filter by Advanced -> preserved default Meditations Book IV excerpt appears!
    fireEvent.click(screen.getByTestId('description-filter-Advanced'));
    expect(screen.getByTestId(`excerpt-row-${DEFAULT_EXCERPT_ID}`)).toBeTruthy();
    expect(screen.queryByTestId('excerpt-row-sherlock-bohemia-opening')).toBeNull();

    // Filter by Expert -> default excerpt hidden, Expert excerpts shown
    fireEvent.click(screen.getByTestId('description-filter-Expert'));
    expect(screen.queryByTestId(`excerpt-row-${DEFAULT_EXCERPT_ID}`)).toBeNull();
    expect(screen.getByTestId('excerpt-row-republic-allegory-cave')).toBeTruthy();

    // All Descriptions restores complete 22-book collection including default excerpt
    fireEvent.click(screen.getByTestId('description-filter-all'));
    expect(screen.getByTestId(`excerpt-row-${DEFAULT_EXCERPT_ID}`)).toBeTruthy();
    expect(screen.getByTestId('excerpt-row-sherlock-bohemia-opening')).toBeTruthy();
    expect(screen.getByTestId('excerpt-row-republic-allegory-cave')).toBeTruthy();
  });

  it('combines Description filtering with search and sorting, and opens curated excerpts cleanly in the reader without duplicating the default excerpt', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', {name: 'Library'})).toBeTruthy();
    });

    // Combine search ("Marcus Aurelius") + Description ("Advanced")
    const searchInput = screen.getByRole('searchbox', {name: 'Search library'});
    fireEvent.change(searchInput, {target: {value: 'Marcus Aurelius'}});
    fireEvent.click(screen.getByTestId('description-filter-Advanced'));

    expect(screen.getByTestId('book-card-meditations')).toBeTruthy();
    expect(screen.queryByTestId('book-card-sherlock-holmes')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Expand Meditations'}));
    expect(screen.getByTestId(`excerpt-row-${DEFAULT_EXCERPT_ID}`)).toBeTruthy();
    expect(screen.getByTestId('excerpt-row-meditations-book-3-present')).toBeTruthy();
    expect(screen.queryByTestId('excerpt-row-meditations-book-2-morning')).toBeNull();

    // Clear filters and verify Title sorting reorders books alphabetically
    fireEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
    fireEvent.click(screen.getByRole('button', {name: 'Title'}));
    const cards = screen.getAllByTestId(/^book-card-/);
    expect(cards).toHaveLength(22);
    expect(cards[0].getAttribute('data-testid')).toBe('book-card-dracula');

    // Load sample text via existing button, then click Read on default excerpt -> deduplicated (still 1 doc)
    fireEvent.click(screen.getByRole('button', {name: 'Load sample text'}));
    await waitFor(async () => {
      const docs = await db.documents.toArray();
      expect(docs).toHaveLength(1);
      expect(docs[0].description).toBe('Advanced');
      expect(docs[0].excerptId).toBe(DEFAULT_EXCERPT_ID);
    });

    // Saved document also responds to Description filter
    fireEvent.click(screen.getByTestId('description-filter-Accessible'));
    expect(screen.getByText('No saved documents match the current filters.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('description-filter-Advanced'));
    const savedSection = screen.getByRole('region', {name: 'Saved documents'});
    expect(within(savedSection).getByText('Meditations — Book IV (Excerpt)')).toBeTruthy();

    // Open a new curated excerpt in the reader and verify focal-stage renders cleanly
    fireEvent.click(screen.getByTestId('description-filter-all'));
    fireEvent.click(
      screen.getByRole('button', {name: 'Expand The Adventures of Sherlock Holmes'})
    );
    const sherlockRow = screen.getByTestId('excerpt-row-sherlock-bohemia-opening');
    fireEvent.click(within(sherlockRow).getByRole('button', {name: /Read/i}));

    await waitFor(() => {
      expect(window.location.hash).toMatch(/^#\/read\//);
      expect(screen.getByTestId('focal-stage')).toBeTruthy();
    });
  });

  it('orders Library sections as Metrics, Saved Reading, Search, then single-column Public-Domain Collection collapsed by default with working expand/collapse', async () => {
    const now = new Date().toISOString();
    await db.documents.put({
      id: 'saved-doc-1',
      title: 'Saved Sample',
      source: 'paste',
      totalWords: 120,
      contentHash: 'saved-hash-1',
      tokenizerVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.contents.put({
      documentId: 'saved-doc-1',
      text: 'Sample saved reading text.',
    });
    await db.sessions.put({
      id: 'session-1',
      documentId: 'saved-doc-1',
      startedAt: now,
      endedAt: now,
      startWordIndex: 0,
      endWordIndex: 100,
      wordsRead: 100,
      activeSeconds: 20,
      averageWpm: 300,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('region', {name: 'Reading statistics'})).toBeTruthy();
    });

    const metricsSection = screen.getByRole('region', {name: 'Reading statistics'});
    const savedSection = screen.getByRole('region', {name: 'Saved documents'});
    const filterSection = screen.getByRole('region', {name: 'Filter library'});
    const collectionSection = screen.getByRole('region', {name: 'Public-domain collection'});

    // Verify all 4 reading metrics are displayed
    expect(within(metricsSection).getByText('Words read')).toBeTruthy();
    expect(within(metricsSection).getByText('Active time')).toBeTruthy();
    expect(within(metricsSection).getByText('Average pace')).toBeTruthy();
    expect(within(metricsSection).getByText('Sessions')).toBeTruthy();

    // Verify exact DOM order: Metrics -> Saved Reading -> Search -> Public-Domain Collection
    expect(
      metricsSection.compareDocumentPosition(savedSection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      savedSection.compareDocumentPosition(filterSection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      filterSection.compareDocumentPosition(collectionSection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Verify single-column layout at all viewport widths (no multi-column responsive classes)
    const bookList = screen.getByTestId('public-domain-book-list');
    expect(bookList.className).toContain('grid-cols-1');
    expect(bookList.className).not.toMatch(/(?:sm|md|lg|xl|2xl):grid-cols-[2-9]/);

    // Verify books start collapsed by default and expand/collapse toggle works
    const expandBtn = screen.getByRole('button', {
      name: 'Expand The Adventures of Sherlock Holmes',
    });
    expect(expandBtn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('excerpt-row-sherlock-bohemia-opening')).toBeNull();
    fireEvent.click(expandBtn);
    expect(screen.getByTestId('excerpt-row-sherlock-bohemia-opening')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', {name: 'Collapse The Adventures of Sherlock Holmes'})
    );
    expect(screen.queryByTestId('excerpt-row-sherlock-bohemia-opening')).toBeNull();
  });
});
