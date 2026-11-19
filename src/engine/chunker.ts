import type {WordToken} from './tokenizer';

export type ChunkSize = 1 | 2 | 3 | 4;

export interface WordChunk {
  startIndex: number;
  endIndex: number;
  tokens: WordToken[];
  text: string;
  endsSentence: boolean;
  endsParagraph: boolean;
}

export function clampChunkSize(size: number): ChunkSize {
  if (size <= 1) return 1;
  if (size >= 4) return 4;
  return Math.round(size) as ChunkSize;
}

export function getChunkAt(
  tokens: readonly WordToken[],
  startIndex: number,
  chunkSize: ChunkSize
): WordChunk | null {
  if (tokens.length === 0 || startIndex < 0 || startIndex >= tokens.length) {
    return null;
  }

  const size = clampChunkSize(chunkSize);
  const collected: WordToken[] = [];

  for (let offset = 0; offset < size; offset++) {
    const idx = startIndex + offset;
    if (idx >= tokens.length) {
      break;
    }
    const token = tokens[idx];
    collected.push(token);
    if (token.isSentenceEnd || token.isParagraphEnd) {
      break;
    }
  }

  const last = collected[collected.length - 1];
  return {
    startIndex,
    endIndex: last.index,
    tokens: collected,
    text: collected.map((t) => t.text).join(' '),
    endsSentence: last.isSentenceEnd,
    endsParagraph: last.isParagraphEnd,
  };
}

export function buildChunks(
  tokens: readonly WordToken[],
  chunkSize: ChunkSize,
  fromIndex = 0
): WordChunk[] {
  const chunks: WordChunk[] = [];
  let cursor = Math.max(0, fromIndex);

  while (cursor < tokens.length) {
    const chunk = getChunkAt(tokens, cursor, chunkSize);
    if (!chunk) {
      break;
    }
    chunks.push(chunk);
    cursor = chunk.endIndex + 1;
  }

  return chunks;
}
