import React, { useState } from 'react';
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
  const { user, signOutUser, isAuthorized } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-stone-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            aria-label="Toggle navigation menu"
            id="mobile-nav-toggle-btn"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo & Tagline */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group min-w-0"
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

          {/* Right Header Statuses & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Streak Badge */}
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs font-semibold"
              title="Consecutive practice streak"
              id="header-streak-badge"
            >
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-pulse shrink-0" />
              <span>{streakDays} <span className="hidden sm:inline">Day Streak</span><span className="sm:hidden">d</span></span>
            </div>

            {/* Audio Voice Test */}
            <button
              onClick={() => {
                if ('speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance("Welcome to InterviewGym AI. Let's practice!");
                  window.speechSynthesis.speak(u);
                }
              }}
              className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors hidden xs:flex"
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
                        <span>Authorized Owner</span>
                      </div>
                      <p className="text-white font-medium truncate">{user.displayName || 'Authorized User'}</p>
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

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-stone-950/95 backdrop-blur-xl border-t border-stone-800 z-50 overflow-y-auto p-4 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-3 py-1">
            Navigation Hub
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-stone-950 font-bold'
                      : 'bg-stone-900/60 text-stone-200 hover:bg-stone-850 border border-stone-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-600 text-stone-950' : 'bg-stone-800 text-emerald-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      {item.desc && (
                        <div className={`text-[11px] ${isActive ? 'text-stone-900/80' : 'text-stone-400'}`}>
                          {item.desc}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {user && (
            <div className="pt-4 mt-4 border-t border-stone-800">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  signOutUser();
                }}
                className="w-full py-3 px-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 font-bold text-xs flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Sign Out ({user.email})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
