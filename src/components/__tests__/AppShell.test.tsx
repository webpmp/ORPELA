import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {ReaderChromeProvider, type ReaderToolbarConfig} from '../../context/ReaderChromeContext';
import type {AppRoute} from '../../hooks/useHashRoute';
import {AppShell, NAV_ITEMS} from '../AppShell';

const noop = () => {};

function renderShell(
  route: AppRoute,
  options: {
    toolbar?: ReaderToolbarConfig | null;
    chromeHidden?: boolean;
    initialMobileMenuOpen?: boolean;
  } = {}
): string {
  return renderToStaticMarkup(
    <ReaderChromeProvider
      initialToolbar={options.toolbar ?? null}
      initialChromeHidden={options.chromeHidden ?? false}
    >
      <AppShell
        route={route}
        onNavigate={noop}
        initialMobileMenuOpen={options.initialMobileMenuOpen}
      >
        <div data-testid="route-content">Route: {route.name}</div>
      </AppShell>
    </ReaderChromeProvider>
  );
}

describe('AppShell shared header & navigation', () => {
  const routes: AppRoute[] = [
    {name: 'library'},
    {name: 'import'},
    {name: 'settings'},
    {name: 'help'},
    {name: 'read', documentId: 'doc-1'},
  ];

  it('renders the shared app header with logo and Orpela wordmark on every route', () => {
    for (const route of routes) {
      const html = renderShell(route, {
        toolbar:
          route.name === 'read'
            ? {
                title: 'Meditations Book IV',
                isPlainView: false,
                onTogglePlainView: noop,
                onOpenSettings: noop,
              }
            : null,
      });

      const headerMatches = html.match(/data-testid="app-header"/g) ?? [];
      expect(headerMatches).toHaveLength(1);
      expect(html).toContain('href="#/"');
      expect(html).toContain('assets/logo-orpela.png');
      expect(html).toContain('Orpela');
      expect(html).toContain('data-testid="mobile-menu-button"');
      expect(html).toContain('aria-label="Open menu"');
      expect(html).toContain('aria-controls="mobile-nav-panel"');
    }
  });

  it('marks the active desktop nav link with aria-current="page" on non-reader routes and none on reader', () => {
    for (const item of NAV_ITEMS) {
      const html = renderShell({name: item.id});
      const escapedHref = `href="#${item.path}"`;
      const activePattern = new RegExp(`${escapedHref}[^>]*aria-current="page"`);
      expect(html).toMatch(activePattern);
      const currentMatches = html.match(/aria-current="page"/g) ?? [];
      // 1 in desktop nav + 1 in mobile bottom bar
      expect(currentMatches).toHaveLength(2);
    }

    const readerHtml = renderShell(
      {name: 'read', documentId: 'doc-1'},
      {
        toolbar: {
          title: 'Meditations',
          isPlainView: false,
          onTogglePlainView: noop,
          onOpenSettings: noop,
        },
      }
    );
    expect(readerHtml).not.toContain('aria-current="page"');
  });

  it('shows "Import Text" CTA on non-reader routes and hides it on the reader route', () => {
    for (const route of routes.filter((r) => r.name !== 'read')) {
      const html = renderShell(route);
      expect(html).toContain('>Import Text</button>');
      expect(html).toContain('aria-label="Mobile navigation"');
    }

    const readerHtml = renderShell(
      {name: 'read', documentId: 'doc-1'},
      {
        toolbar: {
          title: 'Meditations',
          isPlainView: false,
          onTogglePlainView: noop,
          onOpenSettings: noop,
        },
      }
    );
    expect(readerHtml).not.toContain('Import Text');
    expect(readerHtml).not.toContain('aria-label="Mobile navigation"');
  });

  it('renders the slim reader toolbar directly below the header with title, Plain Text toggle, settings button, and no back-arrow button', () => {
    const html = renderShell(
      {name: 'read', documentId: 'doc-1'},
      {
        toolbar: {
          title: 'A Very Long Document Title That Should Truncate Gracefully',
          isPlainView: false,
          onTogglePlainView: noop,
          onOpenSettings: noop,
        },
      }
    );

    expect(html).toContain('data-testid="reader-top-chrome"');
    expect(html).toContain('data-testid="reader-toolbar"');
    expect(html).toContain('A Very Long Document Title That Should Truncate Gracefully');
    expect(html).toContain('truncate text-center');
    expect(html).toContain('>Plain Text</span>');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="Reader settings"');
    expect(html).toContain('min-h-[44px] min-w-[44px]');
    expect(html).not.toContain('aria-label="Back to library"');
  });

  it('renders the mobile menu panel listing all 4 destinations with safe-area padding and no focus trap', () => {
    const html = renderShell(
      {name: 'settings'},
      {
        initialMobileMenuOpen: true,
      }
    );

    expect(html).toContain('data-testid="mobile-menu-backdrop"');
    expect(html).toContain('id="mobile-nav-panel"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Close menu"');
    expect(html).toContain('pt-safe');
    expect(html).toContain('px-safe');
    expect(html).toContain('pb-safe');
    expect(html).not.toContain('aria-modal="true"');

    for (const item of NAV_ITEMS) {
      expect(html).toContain(`<span>${item.label}</span>`);
    }
  });
});
