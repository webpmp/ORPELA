import {useCallback, useEffect, useRef, useState} from 'react';
import {registerSW} from 'virtual:pwa-register';

export function usePWAUpdate(isPlaybackActive: boolean) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    try {
      const updateSW = registerSW({
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onOfflineReady() {
          setOfflineReady(true);
        },
      });
      updateFnRef.current = updateSW;
    } catch {
      // Ignore registration issues in non-SW test environments
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    // Never reload while a reading session is actively playing
    if (isPlaybackActive) return;
    if (updateFnRef.current) {
      await updateFnRef.current(true);
    }
  }, [isPlaybackActive]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  return {
    needRefresh,
    offlineReady,
    applyUpdate,
    dismissUpdate,
  };
}
