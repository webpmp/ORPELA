import {useEffect, useRef} from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    let cancelled = false;

    const acquire = async () => {
      if (!active || cancelled) return;
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {request: (type: 'screen') => Promise<WakeLockSentinelLike>};
        };
        if (nav.wakeLock && typeof nav.wakeLock.request === 'function') {
          const sentinel = await nav.wakeLock.request('screen');
          if (cancelled) {
            await sentinel.release();
          } else {
            sentinelRef.current = sentinel;
          }
        }
      } catch {
        // Degrade silently where Wake Lock is unsupported or denied
      }
    };

    const release = async () => {
      if (sentinelRef.current && !sentinelRef.current.released) {
        try {
          await sentinelRef.current.release();
        } catch {
          // Ignore release errors
        }
      }
      sentinelRef.current = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        void acquire();
      } else if (document.visibilityState === 'hidden') {
        void release();
      }
    };

    if (active) {
      void acquire();
      document.addEventListener('visibilitychange', onVisibilityChange);
    } else {
      void release();
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void release();
    };
  }, [active]);
}
