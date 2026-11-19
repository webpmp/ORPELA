export interface OrpLayout {
  fullText: string;
  focalWordIndex: number | null;
  orpIndex: number | null;
  before: string;
  focalChar: string;
  after: string;
}

const LEADING_PUNCT_RE = /^[^\p{L}\p{N}]+/u;
const TRAILING_PUNCT_RE = /[^\p{L}\p{N}]+$/u;

export function stripSurroundingPunctuation(word: string): {
  leading: string;
  core: string;
  trailing: string;
} {
  const leadMatch = word.match(LEADING_PUNCT_RE);
  const leading = leadMatch ? leadMatch[0] : '';
  const withoutLeading = word.slice(leading.length);

  if (withoutLeading.length === 0) {
    return {leading: '', core: word, trailing: ''};
  }

  const trailMatch = withoutLeading.match(TRAILING_PUNCT_RE);
  const trailing = trailMatch ? trailMatch[0] : '';
  const core = withoutLeading.slice(0, withoutLeading.length - trailing.length);

  if (core.length === 0) {
    return {leading: '', core: word, trailing: ''};
  }

  return {leading, core, trailing};
}

export function computeCoreOrpIndex(coreLength: number): number {
  if (coreLength <= 1) return 0;
  if (coreLength <= 5) return 1;
  if (coreLength <= 9) return 2;
  if (coreLength <= 13) return 3;
  return 4;
}

export function findWordOrpIndex(word: string): number {
  if (word.length <= 1) {
    return 0;
  }
  const {leading, core} = stripSurroundingPunctuation(word);
  const coreOrp = computeCoreOrpIndex(core.length);
  const mapped = leading.length + coreOrp;
  return Math.min(mapped, word.length - 1);
}

export function computeChunkOrp(
  words: readonly string[],
  wordsPerFlash: number = words.length
): OrpLayout {
  if (words.length === 0) {
    return {
      fullText: '',
      focalWordIndex: null,
      orpIndex: null,
      before: '',
      focalChar: '',
      after: '',
    };
  }

  // Only compute an ORP focal index when reading 1 word per flash.
  // At 2w/3w/4w, leftover 1-word chunks (sentence or document ends) stay centered without highlight.
  if (wordsPerFlash === 1 && words.length === 1) {
    const word = words[0];
    const orpIndex = findWordOrpIndex(word);
    return {
      fullText: word,
      focalWordIndex: 0,
      orpIndex,
      before: word.slice(0, orpIndex),
      focalChar: word.charAt(orpIndex),
      after: word.slice(orpIndex + 1),
    };
  }

  // Multi-word settings (2w, 3w, 4w) center every chunk on the focal axis without
  // highlighting any individual character.
  return {
    fullText: words.join(' '),
    focalWordIndex: null,
    orpIndex: null,
    before: '',
    focalChar: '',
    after: '',
  };
}
