import {APP_NAME} from '../config';
import type {OrpelaBackupPayload} from '../types';
import {db, type OrpelaDatabase} from './storage/db';
import {isQuotaExceededError, StorageQuotaError, saveGlobalSettings} from './storage/repositories';

export const BACKUP_SCHEMA_VERSION = 1;

export async function exportLibraryBackup(
  database: OrpelaDatabase = db
): Promise<OrpelaBackupPayload> {
  const [documents, contents, progress, sessions, settingsRecord] = await Promise.all([
    database.documents.toArray(),
    database.contents.toArray(),
    database.progress.toArray(),
    database.sessions.toArray(),
    database.settings.get('global'),
  ]);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    documents,
    contents,
    progress,
    sessions,
    settings: settingsRecord?.value,
  };
}

export function downloadBackupJson(payload: OrpelaBackupPayload): void {
  const datePart = payload.exportedAt.slice(0, 10);
  const fileName = `orpela-backup-${datePart}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export interface BackupImportSummary {
  importedDocuments: number;
  skippedDuplicates: number;
  importedSessions: number;
  restoredSettings: boolean;
}

export async function importLibraryBackup(
  rawJson: string,
  database: OrpelaDatabase = db
): Promise<BackupImportSummary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup format.');
  }

  const payload = parsed as Partial<OrpelaBackupPayload>;
  if (
    !Array.isArray(payload.documents) ||
    !Array.isArray(payload.contents) ||
    !Array.isArray(payload.progress)
  ) {
    throw new Error('Backup file is missing required documents, contents, or progress arrays.');
  }

  const contentById = new Map(payload.contents.map((c) => [c.documentId, c]));
  const progressById = new Map(payload.progress.map((p) => [p.documentId, p]));

  let importedDocuments = 0;
  let skippedDuplicates = 0;
  let importedSessions = 0;
  let restoredSettings = false;

  try {
    await database.transaction(
      'rw',
      database.documents,
      database.contents,
      database.progress,
      database.sessions,
      async () => {
        for (const doc of payload.documents ?? []) {
          if (!doc || typeof doc.id !== 'string' || typeof doc.title !== 'string') {
            continue;
          }
          const content = contentById.get(doc.id);
          if (!content || typeof content.text !== 'string') {
            continue;
          }

          const existingById = await database.documents.get(doc.id);
          const existingByHash = doc.contentHash
            ? await database.documents.where('contentHash').equals(doc.contentHash).first()
            : undefined;

          if (existingById || existingByHash) {
            skippedDuplicates++;
            continue;
          }

          await database.documents.put(doc);
          await database.contents.put(content);
          const prog = progressById.get(doc.id);
          if (prog) {
            await database.progress.put(prog);
          }
          importedDocuments++;
        }

        if (Array.isArray(payload.sessions)) {
          for (const sess of payload.sessions) {
            if (!sess || typeof sess.id !== 'string') continue;
            const exists = await database.sessions.get(sess.id);
            if (!exists) {
              await database.sessions.put(sess);
              importedSessions++;
            }
          }
        }
      }
    );

    if (payload.settings && typeof payload.settings === 'object') {
      await saveGlobalSettings(payload.settings, database);
      restoredSettings = true;
    }
  } catch (err) {
    if (isQuotaExceededError(err)) {
      throw new StorageQuotaError();
    }
    throw err;
  }

  return {
    importedDocuments,
    skippedDuplicates,
    importedSessions,
    restoredSettings,
  };
}
