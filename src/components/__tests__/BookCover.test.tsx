// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import React, {useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  BookCover,
  BookCoverModal,
  type BookCoverPreviewData,
} from '../BookCover';
import {resetOpenLibraryCoverStateForTests} from '../../services/openLibraryCovers';

describe('BookCover & BookCoverModal', () => {
  const originalFetch = globalThis.fetch;
  const originalIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    localStorage.clear();
    resetOpenLibraryCoverStateForTests();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    globalThis.IntersectionObserver = class {
      private callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [{isIntersecting: true, target} as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        );
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    globalThis.IntersectionObserver = originalIntersectionObserver;
    vi.restoreAllMocks();
  });

  it('fetches via Search API when visible, falls forward across 404 candidates (?default=false), and falls back cleanly to monogram when exhausted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL85892W',
              title: 'Dracula',
              author_name: ['Bram Stoker'],
              isbn: ['9780141439846'],
              cover_edition_key: 'OL7353617M',
              cover_i: 8225261,
            },
          ],
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}}
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <BookCover
        title="Dracula"
        author="Bram Stoker"
        publicationYear="1897"
        coverTone="red"
        size="M"
      />
    );

    // Starts by trying ISBN first (preference order: isbn -> olid -> id)
    const firstImg = await waitFor(() =>
      screen.getByAltText('Cover of Dracula') as HTMLImageElement
    );
    expect(firstImg.src).toBe(
      'https://covers.openlibrary.org/b/isbn/9780141439846-M.jpg?default=false'
    );
    expect(firstImg.getAttribute('referrerpolicy')).toBe('no-referrer');

    // Simulate 404 on ISBN -> automatically steps to OLID
    fireEvent.error(firstImg);
    const secondImg = await waitFor(() =>
      screen.getByAltText('Cover of Dracula') as HTMLImageElement
    );
    expect(secondImg.src).toBe(
      'https://covers.openlibrary.org/b/olid/OL7353617M-M.jpg?default=false'
    );

    // Simulate 404 on OLID -> automatically steps to cover_i id
    fireEvent.error(secondImg);
    const thirdImg = await waitFor(() =>
      screen.getByAltText('Cover of Dracula') as HTMLImageElement
    );
    expect(thirdImg.src).toBe(
      'https://covers.openlibrary.org/b/id/8225261-M.jpg?default=false'
    );

    // Simulate 404 on final candidate -> removes broken img and preserves monogram fallback
    fireEvent.error(thirdImg);
    await waitFor(() => {
      expect(screen.queryByAltText('Cover of Dracula')).toBeNull();
    });
    expect(screen.getByText('DR')).toBeTruthy();
    expect(screen.getByText('1897')).toBeTruthy();
  });

  it('opens the L-size BookCoverModal when a loaded M cover is clicked and closes on Escape', async () => {
    const Harness: React.FC = () => {
      const [preview, setPreview] = useState<BookCoverPreviewData | null>(null);
      return (
        <>
          <BookCover
            title="Pride and Prejudice"
            author="Jane Austen"
            publicationYear="1813"
            edition="First edition (1813)"
            identifiers={{olid: 'OL24364628M'}}
            size="M"
            onInspect={setPreview}
          />
          <BookCoverModal preview={preview} onClose={() => setPreview(null)} />
        </>
      );
    };

    render(<Harness />);

    const thumb = screen.getByAltText('Cover of Pride and Prejudice') as HTMLImageElement;
    expect(thumb.src).toBe(
      'https://covers.openlibrary.org/b/olid/OL24364628M-M.jpg?default=false'
    );

    // Simulate successful cover image load with realistic dimensions (> 1x1)
    Object.defineProperty(thumb, 'naturalWidth', {configurable: true, value: 180});
    Object.defineProperty(thumb, 'naturalHeight', {configurable: true, value: 270});
    fireEvent.load(thumb);

    const inspectButton = await waitFor(() =>
      screen.getByRole('button', {name: 'View larger cover for Pride and Prejudice'})
    );
    fireEvent.click(inspectButton);

    const modal = screen.getByTestId('book-cover-modal');
    expect(modal).toBeTruthy();
    const largeImg = screen.getByAltText('Large cover of Pride and Prejudice') as HTMLImageElement;
    expect(largeImg.src).toBe(
      'https://covers.openlibrary.org/b/olid/OL24364628M-L.jpg?default=false'
    );

    // Pressing Escape dismisses the modal
    fireEvent.keyDown(window, {key: 'Escape'});
    await waitFor(() => {
      expect(screen.queryByTestId('book-cover-modal')).toBeNull();
    });
  });

  it('renders S-size thumbnails directly when identifiers are supplied', () => {
    render(
      <BookCover
        title="The Time Machine"
        author="H. G. Wells"
        identifiers={{isbn: '9780451528551'}}
        size="S"
      />
    );

    const img = screen.getByAltText('Cover of The Time Machine') as HTMLImageElement;
    expect(img.src).toBe(
      'https://covers.openlibrary.org/b/isbn/9780451528551-S.jpg?default=false'
    );
  });
});
