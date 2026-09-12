import React, { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthScreen: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    authError,
    clearError,
  } = useAuth();

  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch {
      // Error handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* App Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center mx-auto text-stone-950 font-black text-xl shadow-lg shadow-emerald-950/50">
            IG
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
            InterviewGym<span className="text-emerald-400">AI</span>
          </h1>
          <p className="text-xs text-stone-400">
            Personal Performance Studio • Private & Encrypted
          </p>
        </div>

        {/* Security / Privacy Banner */}
        <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-3 text-xs text-emerald-200">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-white">Private Personal Workspace</span>
            <p className="text-emerald-300/80 text-[11px] leading-relaxed">
              Your speech transcripts, scores, and mock interview logs are completely isolated to your personal account.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {authError && (
          <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-relaxed">{authError}</div>
            <button onClick={clearError} className="text-red-400 hover:text-white font-bold ml-1" aria-label="Dismiss error">
              ✕
            </button>
          </div>
        )}

        {/* Authentication Actions */}
        <div className="space-y-3">
          <button
            onClick={signInWithGoogle}
            id="btn-auth-google"
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-stone-100 text-stone-900 font-bold text-sm shadow-md flex items-center justify-center gap-3 transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative py-2 flex items-center justify-center">
            <div className="border-t border-stone-800 w-full absolute" />
            <span className="bg-stone-900 px-3 text-[11px] text-stone-500 relative uppercase font-medium">
              or use email
            </span>
          </div>

          {!isEmailMode ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsEmailMode(true);
                  setIsSignUp(false);
                }}
                id="btn-auth-show-email-signin"
                className="py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors text-center"
              >
                Sign In with Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEmailMode(true);
                  setIsSignUp(true);
                }}
                id="btn-auth-show-email-signup"
                className="py-3 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700/80 border border-emerald-500/40 text-emerald-400 text-xs font-semibold transition-colors text-center"
              >
                Create Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-3 pt-1">
              <div className="flex border-b border-stone-800 mb-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className={`flex-1 pb-2 text-xs font-semibold border-b-2 transition-colors ${
                    !isSignUp
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className={`flex-1 pb-2 text-xs font-semibold border-b-2 transition-colors ${
                    isSignUp
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Create New Account
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-stone-400 mb-1 font-medium">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  id="auth-email-input"
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-400 mb-1 font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  id="auth-password-input"
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                id="btn-auth-submit-email"
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-stone-950 font-bold text-xs transition-colors"
              >
                {isSubmitting
                  ? 'Authenticating...'
                  : isSignUp
                  ? 'Register & Access Studio'
                  : 'Sign In'}
              </button>

              <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="hover:text-emerald-400 underline underline-offset-2"
                >
                  {isSignUp ? 'Have an account? Sign In' : 'Need an account? Register'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEmailMode(false)}
                  className="text-stone-500 hover:text-stone-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center text-[10px] text-stone-500">
          User-Isolated Cloud Storage • Encrypted Personal Workspace
        </div>
      </div>
    </div>
  );
};
