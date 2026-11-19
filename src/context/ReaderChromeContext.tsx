import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';

export interface ReaderToolbarConfig {
  title: string;
  isPlainView: boolean;
  onTogglePlainView: () => void;
  onOpenSettings: () => void;
}

interface ReaderChromeContextValue {
  toolbar: ReaderToolbarConfig | null;
  chromeHidden: boolean;
  setToolbar: (toolbar: ReaderToolbarConfig | null) => void;
  setChromeHidden: (hidden: boolean) => void;
  registerExitGuard: (guard: (() => Promise<void>) | null) => void;
  runExitGuard: () => Promise<void>;
  registerPauseForMenu: (fn: (() => void) | null) => void;
  pauseForMenu: () => void;
}

const noop = () => {};
const asyncNoop = async () => {};

const ReaderChromeContext = createContext<ReaderChromeContextValue>({
  toolbar: null,
  chromeHidden: false,
  setToolbar: noop,
  setChromeHidden: noop,
  registerExitGuard: noop,
  runExitGuard: asyncNoop,
  registerPauseForMenu: noop,
  pauseForMenu: noop,
});

interface ReaderChromeProviderProps {
  children: React.ReactNode;
  initialToolbar?: ReaderToolbarConfig | null;
  initialChromeHidden?: boolean;
}

export const ReaderChromeProvider: React.FC<ReaderChromeProviderProps> = ({
  children,
  initialToolbar = null,
  initialChromeHidden = false,
}) => {
  const [toolbar, setToolbar] = useState<ReaderToolbarConfig | null>(initialToolbar);
  const [chromeHidden, setChromeHidden] = useState(initialChromeHidden);

  const exitGuardRef = useRef<(() => Promise<void>) | null>(null);
  const pauseForMenuRef = useRef<(() => void) | null>(null);

  const registerExitGuard = useCallback((guard: (() => Promise<void>) | null) => {
    exitGuardRef.current = guard;
  }, []);

  const runExitGuard = useCallback(async () => {
    if (exitGuardRef.current) {
      await exitGuardRef.current();
    }
  }, []);

  const registerPauseForMenu = useCallback((fn: (() => void) | null) => {
    pauseForMenuRef.current = fn;
  }, []);

  const pauseForMenu = useCallback(() => {
    pauseForMenuRef.current?.();
  }, []);

  const value = useMemo<ReaderChromeContextValue>(
    () => ({
      toolbar,
      chromeHidden,
      setToolbar,
      setChromeHidden,
      registerExitGuard,
      runExitGuard,
      registerPauseForMenu,
      pauseForMenu,
    }),
    [
      toolbar,
      chromeHidden,
      registerExitGuard,
      runExitGuard,
      registerPauseForMenu,
      pauseForMenu,
    ]
  );

  return <ReaderChromeContext.Provider value={value}>{children}</ReaderChromeContext.Provider>;
};

export function useReaderChrome(): ReaderChromeContextValue {
  return useContext(ReaderChromeContext);
}
