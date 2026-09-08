import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

// Primary authorized personal user email from configuration / metadata
export const AUTHORIZED_OWNER_EMAIL = 'j19897465@gmail.com';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthorized: boolean;
  isGuest: boolean;
  enterAsGuest: () => void;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return localStorage.getItem('interviewgym_guest_access') === 'true';
    } catch {
      return false;
    }
  });

  const enterAsGuest = () => {
    try {
      localStorage.setItem('interviewgym_guest_access', 'true');
    } catch {}
    setIsGuest(true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAuthorized = Boolean(
    user && (!user.email || user.email.toLowerCase() === AUTHORIZED_OWNER_EMAIL.toLowerCase())
  );

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups or use email sign-in.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled.');
      } else {
        setAuthError(err.message || 'Failed to sign in with Google.');
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      setAuthError(err.message || 'Failed to sign in.');
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error('Email sign-up error:', err);
      setAuthError(err.message || 'Failed to register account.');
      throw err;
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      localStorage.removeItem('interviewgym_guest_access');
    } catch {}
    setIsGuest(false);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const clearError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthorized,
        isGuest,
        enterAsGuest,
        authError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOutUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
