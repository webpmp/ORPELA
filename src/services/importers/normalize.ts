export function normalizeForMatching(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeImportedText(raw: string): string {
  const unified = raw.replace(/\r\n?/g, '\n');
  const paragraphs = unified
    .split(/\n\s*\n+/)
    .map((para) =>
      para
        .split('\n')
        .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
        .filter(Boolean)
        .join(' ')
        .trim()
    )
    .filter(Boolean);

  return paragraphs.join('\n\n').trim();
}

export function rejoinHardWrappedLines(raw: string): string {
  const unified = raw.replace(/\r\n?/g, '\n');
  const rawParagraphs = unified.split(/\n\s*\n+/);
  const rebuilt: string[] = [];

  for (const rawPara of rawParagraphs) {
    const lines = rawPara
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean);

    if (lines.length === 0) continue;

    let acc = lines[0];
    for (let i = 1; i < lines.length; i++) {
      const prev = acc;
      const curr = lines[i];

      // Preserve line break before list bullets/numbered items
      if (/^(?:[-*•]|\d+[.)])\s+/.test(curr)) {
        acc += `\n${curr}`;
        continue;
      }

      // Rejoin hyphenated word broken at line end
      if (/[a-zA-Z]-\s*$/.test(prev) && /^[a-z]/.test(curr)) {
        acc = prev.replace(/-\s*$/, '') + curr;
      } else {
        acc = `${prev} ${curr}`;
      }
    }

    rebuilt.push(acc);
  }

  return rebuilt.join('\n\n').trim();
}

export function rejoinHyphenatedLineBreaks(text: string): string {
  return text.replace(/([A-Za-z])-\n([a-z])/g, '$1$2');
}

function normalizeHeaderFooterKey(line: string): string {
  return normalizeForMatching(line).replace(/\d+/g, '#');
}

function isStandalonePageNumber(line: string): boolean {
  const trimmed = line.trim();
  return /^(?:page\s*)?\d{1,5}(?:\s*\/\s*\d{1,5})?$/i.test(trimmed) || /^[ivxlcdm]{1,6}$/i.test(trimmed);
}

export function stripRepeatedHeadersFooters(pagesLines: string[][]): string[][] {
  if (pagesLines.length < 3) {
    return pagesLines.map((lines) => lines.filter((l) => !isStandalonePageNumber(l)));
  }

  const topCounts = new Map<string, number>();
  const bottomCounts = new Map<string, number>();

  for (const lines of pagesLines) {
    if (lines.length === 0) continue;
    const firstKey = normalizeHeaderFooterKey(lines[0]);
    if (firstKey) {
      topCounts.set(firstKey, (topCounts.get(firstKey) ?? 0) + 1);
    }
    if (lines.length > 1) {
      const lastKey = normalizeHeaderFooterKey(lines[lines.length - 1]);
      if (lastKey) {
        bottomCounts.set(lastKey, (bottomCounts.get(lastKey) ?? 0) + 1);
      }
    }
  }

  const threshold = Math.max(2, Math.floor(pagesLines.length * 0.5));

  return pagesLines.map((lines) => {
    const filtered = [...lines];
    if (filtered.length > 0) {
      const firstKey = normalizeHeaderFooterKey(filtered[0]);
      if ((topCounts.get(firstKey) ?? 0) >= threshold || isStandalonePageNumber(filtered[0])) {
        filtered.shift();
      }
    }
    if (filtered.length > 0) {
      const lastIdx = filtered.length - 1;
      const lastKey = normalizeHeaderFooterKey(filtered[lastIdx]);
      if (
        (bottomCounts.get(lastKey) ?? 0) >= threshold ||
        isStandalonePageNumber(filtered[lastIdx])
      ) {
        filtered.pop();
      }
    }
    return filtered;
  });
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || 'Untitled';
}
