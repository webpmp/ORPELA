import JSZip from 'jszip';
import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import {describe, expect, it} from 'vitest';
import {extractEpubFromBytes} from '../importers/epubCore';
import {importPastedText} from '../importers/paste';
import {extractPdfDocumentFromBytes} from '../importers/pdfCore';
import {importTxtBytes} from '../importers/txt';

(globalThis as {pdfjsWorker?: unknown}).pdfjsWorker = pdfWorker;

function createMinimalTextPdfBytes(textContent: string): Uint8Array {
  const objects: string[] = [];
  const addObj = (body: string) => {
    const idx = objects.length + 1;
    objects.push(`${idx} 0 obj\n${body}\nendobj\n`);
    return idx;
  };

  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObj(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'
  );

  const streamBody = textContent
    ? `BT\n/F1 12 Tf\n72 720 Td\n(${textContent.replace(/[()\\]/g, '\\$&')}) Tj\nET`
    : 'q Q';
  addObj(`<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream`);
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

async function createMinimalEpubBytes(options?: {malformed?: boolean; drm?: boolean}): Promise<Uint8Array> {
  if (options?.malformed) {
    return new TextEncoder().encode('not-a-valid-zip-archive');
  }

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
     <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
       <rootfiles>
         <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
       </rootfiles>
     </container>`
  );

  if (options?.drm) {
    zip.file(
      'META-INF/encryption.xml',
      `<?xml version="1.0"?>
       <encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
         <EncryptedData><CipherData><CipherReference URI="OEBPS/ch1.xhtml"/></CipherData></EncryptedData>
       </encryption>`
    );
  }

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
     <package xmlns="http://www.idpf.org/2007/opf" version="2.0">
       <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
         <dc:title>Test Book</dc:title>
         <dc:creator>Ada Lovelace</dc:creator>
       </metadata>
       <manifest>
         <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
         <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
       </manifest>
       <spine toc="ncx">
         <itemref idref="ch1"/>
       </spine>
     </package>`
  );

  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0"?>
     <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
       <navMap>
         <navPoint id="n1" playOrder="1">
           <navLabel><text>Chapter One</text></navLabel>
           <content src="ch1.xhtml"/>
         </navPoint>
       </navMap>
     </ncx>`
  );

  zip.file(
    'OEBPS/ch1.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml">
       <head><title>Ch 1</title></head>
       <body><p>Hello from an EPUB chapter.</p><p>Second paragraph here.</p></body>
     </html>`
  );

  return zip.generateAsync({type: 'uint8array'});
}

describe('importers', () => {
  it('imports pasted text and defaults title to first line', () => {
    const res = importPastedText('First Line Title\n\nBody paragraph text.');
    expect(res.title).toBe('First Line Title');
    expect(res.source).toBe('paste');
    expect(res.text).toBe('First Line Title\n\nBody paragraph text.');
  });

  it('imports UTF-8 BOM TXT files and rejoins hard-wrapped lines', () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const body = new TextEncoder().encode(
      'This line is hard-\nwrapped across lines.\n\nNew paragraph starts here.'
    );
    const merged = new Uint8Array(bom.length + body.length);
    merged.set(bom, 0);
    merged.set(body, bom.length);

    const res = importTxtBytes(merged.buffer, 'my_notes.txt');
    expect(res.title).toBe('my notes');
    expect(res.text).toBe('This line is hardwrapped across lines.\n\nNew paragraph starts here.');
  });

  it('imports valid PDF and fails clearly on scanned PDF with no text', async () => {
    const validPdf = createMinimalTextPdfBytes('Hello PDF reader world.');
    const res = await extractPdfDocumentFromBytes(validPdf, 'sample.pdf');
    expect(res.source).toBe('pdf');
    expect(res.text).toContain('Hello PDF reader world.');

    const scannedPdf = createMinimalTextPdfBytes('');
    await expect(extractPdfDocumentFromBytes(scannedPdf, 'scanned.pdf')).rejects.toThrow(
      /Scanned PDF, no text found/i
    );
  });

  it('imports valid EPUB, rejects malformed EPUB, and rejects DRM EPUB', async () => {
    const validEpub = await createMinimalEpubBytes();
    const res = await extractEpubFromBytes(validEpub, 'book.epub');
    expect(res.title).toBe('Test Book');
    expect(res.author).toBe('Ada Lovelace');
    expect(res.text).toContain('Chapter One');
    expect(res.text).toContain('Hello from an EPUB chapter.');

    const malformed = await createMinimalEpubBytes({malformed: true});
    await expect(extractEpubFromBytes(malformed, 'bad.epub')).rejects.toThrow(/malformed/i);

    const drmEpub = await createMinimalEpubBytes({drm: true});
    await expect(extractEpubFromBytes(drmEpub, 'drm.epub')).rejects.toThrow(/DRM-protected/i);
  });
});
