export const TOKENIZER_VERSION = 1;

export interface WordFragment {
  text: string;
  isContinuation: boolean;
}

export interface WordToken {
  index: number;
  text: string;
  paragraphIndex: number;
  sentenceIndex: number;
  isSentenceEnd: boolean;
  isParagraphEnd: boolean;
  fragments: WordFragment[];
}

export interface TokenizedDocument {
  version: number;
  tokens: WordToken[];
  sentenceStarts: number[];
  paragraphStarts: number[];
}

const ABBREVIATIONS = new Set([
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'prof.',
  'sr.',
  'jr.',
  'st.',
  'vs.',
  'etc.',
  'e.g.',
  'i.e.',
  'u.s.',
  'u.k.',
  'a.m.',
  'p.m.',
  'no.',
  'vol.',
  'fig.',
  'gen.',
  'lt.',
  'col.',
  'rev.',
  'hon.',
  'pres.',
  'inc.',
  'ltd.',
  'corp.',
  'jan.',
  'feb.',
  'mar.',
  'apr.',
  'aug.',
  'sept.',
  'oct.',
  'nov.',
  'dec.',
  'al.',
  'cf.',
  'viz.',
  'approx.',
  'est.',
]);

const LONG_WORD_SPLIT_THRESHOLD = 14;
const CLOSING_WRAPPERS_RE = /["'”’»)\]}]+$/;
const TERMINAL_PUNCT_RE = /[.!?…]+$/;

function stripClosingWrappers(token: string): string {
  return token.replace(CLOSING_WRAPPERS_RE, '');
}

function isAbbreviationToken(token: string): boolean {
  const cleaned = stripClosingWrappers(token).toLowerCase();
  if (ABBREVIATIONS.has(cleaned)) {
    return true;
  }
  // Single-letter initial like "J." or "A."
  if (/^[a-z]\.$/.test(cleaned)) {
    return true;
  }
  // Multi-part dotted abbreviation like "U.S.A." or "Ph.D."
  if (/^(?:[a-z]{1,3}\.){2,}$/.test(cleaned)) {
    return true;
  }
  return false;
}

function isUrlOrEmailToken(token: string): boolean {
  return /^(https?:\/\/|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i.test(token);
}

function isDecimalOrVersionToken(token: string): boolean {
  const cleaned = stripClosingWrappers(token);
  return /^\d+(?:\.\d+)+$/.test(cleaned);
}

function isEllipsisToken(token: string): boolean {
  const cleaned = stripClosingWrappers(token);
  return cleaned.endsWith('...') || cleaned.endsWith('…');
}

function splitRawWords(paragraph: string): string[] {
  // Split on whitespace first, then split joined em-dashes and double hyphens
  const whitespaceParts = paragraph.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (const part of whitespaceParts) {
    // Insert split boundary right after em-dash or double-hyphen when flanked by non-whitespace
    const subParts = part
      .replace(/(\S)(—|--)(?=\S)/g, '$1$2 ')
      .split(' ')
      .filter(Boolean);

    for (const sub of subParts) {
      result.push(sub);
    }
  }

  return result;
}

function shouldEndSentence(
  token: string,
  nextToken: string | undefined,
  segmenterEndsHere: boolean
): boolean {
  if (!nextToken) {
    return true;
  }

  if (isUrlOrEmailToken(token) || isDecimalOrVersionToken(token)) {
    return false;
  }

  if (isAbbreviationToken(token)) {
    return false;
  }

  const core = stripClosingWrappers(token);

  if (isEllipsisToken(token)) {
    // Ellipsis ends a sentence only if next token starts with an uppercase letter or opening quote + uppercase
    const nextLead = nextToken.replace(/^["'“‘«(\[{]+/, '');
    return /^[A-Z]/.test(nextLead);
  }

  if (TERMINAL_PUNCT_RE.test(core)) {
    // If the next word starts with a lowercase letter, it is usually not a sentence boundary
    const nextLead = nextToken.replace(/^["'“‘«(\[{]+/, '');
    if (/^[a-z]/.test(nextLead)) {
      return false;
    }
    return true;
  }

  // Only trust segmenter if token actually ends in terminal punctuation
  return segmenterEndsHere && TERMINAL_PUNCT_RE.test(core);
}

function getSegmenterEndCharOffsets(paragraph: string): Set<number> {
  const ends = new Set<number>();
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', {granularity: 'sentence'});
    for (const seg of segmenter.segment(paragraph)) {
      const trimmedEnd = seg.index + seg.segment.trimEnd().length;
      if (trimmedEnd > 0) {
        ends.add(trimmedEnd);
      }
    }
  }
  return ends;
}

function createFragments(text: string): WordFragment[] {
  if (text.length <= LONG_WORD_SPLIT_THRESHOLD) {
    return [{text, isContinuation: false}];
  }
  const mid = Math.ceil(text.length / 2);
  return [
    {text: text.slice(0, mid), isContinuation: true},
    {text: text.slice(mid), isContinuation: false},
  ];
}

export function tokenize(rawText: string): TokenizedDocument {
  const normalized = rawText.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return {
      version: TOKENIZER_VERSION,
      tokens: [],
      sentenceStarts: [],
      paragraphStarts: [],
    };
  }

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const tokens: WordToken[] = [];
  const sentenceStarts: number[] = [];
  const paragraphStarts: number[] = [];

  let currentSentenceIndex = -1;

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paragraph = paragraphs[pIdx];
    const rawWords = splitRawWords(paragraph);
    if (rawWords.length === 0) {
      continue;
    }

    const segmenterEnds = getSegmenterEndCharOffsets(paragraph);
    paragraphStarts.push(tokens.length);

    let searchCursor = 0;
    let startOfNewSentence = true;

    for (let wIdx = 0; wIdx < rawWords.length; wIdx++) {
      const wordText = rawWords[wIdx];
      const nextWord = rawWords[wIdx + 1];
      const isLastInParagraph = wIdx === rawWords.length - 1;

      if (startOfNewSentence) {
        currentSentenceIndex++;
        sentenceStarts.push(tokens.length);
        startOfNewSentence = false;
      }

      // Check approximate end offset in original paragraph for Intl.Segmenter cross-check
      let segmenterEndsHere = false;
      const foundPos = paragraph.indexOf(wordText, searchCursor);
      if (foundPos !== -1) {
        const endPos = foundPos + wordText.length;
        searchCursor = endPos;
        segmenterEndsHere = segmenterEnds.has(endPos);
      }

      const isSentenceEnd =
        isLastInParagraph || shouldEndSentence(wordText, nextWord, segmenterEndsHere);

      tokens.push({
        index: tokens.length,
        text: wordText,
        paragraphIndex: pIdx,
        sentenceIndex: currentSentenceIndex,
        isSentenceEnd,
        isParagraphEnd: isLastInParagraph,
        fragments: createFragments(wordText),
      });

      if (isSentenceEnd) {
        startOfNewSentence = true;
      }
    }
  }

  return {
    version: TOKENIZER_VERSION,
    tokens,
    sentenceStarts,
    paragraphStarts,
  };
}
