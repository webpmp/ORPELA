import {useCallback, useEffect, useState} from 'react';

export type AppRoute =
  | {name: 'library'}
  | {name: 'import'}
  | {name: 'read'; documentId: string}
  | {name: 'settings'}
  | {name: 'help'};

function parseHash(hash: string): AppRoute {
  const cleaned = hash.replace(/^#\/?/, '').trim();
  if (!cleaned || cleaned === '/') {
    return {name: 'library'};
  }
  const parts = cleaned.split('/').filter(Boolean);
  if (parts[0] === 'import') return {name: 'import'};
  if (parts[0] === 'settings') return {name: 'settings'};
  if (parts[0] === 'help') return {name: 'help'};
  if (parts[0] === 'read' && parts[1]) {
    return {name: 'read', documentId: decodeURIComponent(parts[1])};
  }
  return {name: 'library'};
}

export function useHashRoute() {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseHash(typeof window !== 'undefined' ? window.location.hash : '')
  );

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((path: string) => {
    const normalized = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
    if (window.location.hash !== normalized) {
      window.location.hash = normalized;
    } else {
      setRoute(parseHash(normalized));
    }
  }, []);

  return {route, navigate};
}
