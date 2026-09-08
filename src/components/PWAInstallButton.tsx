import React, { useState } from 'react';
import { Download, Share2, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA on home screen, do not show
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        id="btn-pwa-install-header"
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold shadow-md shadow-emerald-950 transition-all hover:scale-105 active:scale-95"
        title="Install InterviewGym App on your device"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          id="btn-pwa-install-ios"
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-medium transition-colors"
          title="Install on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Add to Home</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-stone-900 border border-stone-800 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-stone-950 font-black text-xs">
                    IG
                  </div>
                  <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-stone-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl bg-stone-950 p-4 border border-stone-800/80 space-y-3 text-xs text-stone-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                    1
                  </div>
                  <p>
                    Tap the <strong className="text-white">Share</strong> button <Share2 className="w-3.5 h-3.5 inline text-sky-400 mx-0.5" /> in the Safari toolbar at the bottom or top of your screen.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                    2
                  </div>
                  <p>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                    3
                  </div>
                  <p>
                    Tap <strong className="text-emerald-400">Add</strong> in the top right. InterviewGym AI will launch full-screen like a native app.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-stone-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for other browsers: provide a simple install button in case beforeinstallprompt triggers later or to show instructions
  return null;
};
