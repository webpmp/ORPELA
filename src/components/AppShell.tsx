import {
  BookOpen,
  FilePlus2,
  FileText,
  HelpCircle,
  Menu,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import React, {useCallback, useEffect, useState} from 'react';
import {APP_NAME} from '../config';
import {useReaderChrome} from '../context/ReaderChromeContext';
import type {AppRoute} from '../hooks/useHashRoute';
import {PWAInstallButton} from './PWAInstallButton';

interface AppShellProps {
  route: AppRoute;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
  initialMobileMenuOpen?: boolean;
}

export const NAV_ITEMS: Array<{
  id: Exclude<AppRoute['name'], 'read'>;
  label: string;
  path: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'library', label: 'Library', path: '/', icon: BookOpen},
  {id: 'import', label: 'Import', path: '/import', icon: FilePlus2},
  {id: 'settings', label: 'Settings', path: '/settings', icon: Settings},
  {id: 'help', label: 'Help', path: '/help', icon: HelpCircle},
];

export const AppShell: React.FC<AppShellProps> = ({
  route,
  onNavigate,
  children,
  initialMobileMenuOpen = false,
}) => {
  const {toolbar, chromeHidden, runExitGuard, pauseForMenu} = useReaderChrome();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(initialMobileMenuOpen);

  const isReaderRoute = route.name === 'read';
  const isChromeHidden = isReaderRoute && chromeHidden && !mobileMenuOpen;

  const routeDocId = route.name === 'read' ? route.documentId : '';

  // Always close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [route.name, routeDocId]);

  // Capture-phase Escape handling so closing mobile menu does not also trigger reader Esc exit
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [mobileMenuOpen]);

  const handleNavigate = useCallback(
    async (path: string) => {
      setMobileMenuOpen(false);
      await runExitGuard();
      onNavigate(path);
    },
    [onNavigate, runExitGuard]
  );

  const handleToggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => {
      const next = !prev;
      if (next && isReaderRoute) {
        pauseForMenu();
      }
      return next;
    });
  }, [isReaderRoute, pauseForMenu]);

  const headerContent = (
    <header
      data-testid="app-header"
      className={`isolate border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/90 backdrop-blur-md pt-safe ${
        isReaderRoute ? '' : 'sticky top-0 z-30'
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 md:gap-8 px-4 sm:px-6 px-safe ${
          isReaderRoute
            ? 'min-h-14 md:min-h-18 py-1.5 [@media(max-height:500px)]:min-h-11 [@media(max-height:500px)]:py-0.5'
            : 'min-h-14 md:min-h-18 py-1.5'
        }`}
      >
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            void handleNavigate('/');
          }}
          className="inline-flex flex-col items-center justify-center gap-0.5 md:gap-1 min-h-[44px] py-0.5 text-base md:text-lg font-bold leading-none tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-primary)]"
        >
          <span
            className={`brand-logo-frame block shrink-0 ${
              isReaderRoute ? 'h-6 md:h-8 [@media(max-height:500px)]:h-5' : 'h-6 md:h-8'
            }`}
            aria-hidden="true"
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/logo-orpela.png`}
              alt=""
              aria-hidden="true"
              width={1536}
              height={1024}
              decoding="async"
              loading="eager"
              className="brand-logo"
            />
          </span>
          <span>{APP_NAME}</span>
        </a>

        {/* Zone 2: Desktop Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const active = route.name === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.path}`}
                onClick={(e) => {
                  e.preventDefault();
                  void handleNavigate(item.path);
                }}
                aria-current={active ? 'page' : undefined}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  active
                    ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Mobile Menu Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:block">
            <PWAInstallButton variant="secondary" />
          </div>
          {!isReaderRoute && (
            <button
              type="button"
              onClick={() => void handleNavigate('/import')}
              className="min-h-[44px] rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-canvas)] whitespace-nowrap shrink-0 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
            >
              Import Text
            </button>
          )}
          <button
            type="button"
            data-testid="mobile-menu-button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
            onClick={handleToggleMobileMenu}
            className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Shared Top Chrome: fixed overlay on reader route (never shifts focal stage), sticky on other routes */}
      {isReaderRoute ? (
        <div
          data-testid="reader-top-chrome"
          aria-hidden={isChromeHidden ? true : undefined}
          inert={isChromeHidden ? true : undefined}
          className={`reader-chrome-transition fixed top-0 left-0 right-0 z-30 transition-opacity duration-200 ${
            isChromeHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {headerContent}

          {toolbar && (
            <div
              data-testid="reader-toolbar"
              className="border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/90 backdrop-blur-md"
            >
              <div className="mx-auto flex h-12 [@media(max-height:500px)]:h-10 max-w-6xl items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 px-safe">
                <h1 className="min-w-0 flex-1 truncate text-center text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                  {toolbar.title}
                </h1>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={toolbar.onTogglePlainView}
                    aria-pressed={toolbar.isPlainView}
                    className="min-h-[44px] min-w-[44px] [@media(max-height:500px)]:min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] whitespace-nowrap hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                  >
                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{toolbar.isPlainView ? 'SWD View' : 'Plain Text'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toolbar.onOpenSettings}
                    aria-label="Reader settings"
                    className="min-h-[44px] min-w-[44px] [@media(max-height:500px)]:min-h-[40px] flex items-center justify-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                  >
                    <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        headerContent
      )}

      {/* Dismissible Mobile Menu Panel (< md) */}
      {mobileMenuOpen && (
        <div
          data-testid="mobile-menu-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] pt-safe px-safe pb-safe"
        >
          <div
            id="mobile-nav-panel"
            data-testid="mobile-menu-panel"
            role="region"
            aria-label="Mobile menu"
            onClick={(e) => e.stopPropagation()}
            className="mx-3 mt-16 [@media(max-height:500px)]:mt-12 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 shadow-xl"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-hairline)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Navigation
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="min-h-[44px] min-w-[44px] -mr-1.5 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile navigation drawer" className="mt-1 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = route.name === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleNavigate(item.path)}
                    aria-current={active ? 'page' : undefined}
                    className={`min-h-[44px] w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                      active
                        ? 'bg-[var(--bg-subtle)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main
        className={
          isReaderRoute
            ? 'flex-1 flex flex-col min-h-0 w-full'
            : 'flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 px-safe'
        }
      >
        {children}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation Bar (hidden on reader route) */}
      {!isReaderRoute && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md pb-safe"
        >
          <div className="grid grid-cols-4 h-14">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = route.name === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleNavigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`min-h-[44px] flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};
