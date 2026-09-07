import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { RandomSpeakingView } from './components/RandomSpeakingView';
import { LearnTopicView } from './components/LearnTopicView';
import { ExplainTopicView } from './components/ExplainTopicView';
import { InterviewView } from './components/InterviewView';
import { RapidReviewView } from './components/RapidReviewView';
import { DebateView } from './components/DebateView';
import { CurrentTopicsView } from './components/CurrentTopicsView';
import { ProgressAnalyticsView } from './components/ProgressAnalyticsView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { NavigationTab, UserPerformanceProfile, DailyPlan, SpeakingSessionRecord } from './types';
import { getProfile, getDailyPlan, getSpeakingSessions } from './lib/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [profile, setProfile] = useState<UserPerformanceProfile>(getProfile());
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(getDailyPlan());
  const [speakingSessions, setSpeakingSessions] = useState<SpeakingSessionRecord[]>([]);

  // Inter-tab navigation parameter state (e.g. passing a topic from Learn or Dashboard to Explain)
  const [explainTopic, setExplainTopic] = useState<string>('Database Indexing (B-Trees vs Hash)');
  const [explainDomain, setExplainDomain] = useState<string>('CS Fundamentals');

  useEffect(() => {
    setSpeakingSessions(getSpeakingSessions());
  }, [activeTab]);

  const handleNavigate = (tab: NavigationTab, params?: Record<string, any>) => {
    if (tab === 'explain' && params?.topic) {
      setExplainTopic(params.topic);
      if (params.domain) setExplainDomain(params.domain);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-['Plus_Jakarta_Sans'] selection:bg-emerald-500 selection:text-stone-950">
      {/* Top Fixed / Sticky Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => handleNavigate(tab)}
        streakDays={profile.streakDays}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            profile={profile}
            dailyPlan={dailyPlan}
            onUpdateDailyPlan={(plan) => setDailyPlan(plan)}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'speaking' && <RandomSpeakingView />}

        {activeTab === 'learn' && (
          <LearnTopicView
            onGoToExplain={(topic, domain) => {
              handleNavigate('explain', { topic, domain });
            }}
          />
        )}

        {activeTab === 'explain' && (
          <ExplainTopicView
            initialTopic={explainTopic}
            initialDomain={explainDomain}
          />
        )}

        {activeTab === 'interview' && <InterviewView />}

        {activeTab === 'quick' && <RapidReviewView />}

        {activeTab === 'debate' && <DebateView />}

        {activeTab === 'trends' && <CurrentTopicsView onNavigate={handleNavigate} />}

        {activeTab === 'progress' && (
          <ProgressAnalyticsView
            profile={profile}
            sessions={speakingSessions}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileSettingsView
            profile={profile}
            onUpdateProfile={(p) => setProfile(p)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-900 py-6 text-center text-xs text-stone-500">
        <p>InterviewGym AI — Learn. Speak. Explain. Interview. Improve.</p>
        <p className="mt-1 text-[11px] text-stone-600">
          Powered by Gemini 2.5 • Web Speech API Audio Engine • High-Pressure Impromptu Simulator
        </p>
      </footer>
    </div>
  );
}
