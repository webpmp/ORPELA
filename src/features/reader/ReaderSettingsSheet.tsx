import {X} from 'lucide-react';
import React from 'react';
import type {ChunkSize} from '../../engine/chunker';
import {TIMING_CONSTANTS} from '../../engine/timing';
import type {FontFamilyOption, ReaderSettings} from '../../types';

interface ReaderSettingsSheetProps {
  open: boolean;
  settings: ReaderSettings;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<ReaderSettings>) => Promise<void>;
}

const ORP_COLORS = [
  {label: 'Crimson', value: '#DC2626'},
  {label: 'Coral', value: '#F87171'},
  {label: 'Cobalt', value: '#2563EB'},
  {label: 'Amber', value: '#D97706'},
  {label: 'Emerald', value: '#059669'},
];

const FONT_OPTIONS: Array<{value: FontFamilyOption; label: string}> = [
  {value: 'sans', label: 'Plus Jakarta Sans'},
  {value: 'serif', label: 'Source Serif 4'},
  {value: 'dyslexic', label: 'OpenDyslexic (Offline)'},
  {value: 'mono', label: 'JetBrains Mono'},
  {value: 'system', label: 'System Sans'},
];

export const ReaderSettingsSheet: React.FC<ReaderSettingsSheetProps> = ({
  open,
  settings,
  onClose,
  onUpdateSettings,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-settings-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[85dvh] sm:max-h-full sm:max-w-md rounded-t-3xl sm:rounded-none sm:border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col overflow-hidden shadow-2xl pb-safe"
      >
        {/* Drag handle on phone */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="h-1.5 w-10 rounded-full bg-[var(--border-hairline)]" />
        </div>

        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
          <h2 id="reader-settings-title" className="text-base font-semibold text-[var(--text-primary)]">
            Reader Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reader settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7 text-sm">
          {/* Speed & Chunking */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
              Pacing &amp; Cadence
            </h3>

            <div>
              <div className="flex justify-between mb-1.5">
                <label htmlFor="setting-wpm" className="font-medium">
                  Reading speed
                </label>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  {settings.wpm} WPM
                </span>
              </div>
              <input
                id="setting-wpm"
                type="range"
                min={TIMING_CONSTANTS.MIN_WPM}
                max={settings.maxWpmCap ?? TIMING_CONSTANTS.MAX_WPM}
                step={TIMING_CONSTANTS.WPM_STEP}
                value={settings.wpm}
                onChange={(e) => void onUpdateSettings({wpm: Number(e.target.value)})}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            <div>
              <div className="mb-1.5 font-medium">Words per flash</div>
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as ChunkSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => void onUpdateSettings({wordsPerFlash: size})}
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

            <div>
              <div className="flex justify-between mb-1.5">
                <label htmlFor="setting-pause-strength" className="font-medium">
                  Punctuation pause strength
                </label>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  {settings.punctuationPauseStrength.toFixed(1)}x
                </span>
              </div>
              <input
                id="setting-pause-strength"
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={settings.punctuationPauseStrength}
                onChange={(e) =>
                  void onUpdateSettings({punctuationPauseStrength: Number(e.target.value)})
                }
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label htmlFor="setting-countdown" className="font-medium">
                  Start countdown
                </label>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  {settings.countdownSeconds}s
                </span>
              </div>
              <input
                id="setting-countdown"
                type="range"
                min={0}
                max={5}
                step={1}
                value={settings.countdownSeconds}
                onChange={(e) =>
                  void onUpdateSettings({countdownSeconds: Number(e.target.value)})
                }
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            <label className="flex min-h-[44px] items-center justify-between gap-3 cursor-pointer">
              <span className="font-medium">Auto-pause at paragraph breaks</span>
              <input
                type="checkbox"
                checked={settings.paragraphAutoPause}
                onChange={(e) =>
                  void onUpdateSettings({paragraphAutoPause: e.target.checked})
                }
                className="h-5 w-5 accent-[var(--accent-primary)]"
              />
            </label>

            <div>
              <label htmlFor="setting-max-cap" className="block font-medium mb-1.5">
                Maximum WPM cap (comfort limit)
              </label>
              <select
                id="setting-max-cap"
                value={settings.maxWpmCap ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  void onUpdateSettings({
                    maxWpmCap: val,
                    wpm: val ? Math.min(settings.wpm, val) : settings.wpm,
                  });
                }}
                className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-sm"
              >
                <option value="">No cap (up to 1,000 WPM)</option>
                <option value="400">400 WPM</option>
                <option value="500">500 WPM</option>
                <option value="650">650 WPM</option>
                <option value="800">800 WPM</option>
              </select>
            </div>
          </section>

          {/* Focal Point & Typography */}
          <section className="space-y-4 border-t border-[var(--border-hairline)] pt-5">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
              Display &amp; Typography
            </h3>

            <label className="flex min-h-[44px] items-center justify-between gap-3 cursor-pointer">
              <span className="font-medium">Highlight focal ORP character</span>
              <input
                type="checkbox"
                checked={settings.orpEnabled}
                onChange={(e) => void onUpdateSettings({orpEnabled: e.target.checked})}
                className="h-5 w-5 accent-[var(--accent-primary)]"
              />
            </label>

            {settings.orpEnabled && (
              <div>
                <div className="mb-2 font-medium">Focal highlight color</div>
                <div className="flex flex-wrap gap-2">
                  {ORP_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => void onUpdateSettings({orpColor: c.value})}
                      aria-label={`Focal color ${c.label}`}
                      aria-pressed={settings.orpColor === c.value}
                      className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-2 ${
                        settings.orpColor === c.value
                          ? 'border-[var(--text-primary)] bg-[var(--bg-subtle)]'
                          : 'border-[var(--border-hairline)]'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{backgroundColor: c.value}}
                        aria-hidden="true"
                      />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="setting-font-family" className="block font-medium mb-1.5">
                Font family
              </label>
              <select
                id="setting-font-family"
                value={settings.fontFamily}
                onChange={(e) => void onUpdateSettings({fontFamily: e.target.value})}
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
              <div className="flex justify-between mb-1.5">
                <label htmlFor="setting-font-size" className="font-medium">
                  Font size
                </label>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  {settings.fontSize}px
                </span>
              </div>
              <input
                id="setting-font-size"
                type="range"
                min={28}
                max={76}
                step={2}
                value={settings.fontSize}
                onChange={(e) => void onUpdateSettings({fontSize: Number(e.target.value)})}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label htmlFor="setting-font-weight" className="font-medium">
                  Font weight
                </label>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  {settings.fontWeight}
                </span>
              </div>
              <input
                id="setting-font-weight"
                type="range"
                min={400}
                max={700}
                step={100}
                value={settings.fontWeight}
                onChange={(e) => void onUpdateSettings({fontWeight: Number(e.target.value)})}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label htmlFor="setting-width" className="font-medium">
                  Reading focal width
                </label>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  {settings.readingWidth}px
                </span>
              </div>
              <input
                id="setting-width"
                type="range"
                min={340}
                max={960}
                step={20}
                value={settings.readingWidth}
                onChange={(e) => void onUpdateSettings({readingWidth: Number(e.target.value)})}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            <div>
              <div className="mb-1.5 font-medium">Theme</div>
              <div className="grid grid-cols-3 gap-2">
                {(['system', 'light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => void onUpdateSettings({theme: t})}
                    className={`min-h-[44px] rounded-xl border text-xs font-medium capitalize ${
                      settings.theme === t
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Optional Experiments (Honestly Framed per Section 14) */}
          <section className="space-y-4 border-t border-[var(--border-hairline)] pt-5">
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
                Optional Experiments
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                Speed-reading research is mixed; pushing speed often reduces comprehension. Use
                these pacing experiments only if they feel comfortable.
              </p>
            </div>

            <label className="flex min-h-[44px] items-center justify-between gap-3 cursor-pointer">
              <span className="font-medium">Faded surrounding context pane</span>
              <input
                type="checkbox"
                checked={settings.contextPane === 'faded'}
                onChange={(e) =>
                  void onUpdateSettings({contextPane: e.target.checked ? 'faded' : 'off'})
                }
                className="h-5 w-5 accent-[var(--accent-primary)]"
              />
            </label>

            <label className="flex min-h-[44px] items-center justify-between gap-3 cursor-pointer">
              <span className="font-medium">Gradual speed ramp (+25 WPM / 30s)</span>
              <input
                type="checkbox"
                checked={settings.speedRamp.enabled}
                onChange={(e) =>
                  void onUpdateSettings({
                    speedRamp: {...settings.speedRamp, enabled: e.target.checked},
                  })
                }
                className="h-5 w-5 accent-[var(--accent-primary)]"
              />
            </label>

            <label className="flex min-h-[44px] items-center justify-between gap-3 cursor-pointer">
              <span className="font-medium">Gradual chunk expansion (1 to 4 words)</span>
              <input
                type="checkbox"
                checked={settings.chunkExpansion.enabled}
                onChange={(e) =>
                  void onUpdateSettings({
                    chunkExpansion: {enabled: e.target.checked},
                  })
                }
                className="h-5 w-5 accent-[var(--accent-primary)]"
              />
            </label>
          </section>
        </div>
      </div>
    </div>
  );
};
