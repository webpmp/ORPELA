import {Download, RotateCcw, Upload} from 'lucide-react';
import React, {useEffect, useRef, useState} from 'react';
import {useAppContext} from '../../context/AppContext';
import type {ChunkSize} from '../../engine/chunker';
import {TIMING_CONSTANTS} from '../../engine/timing';
import {
  downloadBackupJson,
  exportLibraryBackup,
  importLibraryBackup,
} from '../../services/backup';
import type {FontFamilyOption} from '../../types';

const FONT_OPTIONS: Array<{value: FontFamilyOption; label: string}> = [
  {value: 'sans', label: 'Plus Jakarta Sans'},
  {value: 'serif', label: 'Source Serif 4'},
  {value: 'dyslexic', label: 'OpenDyslexic (Offline)'},
  {value: 'mono', label: 'JetBrains Mono'},
  {value: 'system', label: 'System Sans'},
];

export const SettingsScreen: React.FC = () => {
  const {settings, updateSettings, resetSettings, refreshLibrary, showToast} =
    useAppContext();
  const [persistedStatus, setPersistedStatus] = useState<'unknown' | 'granted' | 'standard'>(
    'unknown'
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      void navigator.storage
        .persisted()
        .then((granted) => setPersistedStatus(granted ? 'granted' : 'standard'))
        .catch(() => setPersistedStatus('unknown'));
    }
  }, []);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const payload = await exportLibraryBackup();
      downloadBackupJson(payload);
      showToast(`Exported ${payload.documents.length} document(s) to JSON.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to export library backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (file: File) => {
    setIsImporting(true);
    try {
      const raw = await file.text();
      const summary = await importLibraryBackup(raw);
      await refreshLibrary();
      showToast(
        `Imported ${summary.importedDocuments} document(s), skipped ${summary.skippedDuplicates} duplicate(s).`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to import backup file.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Settings
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Global preferences and local library backup.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void resetSettings()}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Reset defaults</span>
        </button>
      </header>

      {/* Appearance & Theme */}
      <section className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Appearance</h2>

        <div>
          <div className="mb-2 text-sm font-medium text-[var(--text-primary)]">Theme</div>
          <div className="grid grid-cols-3 gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => void updateSettings({theme: t})}
                className={`min-h-[44px] rounded-xl border text-sm font-medium capitalize ${
                  settings.theme === t
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label htmlFor="global-font-family" className="block text-sm font-medium mb-1.5">
              Default reading font
            </label>
            <select
              id="global-font-family"
              value={settings.fontFamily}
              onChange={(e) => void updateSettings({fontFamily: e.target.value})}
              className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="global-font-size" className="block text-sm font-medium mb-1.5">
              Font size ({settings.fontSize}px)
            </label>
            <input
              id="global-font-size"
              type="range"
              min={28}
              max={76}
              step={2}
              value={settings.fontSize}
              onChange={(e) => void updateSettings({fontSize: Number(e.target.value)})}
              className="w-full mt-2 accent-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5">
            <label htmlFor="custom-text-color" className="text-sm font-medium">
              Custom reader ink
            </label>
            <div className="flex items-center gap-2">
              <input
                id="custom-text-color"
                type="color"
                value={settings.textColor ?? '#f3f4f6'}
                onChange={(e) => void updateSettings({textColor: e.target.value})}
                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
              />
              {settings.textColor && (
                <button
                  type="button"
                  onClick={() => void updateSettings({textColor: undefined})}
                  className="text-xs text-[var(--accent-primary)] underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5">
            <label htmlFor="custom-bg-color" className="text-sm font-medium">
              Custom reader canvas
            </label>
            <div className="flex items-center gap-2">
              <input
                id="custom-bg-color"
                type="color"
                value={settings.backgroundColor ?? '#0b0d10'}
                onChange={(e) => void updateSettings({backgroundColor: e.target.value})}
                className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
              />
              {settings.backgroundColor && (
                <button
                  type="button"
                  onClick={() => void updateSettings({backgroundColor: undefined})}
                  className="text-xs text-[var(--accent-primary)] underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pacing Defaults */}
      <section className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Sequential Word Display Defaults
        </h2>

        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <label htmlFor="global-wpm" className="font-medium">
              Default speed
            </label>
            <span className="tabular-nums text-[var(--text-secondary)]">{settings.wpm} WPM</span>
          </div>
          <input
            id="global-wpm"
            type="range"
            min={TIMING_CONSTANTS.MIN_WPM}
            max={settings.maxWpmCap ?? TIMING_CONSTANTS.MAX_WPM}
            step={TIMING_CONSTANTS.WPM_STEP}
            value={settings.wpm}
            onChange={(e) => void updateSettings({wpm: Number(e.target.value)})}
            className="w-full accent-[var(--accent-primary)]"
          />
        </div>

        <div>
          <div className="mb-1.5 text-sm font-medium">Words per flash</div>
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as ChunkSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => void updateSettings({wordsPerFlash: size})}
                className={`min-h-[44px] rounded-xl border text-xs font-semibold tabular-nums ${
                  settings.wordsPerFlash === size
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)]'
                }`}
              >
                {size} {size === 1 ? 'word' : 'words'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Backup & Storage Safeguard */}
      <section className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Library Backup &amp; Local Storage
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
            Export your entire library, reading progress, sessions, and settings into one portable
            JSON file. Safari may clear website storage after roughly a week of inactivity unless
            installed to the Home Screen.
          </p>
        </div>

        <div className="text-xs text-[var(--text-secondary)]">
          Browser persistent storage:{' '}
          <strong className="text-[var(--text-primary)]">
            {persistedStatus === 'granted'
              ? 'Granted'
              : persistedStatus === 'standard'
                ? 'Best-effort (requested on first save)'
                : 'Not reported by browser'}
          </strong>
        </div>

        <input
          ref={backupInputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportBackup(f);
            e.target.value = '';
          }}
        />

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void handleExportBackup()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-canvas)] hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{isExporting ? 'Exporting…' : 'Export Library JSON'}</span>
          </button>

          <button
            type="button"
            disabled={isImporting}
            onClick={() => backupInputRef.current?.click()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>{isImporting ? 'Importing…' : 'Import Backup JSON'}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
