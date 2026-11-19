import Dexie from 'dexie';
import {IDBKeyRange, indexedDB} from 'fake-indexeddb';
import {describe, expect, it} from 'vitest';
import {exportLibraryBackup, importLibraryBackup} from '../backup';
import {OrpelaDatabase} from '../storage/db';
import {
  StorageQuotaError,
  deleteDocumentBundle,
  getDocumentRecord,
  listDocumentsWithProgress,
  remapWordIndexOnVersionChange,
  restoreDeletedDocumentBundle,
  saveImportedDocument,
  saveReadingProgress,
} from '../storage/repositories';

describe('storage', () => {
  it('opens a version 1 database and preserves existing records across reopen', async () => {
    const dbName = `orpela-mig-test-${Date.now()}`;
    const legacy = new Dexie(dbName, {indexedDB, IDBKeyRange});
    legacy.version(1).stores({
      documents: 'id, title, createdAt, updatedAt, contentHash',
      contents: 'documentId',
      progress: 'documentId, updatedAt',
      sessions: 'id, documentId, startedAt',
      settings: 'id',
    });
    await legacy.open();
    await legacy.table('documents').put({
      id: 'doc-1',
      title: 'Legacy Passage',
      source: 'paste',
      totalWords: 100,
      contentHash: 'hash-1',
      tokenizerVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await legacy.table('contents').put({
      documentId: 'doc-1',
      text: 'Some legacy text content.',
    });
    await legacy.table('progress').put({
      documentId: 'doc-1',
      wordIndex: 25,
      tokenizerVersion: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    legacy.close();

    const currentDb = new OrpelaDatabase(dbName, {indexedDB, IDBKeyRange});
    await currentDb.open();

    const list = await listDocumentsWithProgress(currentDb);
    expect(list).toHaveLength(1);
    expect(list[0].document.title).toBe('Legacy Passage');
    expect(list[0].progress?.wordIndex).toBe(25);

    const record = await getDocumentRecord('doc-1', currentDb);
    expect(record?.content.text).toBe('Some legacy text content.');

    currentDb.close();
  });

  it('throws StorageQuotaError when IndexedDB rejects with QuotaExceededError', async () => {
    const dbName = `orpela-quota-test-${Date.now()}`;
    const testDb = new OrpelaDatabase(dbName, {indexedDB, IDBKeyRange});
    await testDb.open();

    // Simulate QuotaExceededError on progress.put
    const originalPut = testDb.progress.put.bind(testDb.progress);
    testDb.progress.put = (() => {
      const err = new Error('QuotaExceededError: disk full');
      err.name = 'QuotaExceededError';
      return Dexie.Promise.reject(err);
    }) as typeof testDb.progress.put;

    await expect(saveReadingProgress('doc-x', 10, testDb)).rejects.toBeInstanceOf(
      StorageQuotaError
    );

    testDb.progress.put = originalPut;
    testDb.close();
  });

  it('remaps word index by percentage when tokenizerVersion changes', () => {
    // 50% of 101 words (index 50) -> 50% of 201 words (index 100)
    const res = remapWordIndexOnVersionChange(50, 0, 101, 201);
    expect(res.remapped).toBe(true);
    expect(res.wordIndex).toBe(100);
  });

  it('saves, deletes with undo restore, and exports/imports full JSON backup', async () => {
    const db1 = new OrpelaDatabase(`orpela-bak-1-${Date.now()}`, {indexedDB, IDBKeyRange});
    const db2 = new OrpelaDatabase(`orpela-bak-2-${Date.now()}`, {indexedDB, IDBKeyRange});

    const {document} = await saveImportedDocument(
      {title: 'Sample', text: 'One two three four.', source: 'paste', warnings: []},
      4,
      undefined,
      db1
    );
    await saveReadingProgress(document.id, 2, db1);

    const snapshot = await deleteDocumentBundle(document.id, db1);
    expect(snapshot).not.toBeNull();
    expect(await listDocumentsWithProgress(db1)).toHaveLength(0);

    await restoreDeletedDocumentBundle(snapshot!, db1);
    expect(await listDocumentsWithProgress(db1)).toHaveLength(1);

    const backup = await exportLibraryBackup(db1);
    const summary = await importLibraryBackup(JSON.stringify(backup), db2);
    expect(summary.importedDocuments).toBe(1);

    const importedList = await listDocumentsWithProgress(db2);
    expect(importedList[0].document.title).toBe('Sample');
    expect(importedList[0].progress?.wordIndex).toBe(2);

    db1.close();
    db2.close();
  });
});
