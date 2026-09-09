import React from 'react';
import { X, Share2, MoreVertical, Smartphone, CheckCircle, Download } from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  isAndroid: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  isAndroid,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 shadow-2xl space-y-5 text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-stone-950 font-black text-sm shadow-md">
              IG
            </div>
            <div>
              <h2 id="pwa-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                Install InterviewGym AI
              </h2>
              <p className="text-xs text-stone-400">Add to your home screen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Benefits preview */}
        <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-300">
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-stone-950/80 border border-stone-800/80">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Standalone Full-Screen</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-stone-950/80 border border-stone-800/80">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">1-Tap Quick Launch</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-xl bg-stone-950 p-4 border border-stone-800/80 space-y-3.5 text-xs text-stone-300">
          {isIOS ? (
            <>
              <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                <span>Instructions for Apple iOS (Safari)</span>
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-[11px]">
                    1
                  </span>
                  <p>
                    Tap the <strong className="text-white">Share</strong> button{' '}
                    <Share2 className="w-3.5 h-3.5 inline text-sky-400 mx-0.5" /> in Safari's toolbar.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-[11px]">
                    2
                  </span>
                  <p>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-[11px]">
                    3
                  </span>
                  <p>
                    Tap <strong className="text-emerald-400">Add</strong> in the top right. InterviewGym AI will appear on your home screen.
                  </p>
                </div>
              </div>
            </>
          ) : isAndroid ? (
            <>
              <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                <span>Instructions for Android (Chrome / Edge)</span>
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-[11px]">
                    1
                  </span>
                  <p>
                    Tap the <strong className="text-white">three dots menu (⋮)</strong>{' '}
                    <MoreVertical className="w-3.5 h-3.5 inline text-stone-300 mx-0.5" /> in your browser's top bar.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-[11px]">
                    2
                  </span>
                  <p>
                    Tap <strong className="text-white">Install App</strong> or{' '}
                    <strong className="text-white">Add to Home screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-[11px]">
                    3
                  </span>
                  <p>
                    Tap <strong className="text-emerald-400">Install</strong> to confirm. The app will launch in full-screen standalone mode.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Download className="w-4 h-4" />
                <span>To Install InterviewGym AI</span>
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-[11px]">
                    1
                  </span>
                  <p>
                    Open your browser menu <strong className="text-white">(⋮ or Share)</strong> or check the address bar for an install icon (⊕).
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-[11px]">
                    2
                  </span>
                  <p>
                    Select <strong className="text-white">Install App</strong> or <strong className="text-white">Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-emerald-500 text-stone-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-950"
        >
          Got It
        </button>
      </div>
    </div>
  );
};
