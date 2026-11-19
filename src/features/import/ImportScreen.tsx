import {AlertCircle, AlertTriangle, FileText, Upload} from 'lucide-react';
import React, {useRef, useState} from 'react';
import {MAX_IMPORT_FILE_SIZE_MB} from '../../config';
import {useAppContext} from '../../context/AppContext';
import {importDocumentFile, importPastedText} from '../../services/importers';

interface ImportScreenProps {
  onNavigate: (path: string) => void;
}

type ImportTab = 'paste' | 'file';

export const ImportScreen: React.FC<ImportScreenProps> = ({onNavigate}) => {
  const {saveImportToLibrary, showToast} = useAppContext();

  const [tab, setTab] = useState<ImportTab>('paste');
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePasteSubmit = async (openImmediately: boolean) => {
    setErrorMessage(null);
    setWarnings([]);
    setIsProcessing(true);
    try {
      const imported = importPastedText(pastedText, title);
      const {document, duplicate} = await saveImportToLibrary(imported);
      if (duplicate) {
        showToast(`"${document.title}" is already in your library.`);
      } else {
        showToast(`Saved "${document.title}".`);
      }
      if (openImmediately) {
        onNavigate(`/read/${encodeURIComponent(document.id)}`);
      } else {
        onNavigate('/');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to import text.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFile = async (file: File) => {
    setErrorMessage(null);
    setWarnings([]);
    setProgressPercent(0);
    setIsProcessing(true);
    try {
      const imported = await importDocumentFile(file, (pct) => setProgressPercent(pct));
      if (imported.warnings.length > 0) {
        setWarnings(imported.warnings);
      }
      const {document, duplicate} = await saveImportToLibrary(imported, {
        fileName: file.name,
      });
      if (duplicate) {
        showToast(`"${document.title}" is already in your library.`);
      } else if (imported.warnings.length > 0) {
        showToast(`Imported "${document.title}" with notices.`);
      } else {
        showToast(`Imported "${document.title}".`);
      }
      if (imported.warnings.length === 0) {
        onNavigate(`/read/${encodeURIComponent(document.id)}`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to import file.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Import Reading Material
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Files are parsed locally in your browser. Nothing is uploaded.
        </p>
      </header>

      {/* Mode Switcher */}
      <div
        role="tablist"
        aria-label="Import method"
        className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'paste'}
          onClick={() => {
            setTab('paste');
            setErrorMessage(null);
          }}
          className={`min-h-[44px] rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors ${
            tab === 'paste'
              ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Paste Text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'file'}
          onClick={() => {
            setTab('file');
            setErrorMessage(null);
          }}
          className={`min-h-[44px] rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors ${
            tab === 'file'
              ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Upload File (TXT, PDF, EPUB)
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div>{errorMessage}</div>
        </div>
      )}

      {warnings.length > 0 && (
        <div
          role="status"
          className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Import notes</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="mt-2 min-h-[44px] rounded-xl bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-canvas)]"
          >
            View in Library
          </button>
        </div>
      )}

      {tab === 'paste' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handlePasteSubmit(true);
          }}
          className="space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6"
        >
          <div>
            <label
              htmlFor="paste-title"
              className="block text-sm font-medium text-[var(--text-primary)]"
            >
              Title (optional)
            </label>
            <input
              id="paste-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to first line or Untitled"
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--accent-primary)]"
            />
          </div>

          <div>
            <label
              htmlFor="paste-body"
              className="block text-sm font-medium text-[var(--text-primary)]"
            >
              Text
            </label>
            <textarea
              id="paste-body"
              rows={9}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste an article, essay, or chapter here..."
              className="mt-1.5 w-full scroll-mb-24 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-2 focus:outline-[var(--accent-primary)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isProcessing}
              className="min-h-[44px] rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isProcessing ? 'Saving…' : 'Save & Read'}
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void handlePasteSubmit(false)}
              className="min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
            >
              Save to Library
            </button>
          </div>
        </form>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void handleFile(dropped);
          }}
          className={`rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-colors ${
            isDragging
              ? 'border-[var(--accent-primary)] bg-[var(--bg-subtle)]'
              : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.epub,text/plain,application/pdf,application/epub+zip"
            className="sr-only"
            id="file-upload-input"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void handleFile(chosen);
              e.target.value = '';
            }}
          />

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-primary)]">
            <FileText className="h-6 w-6" aria-hidden="true" />
          </div>

          <h2 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
            Choose a TXT, PDF, or EPUB file
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Maximum file size {MAX_IMPORT_FILE_SIZE_MB} MB. PDF and EPUB parsing run in a
            background worker.
          </p>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>{isProcessing ? 'Parsing file…' : 'Select file'}</span>
            </button>
          </div>

          {isProcessing && (
            <div className="mx-auto mt-6 max-w-xs space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all"
                  style={{width: `${progressPercent}%`}}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                Extracting text… {progressPercent}%
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
