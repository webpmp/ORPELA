import JSZip from 'jszip';
import type {ImportResult} from '../../types';
import {normalizeImportedText, titleFromFileName} from './normalize';

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(attrString)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[2] ?? match[3] ?? '');
  }
  return attrs;
}

function resolveZipPath(baseFilePath: string, relativeHref: string): string {
  const cleanHref = decodeURIComponent(relativeHref.split('#')[0] ?? '');
  if (!baseFilePath.includes('/')) {
    return cleanHref.replace(/^\.\//, '');
  }
  const baseParts = baseFilePath.split('/').slice(0, -1);
  for (const part of cleanHref.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }
  return baseParts.join('/');
}

function extractTextFromXhtml(xhtml: string): string {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xhtml, 'application/xhtml+xml');
      const parseErr = doc.querySelector('parsererror');
      const targetDoc = parseErr ? parser.parseFromString(xhtml, 'text/html') : doc;
      const body = targetDoc.body ?? targetDoc.documentElement;
      if (body) {
        const blocks = body.querySelectorAll(
          'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, div'
        );
        // Only collect leaf-like blocks to avoid duplicating nested div text
        const collected: string[] = [];
        const blockTags = new Set([
          'P',
          'H1',
          'H2',
          'H3',
          'H4',
          'H5',
          'H6',
          'LI',
          'BLOCKQUOTE',
          'PRE',
        ]);
        if (blocks.length > 0) {
          blocks.forEach((el) => {
            if (blockTags.has(el.tagName.toUpperCase())) {
              const t = el.textContent?.replace(/\s+/g, ' ').trim();
              if (t) collected.push(t);
            }
          });
        }
        if (collected.length > 0) {
          return collected.join('\n\n');
        }
        const fallbackText = body.textContent ?? '';
        return normalizeImportedText(fallbackText);
      }
    } catch {
      // Fall through to deterministic tag stripper
    }
  }

  // Worker-safe / Node-safe XHTML block extractor
  const withoutHeadAndScripts = xhtml
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '');

  const withBreaks = withoutHeadAndScripts
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote|section|article|tr|pre)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');

  return normalizeImportedText(decodeXmlEntities(withBreaks));
}

function hasNonFontDrm(encryptionXml: string): boolean {
  const cipherRefs = Array.from(
    encryptionXml.matchAll(/<CipherReference\b([^>]*?)\/?>/gi)
  ).map((m) => parseAttributes(m[1]).URI ?? '');

  if (cipherRefs.length === 0) {
    // Unknown EncryptedData without explicit font obfuscation URI -> assume DRM
    return /<EncryptedData\b|<EncryptedKey\b/i.test(encryptionXml);
  }

  // Standard IDPF / Adobe font obfuscation only targets font binaries
  return cipherRefs.some((uri) => !/\.(?:ttf|otf|woff|woff2|eot)$/i.test(uri));
}

export async function extractEpubFromBytes(
  data: Uint8Array,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<ImportResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error('Could not open EPUB file. The archive appears to be malformed or corrupted.');
  }

  const allPaths = Object.keys(zip.files);
  if (allPaths.some((p) => /(?:^|\/)rights\.xml$/i.test(p) || /\.sinf$/i.test(p))) {
    throw new Error('This EPUB is DRM-protected and cannot be imported.');
  }

  const encryptionFile = zip.file('META-INF/encryption.xml');
  if (encryptionFile) {
    const encryptionXml = await encryptionFile.async('text');
    if (hasNonFontDrm(encryptionXml)) {
      throw new Error('This EPUB is DRM-protected and cannot be imported.');
    }
  }

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Malformed EPUB: missing META-INF/container.xml.');
  }
  const containerXml = await containerFile.async('text');
  const rootfileMatch = containerXml.match(/<rootfile\b([^>]*?)\/?>/i);
  const opfPath = rootfileMatch ? parseAttributes(rootfileMatch[1])['full-path'] : undefined;
  if (!opfPath) {
    throw new Error('Malformed EPUB: could not locate package OPF path in container.xml.');
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`Malformed EPUB: package file "${opfPath}" was not found.`);
  }
  const opfXml = await opfFile.async('text');

  const titleMatch = opfXml.match(/<(?:dc:)?title\b[^>]*>([\s\S]*?)<\/(?:dc:)?title>/i);
  const authorMatch = opfXml.match(/<(?:dc:)?creator\b[^>]*>([\s\S]*?)<\/(?:dc:)?creator>/i);
  const title = titleMatch
    ? decodeXmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim())
    : titleFromFileName(fileName);
  const author = authorMatch
    ? decodeXmlEntities(authorMatch[1].replace(/<[^>]+>/g, '').trim())
    : undefined;

  const manifest = new Map<string, {href: string; mediaType: string; properties?: string}>();
  for (const itemMatch of opfXml.matchAll(/<item\b([^>]*?)\/?>/gi)) {
    const attrs = parseAttributes(itemMatch[1]);
    if (attrs.id && attrs.href) {
      manifest.set(attrs.id, {
        href: attrs.href,
        mediaType: attrs['media-type'] ?? '',
        properties: attrs.properties,
      });
    }
  }

  const spineIds: string[] = [];
  for (const itemrefMatch of opfXml.matchAll(/<itemref\b([^>]*?)\/?>/gi)) {
    const attrs = parseAttributes(itemrefMatch[1]);
    if (attrs.idref && attrs.linear !== 'no') {
      spineIds.push(attrs.idref);
    }
  }

  if (spineIds.length === 0) {
    throw new Error('Malformed EPUB: reading spine contains no readable chapters.');
  }

  // Parse TOC labels (NCX or EPUB3 nav) for chapter headings
  const chapterLabels = new Map<string, string>();
  const spineTagMatch = opfXml.match(/<spine\b([^>]*)>/i);
  const tocId = spineTagMatch ? parseAttributes(spineTagMatch[1]).toc : undefined;
  if (tocId && manifest.has(tocId)) {
    const ncxPath = resolveZipPath(opfPath, manifest.get(tocId)!.href);
    const ncxFile = zip.file(ncxPath);
    if (ncxFile) {
      const ncxXml = await ncxFile.async('text');
      const navPointRe =
        /<navPoint\b[\s\S]*?<navLabel>\s*<text>([\s\S]*?)<\/text>\s*<\/navLabel>[\s\S]*?<content\b([^>]*?)\/?>/gi;
      for (const m of ncxXml.matchAll(navPointRe)) {
        const label = decodeXmlEntities(m[1].replace(/<[^>]+>/g, '').trim());
        const src = parseAttributes(m[2]).src;
        if (label && src) {
          const targetPath = resolveZipPath(ncxPath, src);
          if (!chapterLabels.has(targetPath)) {
            chapterLabels.set(targetPath, label);
          }
        }
      }
    }
  }

  const sections: string[] = [];
  const warnings: string[] = [];
  let missingItems = 0;

  for (let i = 0; i < spineIds.length; i++) {
    const item = manifest.get(spineIds[i]);
    if (!item) continue;
    const itemPath = resolveZipPath(opfPath, item.href);
    const zipEntry = zip.file(itemPath);
    if (!zipEntry) {
      missingItems++;
      continue;
    }

    const xhtml = await zipEntry.async('text');
    const extracted = extractTextFromXhtml(xhtml);
    if (extracted) {
      const tocLabel = chapterLabels.get(itemPath);
      if (tocLabel && !extracted.toLowerCase().startsWith(tocLabel.toLowerCase())) {
        sections.push(`${tocLabel}\n\n${extracted}`);
      } else {
        sections.push(extracted);
      }
    }
    onProgress?.(Math.round(((i + 1) / spineIds.length) * 100));
  }

  if (missingItems > 0) {
    warnings.push(`${missingItems} spine item(s) could not be found in the EPUB archive.`);
  }

  const text = normalizeImportedText(sections.join('\n\n'));
  if (!text) {
    throw new Error('This EPUB contains no readable text content.');
  }

  return {
    title: title || titleFromFileName(fileName),
    author: author || undefined,
    text,
    source: 'epub',
    warnings,
  };
}
