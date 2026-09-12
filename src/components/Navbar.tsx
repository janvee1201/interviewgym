import React, { useState, useEffect } from 'react';
import {
  Mic,
  Brain,
  MessageSquareQuote,
  Briefcase,
  Zap,
  Swords,
  Globe,
  BarChart3,
  History,
  Flame,
  Settings,
  Sparkles,
  Volume2,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';
import { NavigationTab } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  streakDays: number;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  streakDays,
  onOpenSettings,
}) => {
  const { user, signOutUser } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Prevent background body scrolling when mobile navigation drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsMobileMenuOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen]);

  const navItems: { id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }>; desc?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Sparkles, desc: 'Mastery overview & daily training' },
    { id: 'speaking', label: 'Random Speaking', icon: Mic, desc: '1–3 min impromptu speaking drills' },
    { id: 'learn', label: 'Learn a Topic', icon: Brain, desc: '17-part deep technical syllabi' },
    { id: 'explain', label: 'Learn → Explain', icon: MessageSquareQuote, desc: 'Verbal active recall test' },
    { id: 'interview', label: 'Interview Simulator', icon: Briefcase, desc: 'Mock interviews with stress mode' },
    { id: 'quick', label: '5-Min Drill', icon: Zap, desc: 'Rapid 3-audience explanation drill' },
    { id: 'debate', label: 'Debate Mode', icon: Swords, desc: 'Argue engineering tradeoffs' },
    { id: 'current', label: 'AI Tools & Model Landscape', icon: Sparkles, desc: 'AI models, coding agents, infra & ecosystem' },
    { id: 'progress', label: 'Progress Analytics', icon: BarChart3, desc: '10-axis radar & mastery metrics' },
    { id: 'history', label: 'Session History', icon: History, desc: 'Transcripts, feedback & replay' },
  ];

  const handleSelect = (tab: NavigationTab) => {
    onSelectTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-stone-900 border-b border-stone-800 text-stone-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Left section: Hamburger button (mobile) + Brand Logo */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile Hamburger Button (☰) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-stone-300 hover:text-white bg-stone-800/90 hover:bg-stone-800 border border-stone-700/60 transition-colors flex items-center justify-center shrink-0 min-w-[42px] min-h-[42px]"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
              id="mobile-nav-toggle-btn"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-emerald-400" /> : <Menu className="w-5 h-5 text-emerald-400" />}
            </button>

            {/* Logo & Brand */}
            <div
              className="flex items-center gap-2 cursor-pointer group min-w-0"
              onClick={() => handleSelect('dashboard')}
              id="nav-brand-btn"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-stone-950 font-extrabold text-base sm:text-lg shadow-md group-hover:scale-105 transition-transform shrink-0">
                IG
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-base sm:text-lg tracking-tight text-white font-['Plus_Jakarta_Sans'] truncate">
                    InterviewGym<span className="text-emerald-400">AI</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded hidden xs:inline">
                    Personal
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 hidden sm:block truncate">
                  Learn. Speak. Explain. Interview. Improve.
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Statuses & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* PWA Install Button (Header) */}
            <PWAInstallButton variant="header" className="hidden sm:flex" />

            {/* Streak Badge */}
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs font-semibold shrink-0"
              title="Consecutive practice streak"
              id="header-streak-badge"
            >
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-pulse shrink-0" />
              <span>{streakDays} <span className="hidden sm:inline">Day Streak</span><span className="sm:hidden">d</span></span>
            </div>

            {/* Audio Voice Test (hidden on mobile to prevent overflow) */}
            <button
              onClick={() => {
                if ('speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance("Welcome to InterviewGym AI. Let's practice!");
                  window.speechSynthesis.speak(u);
                }
              }}
              className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors hidden sm:flex"
              title="Test Coach Voice"
              id="header-test-audio-btn"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
              title="Settings & Data"
              id="header-settings-btn"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile / Sign Out dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-stone-800 transition-colors"
                  id="header-user-menu-btn"
                  title={user.email || 'User profile'}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-emerald-500/60 object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-xs text-emerald-400 font-bold">
                      {user.email ? user.email[0].toUpperCase() : 'U'}
                    </div>
                  )}
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl p-3 space-y-2 z-50 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-2 bg-stone-950 rounded-xl space-y-1">
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Personal Workspace</span>
                      </div>
                      <p className="text-white font-medium truncate">{user.displayName || 'Personal Account'}</p>
                      <p className="text-stone-400 truncate text-[11px]">{user.email}</p>
                    </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        signOutUser();
                      }}
                      id="btn-signout"
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-950/50 transition-colors font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Pills on Desktop and Tablet */}
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar border-t border-stone-800/60 touch-pan-x">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                id={`nav-tab-${item.id}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-stone-950 font-semibold shadow-sm shadow-emerald-950'
                    : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-stone-950' : 'text-stone-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Navigation Backdrop & Drawer */}
      {isMobileMenuOpen && (
        <>
          {/* Clickable Backdrop Overlay */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Navigation Drawer */}
          <div
            className="md:hidden fixed inset-y-0 left-0 z-50 w-[85%] max-w-sm bg-stone-950 border-r border-stone-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-200"
            id="mobile-navigation-drawer"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-900/90 shrink-0">
              <div
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => handleSelect('dashboard')}
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-stone-950 font-extrabold text-sm shadow-md">
                  IG
                </div>
                <div>
                  <span className="font-bold text-sm tracking-tight text-white font-['Plus_Jakarta_Sans']">
                    InterviewGym<span className="text-emerald-400">AI</span>
                  </span>
                  <p className="text-[10px] text-stone-400">Mastery Navigation</p>
                </div>
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                aria-label="Close menu"
                id="btn-close-mobile-menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Navigation Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 overscroll-contain">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                All Sections
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    id={`mobile-nav-item-${item.id}`}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-stone-950 font-bold shadow-md shadow-emerald-950'
                        : 'bg-stone-900/60 text-stone-200 hover:bg-stone-850 hover:text-white border border-stone-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isActive ? 'bg-emerald-600 text-stone-950' : 'bg-stone-800 text-emerald-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{item.label}</div>
                        {item.desc && (
                          <div
                            className={`text-[11px] truncate ${
                              isActive ? 'text-stone-900/90' : 'text-stone-400'
                            }`}
                          >
                            {item.desc}
                          </div>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-stone-950 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer with Install App, Streak, Settings & Account */}
            <div className="p-3 border-t border-stone-800 bg-stone-900/80 shrink-0 space-y-2">
              {/* Install App option in mobile menu */}
              <PWAInstallButton variant="mobile-drawer" />

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-950 border border-stone-800/80 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>{streakDays} Day Practice Streak</span>
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800"
                  title="Settings & Data"
                  id="mobile-drawer-settings-btn"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {user && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-950 border border-stone-800/80 text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="text-stone-200 font-medium truncate text-[11px]">
                      {user.displayName || user.email}
                    </p>
                    <p className="text-stone-500 truncate text-[10px]">Personal Account</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      signOutUser();
                    }}
                    id="mobile-drawer-signout-btn"
                    className="text-rose-400 hover:text-rose-300 text-[11px] font-bold px-2 py-1 rounded bg-rose-950/40 border border-rose-900/60 shrink-0 flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
};
