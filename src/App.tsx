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
import { HistoryView } from './components/HistoryView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthScreen } from './components/AuthScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  NavigationTab,
  UserPerformanceProfile,
  DailyPlan,
  SpeakingSessionRecord,
  ExplainSessionRecord,
  InterviewSession,
} from './types';
import {
  getProfile,
  getDailyPlan,
  getSpeakingSessions,
  getExplainSessions,
  getInterviewSessions,
  syncUserDataWithFirestore,
} from './lib/storage';

function AppContent() {
  const { user, loading, isAuthorized, isGuest } = useAuth();
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [profile, setProfile] = useState<UserPerformanceProfile>(getProfile());
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(getDailyPlan());
  const [speakingSessions, setSpeakingSessions] = useState<SpeakingSessionRecord[]>([]);
  const [explainSessions, setExplainSessions] = useState<ExplainSessionRecord[]>([]);
  const [interviewSessions, setInterviewSessions] = useState<InterviewSession[]>([]);

  // Inter-tab navigation parameter state (e.g. passing a topic from Learn or History to Explain/Speaking)
  const [explainTopic, setExplainTopic] = useState<string>('Database Indexing (B-Trees vs Hash)');
  const [explainDomain, setExplainDomain] = useState<string>('CS Fundamentals');
  const [interviewTrack, setInterviewTrack] = useState<string>('AI/ML');
  const [interviewTopic, setInterviewTopic] = useState<string>('');

  // Load user data when authenticated or tab changes
  useEffect(() => {
    if (user?.uid) {
      syncUserDataWithFirestore(user.uid).then((p) => {
        setProfile(p);
        setSpeakingSessions(getSpeakingSessions());
        setExplainSessions(getExplainSessions());
        setInterviewSessions(getInterviewSessions());
      });
    } else {
      setProfile(getProfile());
      setSpeakingSessions(getSpeakingSessions());
      setExplainSessions(getExplainSessions());
      setInterviewSessions(getInterviewSessions());
    }
  }, [user, activeTab]);

  const handleNavigate = (tab: NavigationTab, params?: Record<string, any>) => {
    if (tab === 'explain' && params?.topic) {
      setExplainTopic(params.topic);
      if (params.domain) setExplainDomain(params.domain);
    }
    if (tab === 'interview') {
      if (params?.track) setInterviewTrack(params.track);
      if (params?.topic) setInterviewTopic(params.topic);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-stone-950 font-black text-xl animate-pulse mb-4 shadow-xl shadow-emerald-950">
          IG
        </div>
        <p className="text-xs text-stone-400 font-mono">Verifying credentials & loading workspace...</p>
      </div>
    );
  }

  // Gate the application with AuthScreen if not authenticated or not authorized (unless in guest practice mode)
  if ((!user && !isGuest) || (user && !isAuthorized)) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-['Plus_Jakarta_Sans'] selection:bg-emerald-500 selection:text-stone-950">
      {/* Top Fixed / Sticky Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => handleNavigate(tab)}
        streakDays={profile.streakDays}
        onOpenSettings={() => handleNavigate('profile' as any)}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6">
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
            onGoToInterview={(topic, track) => {
              handleNavigate('interview', { topic, track: track || 'AI/ML' });
            }}
          />
        )}

        {activeTab === 'explain' && (
          <ExplainTopicView
            initialTopic={explainTopic}
            initialDomain={explainDomain}
          />
        )}

        {activeTab === 'interview' && (
          <InterviewView
            initialTrack={interviewTrack}
            initialTopic={interviewTopic}
          />
        )}

        {activeTab === 'quick' && <RapidReviewView />}

        {activeTab === 'debate' && <DebateView />}

        {(activeTab === 'current' || (activeTab as string) === 'trends') && (
          <CurrentTopicsView onNavigate={handleNavigate} />
        )}

        {activeTab === 'progress' && (
          <ProgressAnalyticsView
            profile={profile}
            sessions={speakingSessions}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            speakingSessions={speakingSessions}
            explainSessions={explainSessions}
            interviewSessions={interviewSessions}
            onRetryTopic={handleNavigate}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileSettingsView
            profile={profile}
            onUpdateProfile={(p) => setProfile(p)}
          />
        )}
      </main>

      {/* Offline Status Indicator */}
      <OfflineIndicator />

      {/* Footer */}
      <footer className="border-t border-stone-900 py-6 text-center text-xs text-stone-500">
        <p>InterviewGym AI — Learn. Speak. Explain. Interview. Improve.</p>
        <p className="mt-1 text-[11px] text-stone-600">
          Private Studio • Cloud Firestore Persistence • Gemini 2.5 Server Architecture
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
