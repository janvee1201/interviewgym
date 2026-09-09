import React, { useState } from 'react';
import { Download, CheckCircle, Smartphone, Info } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  variant?: 'header' | 'mobile-drawer' | 'settings';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setModalOpen(true);
      }
    } else {
      setModalOpen(true);
    }
  };

  // 1. SETTINGS VIEW VARIANT
  if (variant === 'settings') {
    return (
      <>
        <div className="rounded-2xl bg-stone-950 border border-stone-800 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Mobile App & PWA Installation
                </h3>
              </div>
              <p className="text-xs text-stone-400 max-w-xl">
                Install InterviewGym AI directly onto your home screen for full-screen standalone practice, zero address bar distractions, and offline caching.
              </p>
            </div>

            <div className="shrink-0">
              {isInstalled ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Installed (Standalone)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleClick}
                  id="btn-settings-install-pwa"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold shadow-md shadow-emerald-950 transition-all hover:scale-105 active:scale-95"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Install App</span>
                </button>
              )}
            </div>
          </div>

          {!isInstalled && (
            <div className="flex items-start gap-2 pt-2 border-t border-stone-800/60 text-[11px] text-stone-400">
              <Info className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
              <span>
                Supported on Android (Chrome/Edge/Samsung Internet), iOS Safari (Add to Home Screen), and Desktop Chrome/Edge.
              </span>
            </div>
          )}
        </div>

        <PWAInstallModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          isIOS={isIOS}
          isAndroid={isAndroid}
        />
      </>
    );
  }

  // 2. MOBILE DRAWER VARIANT
  if (variant === 'mobile-drawer') {
    if (isInstalled) {
      return (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-950 border border-stone-800/80 text-xs text-stone-400">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold text-stone-200">Installed on Home Screen</span>
            <p className="text-[10px] text-stone-500">Running in standalone mode</p>
          </div>
        </div>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          id="btn-mobile-drawer-install-pwa"
          className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-stone-950 font-bold shadow-lg shadow-emerald-950/50 hover:brightness-105 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-stone-950/20 text-stone-950 shrink-0">
              <Download className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-sm font-extrabold leading-tight truncate">Install App</div>
              <div className="text-[11px] text-stone-950/80 font-semibold truncate">
                Add to your phone home screen
              </div>
            </div>
          </div>
          <span className="text-[10px] uppercase font-black tracking-wider bg-stone-950 text-emerald-300 px-2 py-0.5 rounded shrink-0 ml-2">
            PWA
          </span>
        </button>

        <PWAInstallModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          isIOS={isIOS}
          isAndroid={isAndroid}
        />
      </>
    );
  }

  // 3. HEADER VARIANT (DEFAULT)
  // Hide if already running in standalone installed mode
  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        id="btn-pwa-install-header"
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all ${
          isInstallable
            ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-md shadow-emerald-950 hover:scale-105 active:scale-95'
            : 'bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700'
        } ${className}`}
        title="Install InterviewGym AI app"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Install App</span>
      </button>

      <PWAInstallModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        isIOS={isIOS}
        isAndroid={isAndroid}
      />
    </>
  );
};
