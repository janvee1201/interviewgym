import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      id="pwa-offline-banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex items-center justify-between gap-3 rounded-xl bg-amber-950/90 border border-amber-700/80 px-4 py-2.5 text-xs font-semibold text-amber-200 shadow-2xl backdrop-blur-md animate-bounce"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
        <span>You are currently offline. Cached lessons and offline practice are available.</span>
      </div>
    </div>
  );
};
