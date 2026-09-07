import React from 'react';
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
} from 'lucide-react';
import { NavigationTab } from '../types';

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
  const navItems: { id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Sparkles },
    { id: 'speaking', label: 'Random Speaking', icon: Mic },
    { id: 'learn', label: 'Learn a Topic', icon: Brain },
    { id: 'explain', label: 'Learn → Explain', icon: MessageSquareQuote },
    { id: 'interview', label: 'Interview Simulator', icon: Briefcase },
    { id: 'quick', label: '5-Min Drill', icon: Zap },
    { id: 'debate', label: 'Debate Mode', icon: Swords },
    { id: 'current', label: 'Current Affairs', icon: Globe },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'history', label: 'History & Replay', icon: History },
  ];

  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onSelectTab('dashboard')}
            id="nav-brand-btn"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-stone-950 font-extrabold text-lg shadow-md group-hover:scale-105 transition-transform">
              IG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white font-['Plus_Jakarta_Sans']">
                  InterviewGym<span className="text-emerald-400">AI</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                  Pro Coach
                </span>
              </div>
              <p className="text-[11px] text-stone-400 hidden sm:block">
                Learn. Speak. Explain. Interview. Improve.
              </p>
            </div>
          </div>

          {/* Right Header Statuses */}
          <div className="flex items-center gap-3">
            {/* Streak Badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs font-semibold"
              title="Consecutive practice streak"
              id="header-streak-badge"
            >
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{streakDays} Day Streak</span>
            </div>

            {/* Audio Voice Test */}
            <button
              onClick={() => {
                if ('speechSynthesis' in window) {
                  const u = new SpeechSynthesisUtterance("Welcome to InterviewGym AI. Let's practice!");
                  window.speechSynthesis.speak(u);
                }
              }}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
              title="Test Coach Voice"
              id="header-test-audio-btn"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
              title="Settings & Data"
              id="header-settings-btn"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Navigation Pills */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar border-t border-stone-800/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
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
    </header>
  );
};
