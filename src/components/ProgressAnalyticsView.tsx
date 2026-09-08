import React from 'react';
import {
  TrendingUp,
  Award,
  AlertCircle,
  Clock,
  Mic,
  Calendar,
  Sparkles,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
} from 'recharts';
import { UserPerformanceProfile, SpeakingSessionRecord, NavigationTab } from '../types';

interface ProgressAnalyticsViewProps {
  profile: UserPerformanceProfile;
  sessions: SpeakingSessionRecord[];
  onNavigate: (tab: NavigationTab, params?: Record<string, any>) => void;
}

export const ProgressAnalyticsView: React.FC<ProgressAnalyticsViewProps> = ({
  profile,
  sessions,
  onNavigate,
}) => {
  const hasData = profile.totalSessionsCompleted > 0 || sessions.length > 0;

  // Real 10-axis radar data based on real profile metrics
  const radarData = [
    { skill: 'Fluency', score: profile.speakingFluency || 0 },
    { skill: 'Grammar', score: profile.englishGrammar || 0 },
    { skill: 'Vocab', score: profile.vocabulary || 0 },
    { skill: 'Clarity', score: profile.pronunciationClarity || 0 },
    { skill: 'Structure', score: profile.answerStructure || 0 },
    { skill: 'Tech Depth', score: profile.technicalKnowledge || 0 },
    { skill: 'Explanation', score: profile.technicalExplanation || 0 },
    { skill: 'Interview', score: profile.interviewPerformance || 0 },
    { skill: 'Pressure', score: profile.confidenceUnderPressure || 0 },
    { skill: 'HR/STAR', score: profile.hrBehavioral || 0 },
  ];

  // Dynamic progression trend line from real sessions
  const trendData = sessions
    .slice(0, 10)
    .reverse()
    .map((s, idx) => ({
      session: `#${idx + 1}`,
      overall: s.evaluation?.overallScore || 0,
      fluency: s.evaluation?.fluency || 0,
      grammar: s.evaluation?.grammar || 0,
      pressure: s.evaluation?.pressureScore || s.evaluation?.confidence || 0,
    }));

  // Aggregate real filler words from real sessions
  const fillerMap: Record<string, number> = {};
  sessions.forEach((s) => {
    if (s.evaluation?.fillerBreakdown) {
      s.evaluation.fillerBreakdown.forEach((f) => {
        fillerMap[f.word.toLowerCase()] = (fillerMap[f.word.toLowerCase()] || 0) + f.count;
      });
    }
  });

  const realFillerData = Object.entries(fillerMap)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Dynamic weak areas calculation
  const weakAreas: { name: string; score: number; mode: NavigationTab; advice: string }[] = [];
  if (hasData) {
    if (profile.speakingFluency < 70) {
      weakAreas.push({
        name: 'Speaking Fluency & Pacing',
        score: profile.speakingFluency,
        mode: 'speaking',
        advice: 'Practice continuous 60s stream-of-consciousness speaking without pausing.',
      });
    }
    if (profile.confidenceUnderPressure < 70) {
      weakAreas.push({
        name: 'Confidence Under Pressure',
        score: profile.confidenceUnderPressure,
        mode: 'quick',
        advice: 'Take 5-Min Drills to build composure against timer clocks & sudden pivots.',
      });
    }
    if (profile.technicalExplanation < 70) {
      weakAreas.push({
        name: 'Technical Explanation',
        score: profile.technicalExplanation,
        mode: 'explain',
        advice: 'Learn concepts and practice explaining them out loud in plain English.',
      });
    }
    if (profile.englishGrammar < 70) {
      weakAreas.push({
        name: 'English Grammar & Tenses',
        score: profile.englishGrammar,
        mode: 'speaking',
        advice: 'Review past corrections and focus on past-tense consistency in STAR stories.',
      });
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-3 sm:px-0">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <TrendingUp className="w-4 h-4" />
          <span>Real Longitudinal Telemetry</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          Performance Analytics & Mastery Tracker
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Telemetry calculated directly from your real persistent session evaluations in Firestore.
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-1">
          <span className="text-[11px] sm:text-xs text-stone-400 uppercase tracking-wider">Streak</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-400">
            {profile.streakDays > 0 ? `${profile.streakDays} d` : '0 d'}
          </p>
          <span className="text-[10px] sm:text-[11px] text-stone-500">Consecutive days</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-1">
          <span className="text-[11px] sm:text-xs text-stone-400 uppercase tracking-wider">Total Sessions</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {profile.totalSessionsCompleted}
          </p>
          <span className="text-[10px] sm:text-[11px] text-stone-500">Completed drills</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-1">
          <span className="text-[11px] sm:text-xs text-stone-400 uppercase tracking-wider">Speaking Time</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-teal-400">
            {profile.totalSpeakingMinutes} min
          </p>
          <span className="text-[10px] sm:text-[11px] text-stone-500">Active verbal output</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-1">
          <span className="text-[11px] sm:text-xs text-stone-400 uppercase tracking-wider">Pressure Rating</span>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {hasData && profile.confidenceUnderPressure > 0 ? `${profile.confidenceUnderPressure}%` : '—'}
          </p>
          <span className="text-[10px] sm:text-[11px] text-stone-500">Stress composure</span>
        </div>
      </div>

      {/* Empty State Banner if brand-new user */}
      {!hasData && (
        <div className="p-6 rounded-2xl bg-stone-900 border border-stone-800 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center mx-auto text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              Start your first session to build your progress
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
              No practice sessions have been logged yet. Complete a speaking drill, technical explanation, or mock interview to begin generating real radar analytics and trend curves.
            </p>
          </div>
          <button
            onClick={() => onNavigate('speaking')}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold inline-flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Start Practice Drill</span>
          </button>
        </div>
      )}

      {/* Visual Analytics: Radar vs Trend Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Skill Balance */}
        <div className="p-5 sm:p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">10-Axis Competency Balance</h3>
            <span className="text-xs text-emerald-400 font-mono">
              {hasData ? 'Live Assessment' : 'Awaiting Data'}
            </span>
          </div>
          <div className="h-64 w-full">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#4b5563" />
                  <Radar name="Proficiency" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-500 italic">
                Not enough data yet. Complete sessions to build your skill web.
              </div>
            )}
          </div>
        </div>

        {/* Score Progression Trend Line */}
        <div className="p-5 sm:p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Session Progression Trajectory</h3>
            <span className="text-xs text-teal-400 font-mono">
              {trendData.length > 0 ? `${trendData.length} sessions` : 'Awaiting Data'}
            </span>
          </div>
          <div className="h-64 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis dataKey="session" stroke="#6b7280" fontSize={11} />
                  <YAxis domain={[40, 100]} stroke="#6b7280" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1c1917', borderColor: '#374151', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Line type="monotone" dataKey="overall" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Overall" />
                  <Line type="monotone" dataKey="pressure" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Pressure" />
                  <Line type="monotone" dataKey="fluency" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Fluency" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-500 italic">
                Not enough data yet. Trajectory will plot after your first 2 sessions.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filler Words & Weakness Diagnosis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Filler Words */}
        <div className="p-5 sm:p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Filler Word Suppression</h3>
            <span className="text-xs text-stone-400 font-mono">Actual Frequency</span>
          </div>

          {realFillerData.length > 0 ? (
            <div className="space-y-3">
              {realFillerData.map((f) => (
                <div key={f.word} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-stone-300">"{f.word}"</span>
                    <span className="text-amber-400 font-semibold">{f.count} occurrences</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, f.count * 10)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-stone-500 italic">
              {hasData ? 'Great job! Minimal filler words detected in your recent sessions.' : 'Not enough data yet. Filler analysis will compute during verbal sessions.'}
            </div>
          )}
        </div>

        {/* Actionable Personalized Weaknesses */}
        <div className="p-5 sm:p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Personalized Weakness Diagnosis</span>
              </h3>
              <span className="text-xs text-amber-400 font-mono">Adaptive AI</span>
            </div>

            {hasData && (profile.weakestSkill !== 'Not enough data yet' || weakAreas.length > 0) ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 space-y-1">
                  <div className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">
                    Primary Area to Fortify
                  </div>
                  <div className="text-sm font-bold text-white">{profile.weakestSkill}</div>
                  <p className="text-xs text-stone-300 leading-relaxed pt-1">
                    {profile.recommendedPractice}
                  </p>
                </div>

                {profile.weakTopics && profile.weakTopics.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
                      Concepts Requiring Revision
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.weakTopics.map((t, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-[11px] text-stone-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-stone-500 italic">
                Not enough data yet. As you answer interview prompts and drills, recurring grammar, fluency, and technical gaps will be flagged here.
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('quick')}
            className="w-full mt-4 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <span>Launch Quick 5-Min Target Drill</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
