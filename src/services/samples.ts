import {
  DEFAULT_EXCERPT_ID,
  PUBLIC_DOMAIN_BOOK_BY_ID,
  PUBLIC_DOMAIN_EXCERPT_BY_ID,
  loadPublicDomainExcerptText,
} from '../content/publicDomainCatalog';
import type {ImportResult, ReadingDescription} from '../types';

export interface SamplePassage {
  id: string;
  title: string;
  author: string;
  credit: string;
  description: ReadingDescription;
  bookId: string;
  bookTitle: string;
  publicationYear: string;
  sourceAttribution: string;
  publicDomainStatus: string;
  filePath: string;
  fallbackText: string;
}

export const SAMPLE_PASSAGES: SamplePassage[] = [
  {
    id: 'meditations-4',
    title: 'Meditations — Book IV (Excerpt)',
    author: 'Marcus Aurelius',
    credit: 'Translated by George Long (Public Domain)',
    description: 'Advanced',
    bookId: 'meditations',
    bookTitle: 'Meditations',
    publicationYear: 'c. 180 CE',
    sourceAttribution: 'Project Gutenberg (eBook #15877) — Translated by George Long (1862)',
    publicDomainStatus: 'Public Domain (US)',
    filePath: 'samples/meditations-book-4.txt',
    fallbackText: `Men seek retreats for themselves, houses in the country, sea-shores, and mountains; and thou too art wont to desire such things very much. But this is altogether a mark of the most common sort of men, for it is in thy power whenever thou shalt choose to retire into thyself.

For nowhere either with more quiet or more freedom from trouble does a man retire than into his own soul, particularly when he has within him such thoughts that by looking into them he is immediately in perfect tranquillity; and I affirm that tranquillity is nothing else than the good ordering of the mind.

Constantly then give to thyself this retreat, and renew thyself; and let thy principles be brief and fundamental, which, as soon as thou shalt recur to them, will be sufficient to cleanse the soul completely, and to send thee back free from all discontent with the things to which thou returnest.`,
  },
  {
    id: 'walden-excerpt',
    title: 'Walden — Where I Lived (Excerpt)',
    author: 'Henry David Thoreau',
    credit: '1854 Edition (Public Domain)',
    description: 'Intermediate',
    bookId: 'walden',
    bookTitle: 'Walden',
    publicationYear: '1854',
    sourceAttribution: 'Project Gutenberg (eBook #205) — First edition (1854)',
    publicDomainStatus: 'Public Domain (US)',
    filePath: 'samples/walden-excerpt.txt',
    fallbackText: `I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.

Our life is frittered away by detail. An honest man has hardly need to count more than his ten fingers, or in extreme cases he may add his ten toes, and lump the rest. Simplicity, simplicity, simplicity! I say, let your affairs be as two or three, and not a hundred or a thousand; instead of a million count half a dozen, and keep your accounts on your thumb-nail.

Time is but the stream I go a-fishing in. I drink at it; but while I see the sandy bottom and detect how shallow it is. Its thin current slides away, but eternity remains. I would drink deeper; fish in the sky, whose bottom is pebbly with stars.`,
  },
];

export async function loadSampleImportResult(sample: SamplePassage): Promise<ImportResult> {
  const base = import.meta.env.BASE_URL || '/';
  const url = `${base}${sample.filePath}`;
  const baseMeta = {
    title: sample.title,
    author: `${sample.author} · ${sample.credit}`,
    description: sample.description,
    bookId: sample.bookId,
    bookTitle: sample.bookTitle,
    excerptId: sample.id,
    publicationYear: sample.publicationYear,
    sourceAttribution: sample.sourceAttribution,
    publicDomainStatus: sample.publicDomainStatus,
    source: 'txt' as const,
    warnings: [] as string[],
  };

  try {
    const response = await fetch(url);
    if (response.ok) {
      const raw = await response.text();
      const lines = raw.replace(/\r\n?/g, '\n').split('\n');
      // Strip the top 2 metadata lines from the sample txt file for clean reading
      const body = lines.slice(3).join('\n').trim() || sample.fallbackText;
      return {
        ...baseMeta,
        text: body,
      };
    }
  } catch {
    // Offline fallback uses embedded public-domain excerpt
  }

  return {
    ...baseMeta,
    text: sample.fallbackText,
  };
}

export async function loadCatalogExcerptImportResult(excerptId: string): Promise<ImportResult> {
  if (excerptId === DEFAULT_EXCERPT_ID) {
    return loadSampleImportResult(SAMPLE_PASSAGES[0]);
  }

  const excerpt = PUBLIC_DOMAIN_EXCERPT_BY_ID.get(excerptId);
  if (!excerpt) {
    throw new Error('The selected public-domain excerpt could not be found.');
  }

  const book = PUBLIC_DOMAIN_BOOK_BY_ID.get(excerpt.bookId);
  if (!book) {
    throw new Error('The source book for this excerpt could not be found.');
  }

  const text = await loadPublicDomainExcerptText(book.id, excerpt.id);
  if (!text) {
    throw new Error(`Unable to load text for "${excerpt.title}".`);
  }

  return {
    title: `${book.title}: ${excerpt.title}`,
    author: `${book.author} (${book.publicationYear}) · ${book.edition}`,
    description: excerpt.description,
    bookId: book.id,
    bookTitle: book.title,
    excerptId: excerpt.id,
    publicationYear: book.publicationYear,
    sourceAttribution: `${book.sourceName} — ${book.edition}`,
    publicDomainStatus: book.publicDomainStatus,
    text,
    source: 'txt',
    warnings: [],
  };
}
