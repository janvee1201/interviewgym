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
  // Chart data for radar matrix
  const radarData = [
    { skill: 'Fluency', score: profile.speakingFluency },
    { skill: 'Grammar', score: profile.englishGrammar },
    { skill: 'Vocab', score: profile.vocabulary },
    { skill: 'Clarity', score: profile.pronunciationClarity },
    { skill: 'Structure', score: profile.answerStructure },
    { skill: 'Tech Depth', score: profile.technicalKnowledge },
    { skill: 'Explanation', score: profile.technicalExplanation },
    { skill: 'Interview', score: profile.interviewPerformance },
    { skill: 'Pressure', score: profile.confidenceUnderPressure },
    { skill: 'HR/STAR', score: profile.hrBehavioral },
  ];

  // Progression trend line data
  const trendData = sessions.length > 0
    ? sessions.slice(-8).map((s, idx) => ({
        session: `#${idx + 1}`,
        overall: s.evaluation.overallScore,
        fluency: s.evaluation.fluency,
        grammar: s.evaluation.grammar,
        pressure: s.evaluation.pressureScore,
      }))
    : [
        { session: '#1', overall: 60, fluency: 58, grammar: 62, pressure: 52 },
        { session: '#2', overall: 65, fluency: 62, grammar: 64, pressure: 58 },
        { session: '#3', overall: 72, fluency: 70, grammar: 71, pressure: 64 },
        { session: '#4', overall: 78, fluency: 75, grammar: 76, pressure: 70 },
      ];

  // Filler word distribution
  const fillerData = [
    { word: 'like', count: 14 },
    { word: 'um / uh', count: 18 },
    { word: 'basically', count: 9 },
    { word: 'you know', count: 8 },
    { word: 'actually', count: 5 },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <TrendingUp className="w-4 h-4" />
          <span>Continuous Longitudinal Analytics</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          Performance Analytics & Mastery Tracker
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Detailed telemetry across 10 communication dimensions, filler word suppression curves, and historical interview recordings.
        </p>
      </div>

      {/* High-level KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-1">
          <span className="text-xs text-stone-400 uppercase tracking-wider">Practice Streak</span>
          <p className="text-3xl font-extrabold text-amber-400">{profile.streakDays} Days</p>
          <span className="text-[11px] text-stone-500">Consecutive training</span>
        </div>

        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-1">
          <span className="text-xs text-stone-400 uppercase tracking-wider">Total Sessions</span>
          <p className="text-3xl font-extrabold text-white">{profile.totalSessionsCompleted}</p>
          <span className="text-[11px] text-stone-500">Drills & simulations</span>
        </div>

        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-1">
          <span className="text-xs text-stone-400 uppercase tracking-wider">Speaking Time</span>
          <p className="text-3xl font-extrabold text-teal-400">{profile.totalSpeakingMinutes} min</p>
          <span className="text-[11px] text-stone-500">Active verbal output</span>
        </div>

        <div className="p-5 rounded-2xl bg-stone-900 border border-stone-800 space-y-1">
          <span className="text-xs text-stone-400 uppercase tracking-wider">Under Pressure</span>
          <p className="text-3xl font-extrabold text-emerald-400">{profile.confidenceUnderPressure}%</p>
          <span className="text-[11px] text-stone-500">High-stress composure</span>
        </div>
      </div>

      {/* Visual Analytics: Radar vs Trend Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Skill Balance */}
        <div className="p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">10-Axis Competency Web</h3>
            <span className="text-xs text-emerald-400 font-mono">Current Balance</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#4b5563" />
                <Radar name="Proficiency" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Progression Trend Line */}
        <div className="p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Session Progression Curve</h3>
            <span className="text-xs text-teal-400 font-mono">Scores over time</span>
          </div>
          <div className="h-64 w-full">
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
          </div>
        </div>
      </div>

      {/* Section 27: Weekly Report Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-850 border border-stone-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Weekly Performance Diagnostic</h3>
          </div>
          <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded font-mono">
            Active Week
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
            <span className="text-[11px] text-stone-400 uppercase font-semibold">Most Improved Skill</span>
            <p className="text-sm font-bold text-emerald-300">Answer Structure (+14%)</p>
            <p className="text-xs text-stone-500">More disciplined intro → mechanism → tradeoffs framework.</p>
          </div>

          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
            <span className="text-[11px] text-stone-400 uppercase font-semibold">Area Needing Most Work</span>
            <p className="text-sm font-bold text-amber-400">{profile.weakestSkill}</p>
            <p className="text-xs text-stone-500">Stumbling when unexpected follow-up questions interrupt.</p>
          </div>

          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
            <span className="text-[11px] text-stone-400 uppercase font-semibold">Recommended Practice</span>
            <p className="text-sm font-bold text-teal-300">Pressure Mode Simulation</p>
            <p className="text-xs text-stone-500">Run three 60-second impromptu drills with time warnings.</p>
          </div>
        </div>
      </div>

      {/* Filler Word Breakdown */}
      <div className="p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Filler Word Suppression Tracker</h3>
            <p className="text-xs text-stone-400">Total detected filler instances across recent sessions</p>
          </div>
          <span className="text-xs text-amber-400 font-mono">Target: &lt; 3 per minute</span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fillerData}>
              <XAxis dataKey="word" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1c1917', borderColor: '#374151', borderRadius: '8px', fontSize: '11px' }}
              />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Session History Log */}
      <div className="p-6 rounded-2xl bg-stone-900 border border-stone-800 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white">Recent Session Transcripts & Logs</h3>
        {sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.slice(-5).reverse().map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-200">{s.topic}</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    Score: {s.evaluation.overallScore}%
                  </span>
                </div>
                <p className="text-xs text-stone-400 line-clamp-2 italic">
                  "{s.transcript}"
                </p>
                <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-stone-900">
                  <span>Duration: {s.actualDurationSeconds}s</span>
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400 italic">
            No speaking sessions completed yet. Complete a Random Speaking or Explain drill to start recording history.
          </p>
        )}
      </div>
    </div>
  );
};
