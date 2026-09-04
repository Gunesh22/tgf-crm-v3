import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export function useAutoUpdater() {
  const currentVersionRef = useRef(null);
  const isReloadingRef = useRef(false);

  useEffect(() => {
    let checkInterval = null;

    const checkVersion = async () => {
      if (isReloadingRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;

        const text = await res.text();
        const trimmed = text.trim();
        if (!trimmed.startsWith('{')) return; // Silently skip raw JS/HTML dev mode fallbacks

        let data = null;
        try {
          data = JSON.parse(trimmed);
        } catch {
          return; // Ignore non-JSON responses silently
        }

        const serverVersion = data?.version;
        if (!serverVersion || serverVersion === 'dev_build') return;

        if (!currentVersionRef.current) {
          // Store initial version on first load
          currentVersionRef.current = serverVersion;
          console.log(`[AUTO UPDATER] Current deployment version: ${serverVersion}`);
        } else if (currentVersionRef.current !== serverVersion) {
          // New deployment detected!
          console.log(`[AUTO UPDATER] New version detected: ${serverVersion} (Current: ${currentVersionRef.current})`);
          isReloadingRef.current = true;
          toast.loading("🚀 New CRM update deployed! Updating app in 2 seconds...", {
            id: 'auto-update-toast',
            duration: 3000
          });
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch {
        // Silent catch for network hiccups
      }
    };

    // Check version on initial mount
    checkVersion();

    // Check version whenever user switches tab back to CRM
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check every 5 minutes for long active sessions
    checkInterval = setInterval(checkVersion, 300000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);
}
