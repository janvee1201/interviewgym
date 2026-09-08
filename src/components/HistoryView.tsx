import React, { useState } from 'react';
import {
  History,
  Mic,
  Brain,
  MessageSquareQuote,
  Briefcase,
  Clock,
  Award,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Filter,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  SpeakingSessionRecord,
  ExplainSessionRecord,
  InterviewSession,
  NavigationTab,
} from '../types';

export type UnifiedSession = {
  id: string;
  createdAt: number;
  mode: 'speaking' | 'explain' | 'interview' | 'quick';
  topic: string;
  durationSeconds: number;
  overallScore: number;
  subScores: Record<string, number>;
  transcript: string;
  questionOrPrompt?: string;
  corrections?: { whatYouSaid: string; whatsWrong?: string; betterVersion: string; whyItsBetter?: string }[];
  strengths?: string[];
  weaknesses?: string[];
  technicalFeedback?: string;
  recommendedPractice?: string;
  rawRecord: SpeakingSessionRecord | ExplainSessionRecord | InterviewSession;
};

interface HistoryViewProps {
  speakingSessions: SpeakingSessionRecord[];
  explainSessions: ExplainSessionRecord[];
  interviewSessions: InterviewSession[];
  onRetryTopic: (tab: NavigationTab, params?: Record<string, any>) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  speakingSessions,
  explainSessions,
  interviewSessions,
  onRetryTopic,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'speaking' | 'explain' | 'interview'>('all');
  const [selectedSession, setSelectedSession] = useState<UnifiedSession | null>(null);

  // Unify all session types into a coherent chronological list
  const unifiedSessions: UnifiedSession[] = [
    ...speakingSessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      mode: (s.topicType === 'Quick Drill' ? 'quick' : 'speaking') as 'speaking' | 'quick',
      topic: s.topic,
      durationSeconds: s.actualDurationSeconds,
      overallScore: s.evaluation?.overallScore || 0,
      subScores: {
        Fluency: s.evaluation?.fluency || 0,
        Grammar: s.evaluation?.grammar || 0,
        Vocabulary: s.evaluation?.vocabulary || 0,
        Confidence: s.evaluation?.confidence || 0,
        Structure: s.evaluation?.structure || 0,
      },
      transcript: s.transcript,
      questionOrPrompt: s.topic,
      corrections: s.evaluation?.corrections || [],
      strengths: s.evaluation?.strengths || [],
      weaknesses: s.evaluation?.weaknesses || [],
      recommendedPractice: s.evaluation?.recommendedPractice,
      rawRecord: s,
    })),
    ...explainSessions.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      mode: 'explain' as const,
      topic: `${e.topic} (${e.domain})`,
      durationSeconds: 120,
      overallScore: e.evaluation?.overallScore || 0,
      subScores: {
        'Technical Correctness': e.evaluation?.technicalCorrectness || 0,
        'Conceptual Depth': e.evaluation?.conceptualDepth || 0,
        'Logical Structure': e.evaluation?.logicalStructure || 0,
        Communication: e.evaluation?.englishAndCommunication || 0,
      },
      transcript: e.transcript,
      questionOrPrompt: `Explain concept: ${e.topic}`,
      technicalFeedback: e.evaluation?.idealAnswer ? `Ideal Answer: ${e.evaluation.idealAnswer}` : undefined,
      strengths: e.evaluation?.whatExplainedCorrectly || [],
      weaknesses: e.evaluation?.whatMissed || [],
      recommendedPractice: e.evaluation?.recommendedFollowup,
      rawRecord: e,
    })),
    ...interviewSessions.map((i) => ({
      id: i.id,
      createdAt: i.createdAt,
      mode: 'interview' as const,
      topic: `${i.role} • ${i.type} (${i.difficulty})`,
      durationSeconds: i.durationMinutes * 60,
      overallScore: i.scorecard?.overallScore || 0,
      subScores: {
        Technical: i.scorecard?.technicalKnowledge || 0,
        Communication: i.scorecard?.communication || 0,
        Pressure: i.scorecard?.pressureHandling || 0,
        'HR / Behavioral': i.scorecard?.hrBehavioral || 0,
      },
      transcript: i.messages
        .filter((m) => m.sender === 'candidate')
        .map((m) => m.text)
        .join('\n\n'),
      questionOrPrompt: i.messages.find((m) => m.sender === 'interviewer')?.text || 'Mock Interview',
      strengths: i.scorecard?.strongestAreas || [],
      weaknesses: i.scorecard?.weakestAreas || [],
      technicalFeedback: i.scorecard?.conceptsToRevise?.join(', '),
      recommendedPractice: i.scorecard?.recommendedNextSession,
      rawRecord: i,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const filteredSessions = activeFilter === 'all'
    ? unifiedSessions
    : unifiedSessions.filter((s) => (activeFilter === 'speaking' ? (s.mode === 'speaking' || s.mode === 'quick') : s.mode === activeFilter));

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
    if (score >= 65) return 'text-amber-400 bg-amber-950/60 border-amber-800/60';
    return 'text-rose-400 bg-rose-950/60 border-rose-800/60';
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'speaking':
        return { label: 'Random Speaking', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50', icon: Mic };
      case 'explain':
        return { label: 'Learn → Explain', color: 'bg-teal-950/70 text-teal-300 border-teal-800/50', icon: MessageSquareQuote };
      case 'interview':
        return { label: 'Interview Simulator', color: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50', icon: Briefcase };
      case 'quick':
        return { label: '5-Min Drill', color: 'bg-amber-950/70 text-amber-300 border-amber-800/50', icon: Sparkles };
      default:
        return { label: mode, color: 'bg-stone-800 text-stone-300 border-stone-700', icon: History };
    }
  };

  const handleRetry = (session: UnifiedSession) => {
    if (session.mode === 'speaking' || session.mode === 'quick') {
      onRetryTopic('speaking', { topic: session.topic });
    } else if (session.mode === 'explain') {
      const exp = session.rawRecord as ExplainSessionRecord;
      onRetryTopic('explain', { topic: exp.topic, domain: exp.domain });
    } else if (session.mode === 'interview') {
      const iv = session.rawRecord as InterviewSession;
      onRetryTopic('interview', { role: iv.role, type: iv.type });
    }
  };

  // Detail Modal / View
  if (selectedSession) {
    const modeInfo = getModeBadge(selectedSession.mode);
    const ModeIcon = modeInfo.icon;

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20 px-3 sm:px-0">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-4">
          <button
            onClick={() => setSelectedSession(null)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Session History</span>
          </button>

          <button
            onClick={() => handleRetry(selectedSession)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold transition-transform hover:scale-105 shadow-md shadow-emerald-950"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry This Session</span>
          </button>
        </div>

        {/* Overview Banner */}
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${modeInfo.color}`}>
                  <ModeIcon className="w-3 h-3" />
                  <span>{modeInfo.label}</span>
                </span>
                <span className="text-xs text-stone-400">
                  {new Date(selectedSession.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-xs text-stone-500">•</span>
                <span className="text-xs text-stone-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(selectedSession.durationSeconds)}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
                {selectedSession.topic}
              </h1>
            </div>

            <div className={`px-4 py-2.5 rounded-xl border text-center shrink-0 ${getScoreColor(selectedSession.overallScore)}`}>
              <div className="text-[10px] uppercase font-bold tracking-wider">Overall Score</div>
              <div className="text-2xl font-extrabold">{selectedSession.overallScore}/100</div>
            </div>
          </div>

          {/* Sub-scores Grid */}
          {Object.keys(selectedSession.subScores).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-stone-800/80">
              {Object.entries(selectedSession.subScores).map(([name, val]) => (
                <div key={name} className="p-2.5 rounded-lg bg-stone-950 border border-stone-800/80 text-center">
                  <div className="text-[10px] text-stone-400 uppercase tracking-wider truncate">{name}</div>
                  <div className="text-base font-bold text-stone-100">{val}/100</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transcript / Spoken Output */}
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Full Spoken Transcript</span>
            </h2>
            <span className="text-[11px] text-stone-400">
              {selectedSession.transcript.split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-xs sm:text-sm text-stone-200 leading-relaxed font-sans whitespace-pre-wrap max-h-72 overflow-y-auto">
            {selectedSession.transcript || <span className="text-stone-500 italic">No spoken transcript recorded.</span>}
          </div>
        </div>

        {/* Corrections & Mistakes */}
        {selectedSession.corrections && selectedSession.corrections.length > 0 && (
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Communication & Grammar Improvements</span>
            </h2>
            <div className="space-y-3">
              {selectedSession.corrections.map((c, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold shrink-0">You Said:</span>
                    <span className="text-stone-300 italic">"{c.whatYouSaid}"</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold shrink-0">Better:</span>
                    <span className="text-emerald-300 font-semibold font-sans">"{c.betterVersion}"</span>
                  </div>
                  {c.whyItsBetter && (
                    <div className="text-[11px] text-stone-400 pt-1 border-t border-stone-900">
                      <strong>Why:</strong> {c.whyItsBetter}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strengths & Areas to Improve */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {selectedSession.strengths && selectedSession.strengths.length > 0 && (
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Strengths Demonstrated</span>
              </h3>
              <ul className="space-y-1.5 text-xs text-stone-300">
                {selectedSession.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedSession.weaknesses && selectedSession.weaknesses.length > 0 && (
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Identified Weaknesses</span>
              </h3>
              <ul className="space-y-1.5 text-xs text-stone-300">
                {selectedSession.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Technical Feedback or Recommended Next Step */}
        {(selectedSession.technicalFeedback || selectedSession.recommendedPractice) && (
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3 shadow-xl">
            <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider">
              Recommended Next Practice
            </h3>
            {selectedSession.technicalFeedback && (
              <p className="text-xs text-stone-300 leading-relaxed">
                {selectedSession.technicalFeedback}
              </p>
            )}
            {selectedSession.recommendedPractice && (
              <p className="text-xs text-emerald-300/90 font-medium">
                → {selectedSession.recommendedPractice}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Session List View
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-3 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
            <History className="w-4 h-4" />
            <span>Encrypted Session Vault</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
            Session History & Replay
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Revisit past spoken answers, inspect Gemini evaluations, review word-for-word mistakes, and retry questions.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
          {(['all', 'speaking', 'explain', 'interview'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveFilter(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                activeFilter === mode
                  ? 'bg-emerald-500 text-stone-950 shadow-sm'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {mode === 'all' ? 'All Sessions' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredSessions.length === 0 ? (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center mx-auto text-stone-400">
            <History className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Start your first session to build your progress</h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto leading-relaxed">
              No sessions found for this category. Once you complete a speaking drill, technical explanation, or interview simulation, your full transcript, audio feedback, and score analysis will appear here.
            </p>
          </div>
          <button
            onClick={() => onRetryTopic('speaking')}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs inline-flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Start Practice Drill</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const modeBadge = getModeBadge(session.mode);
            const ModeIcon = modeBadge.icon;

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="rounded-2xl bg-stone-900 border border-stone-800 hover:border-emerald-500/50 p-4 sm:p-5 transition-all cursor-pointer group shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${modeBadge.color}`}>
                      <ModeIcon className="w-3 h-3" />
                      <span>{modeBadge.label}</span>
                    </span>
                    <span className="text-[11px] text-stone-400">
                      {new Date(session.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-stone-600 text-xs hidden sm:inline">•</span>
                    <span className="text-[11px] text-stone-400 hidden sm:inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(session.durationSeconds)}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                    {session.topic}
                  </h3>

                  {session.transcript && (
                    <p className="text-xs text-stone-400 line-clamp-1 italic">
                      "{session.transcript}"
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-800/80">
                  <div className={`px-3 py-1 rounded-xl border text-center ${getScoreColor(session.overallScore)}`}>
                    <div className="text-[9px] uppercase font-bold tracking-wider">Score</div>
                    <div className="text-base font-extrabold">{session.overallScore}</div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-stone-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
