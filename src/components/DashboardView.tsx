import React, { useState } from 'react';
import {
  Mic,
  Brain,
  MessageSquareQuote,
  Briefcase,
  Zap,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Award,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  ListTodo,
} from 'lucide-react';
import { UserPerformanceProfile, DailyPlan, NavigationTab } from '../types';
import { saveDailyPlan } from '../lib/storage';

interface DashboardViewProps {
  profile: UserPerformanceProfile;
  dailyPlan: DailyPlan | null;
  onUpdateDailyPlan: (plan: DailyPlan) => void;
  onNavigate: (tab: NavigationTab, params?: Record<string, any>) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  dailyPlan,
  onUpdateDailyPlan,
  onNavigate,
}) => {
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [activeRecallTopic] = useState(() => {
    if (profile.weakTopics && profile.weakTopics.length > 0) {
      return profile.weakTopics[0];
    }
    if (profile.learnedTopics && profile.learnedTopics.length > 0) {
      return profile.learnedTopics[0].topic;
    }
    return 'Self-Attention & Transformers';
  });

  const generatePlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) throw new Error('Failed to generate daily plan');
      const data = await res.json();
      onUpdateDailyPlan(data);
      saveDailyPlan(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const skillMetrics = [
    { label: 'Speaking Fluency', value: profile.speakingFluency, color: 'text-emerald-400', bar: 'bg-emerald-500' },
    { label: 'English Grammar', value: profile.englishGrammar, color: 'text-teal-400', bar: 'bg-teal-500' },
    { label: 'Vocabulary', value: profile.vocabulary, color: 'text-cyan-400', bar: 'bg-cyan-500' },
    { label: 'Pronunciation / Clarity', value: profile.pronunciationClarity, color: 'text-blue-400', bar: 'bg-blue-500' },
    { label: 'Answer Structure', value: profile.answerStructure, color: 'text-indigo-400', bar: 'bg-indigo-500' },
    { label: 'Technical Knowledge', value: profile.technicalKnowledge, color: 'text-purple-400', bar: 'bg-purple-500' },
    { label: 'Technical Explanation', value: profile.technicalExplanation, color: 'text-fuchsia-400', bar: 'bg-fuchsia-500' },
    { label: 'Interview Performance', value: profile.interviewPerformance, color: 'text-emerald-400', bar: 'bg-emerald-500' },
    { label: 'Confidence Under Pressure', value: profile.confidenceUnderPressure, color: 'text-amber-400', bar: 'bg-amber-500' },
    { label: 'HR / Behavioral', value: profile.hrBehavioral, color: 'text-rose-400', bar: 'bg-rose-500' },
  ];

  const handlePracticeWeakness = () => {
    if (profile.weakestSkill.includes('Pressure') || profile.weakestSkill.includes('Interview')) {
      onNavigate('interview', { pressureMode: true });
    } else if (profile.weakestSkill.includes('Explanation')) {
      onNavigate('explain', { topic: activeRecallTopic });
    } else if (profile.weakestSkill.includes('Fluency') || profile.weakestSkill.includes('Grammar') || profile.weakestSkill.includes('Vocabulary')) {
      onNavigate('speaking');
    } else {
      onNavigate('learn');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome & Learning Loop Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Communication & Technical Mentor</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans']">
            Master the Art of Spoken Technical Communication.
          </h1>
          <p className="text-stone-300 text-sm sm:text-base mt-2 leading-relaxed">
            The proven mastery cycle: <span className="text-emerald-400 font-semibold">LEARN</span> → <span className="text-teal-400 font-semibold">SPEAK</span> → <span className="text-cyan-400 font-semibold">GET EVALUATED</span> → <span className="text-indigo-400 font-semibold">IDENTIFY WEAKNESSES</span> → <span className="text-purple-400 font-semibold">RETRY</span> → <span className="text-emerald-300 font-semibold">TRACK IMPROVEMENT</span>.
          </p>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-stone-800/80">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider">Streak</p>
              <p className="text-2xl font-bold text-amber-400 mt-0.5">{profile.streakDays} Days</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider">Sessions</p>
              <p className="text-2xl font-bold text-white mt-0.5">{profile.totalSessionsCompleted}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider">Speaking Time</p>
              <p className="text-2xl font-bold text-teal-400 mt-0.5">{profile.totalSpeakingMinutes} min</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider">Average Score</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">
                {Math.round(
                  skillMetrics.reduce((acc, s) => acc + s.value, 0) / skillMetrics.length
                )}
                /100
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Weakest Area Alert & Spaced Repetition Active Recall */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weakness Alert Card */}
        <div className="rounded-xl bg-stone-900 border border-amber-900/40 p-5 shadow-md flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Weakest Skill Identified</span>
              </div>
              <span className="text-xs bg-amber-950/80 text-amber-300 px-2 py-0.5 rounded border border-amber-800/50">
                {profile.weakestSkill}
              </span>
            </div>
            <p className="text-stone-300 text-sm leading-relaxed">
              {profile.recommendedPractice}
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-stone-800/80 flex items-center justify-between">
            <span className="text-xs text-stone-400">Current Mastery: {profile.confidenceUnderPressure}%</span>
            <button
              onClick={handlePracticeWeakness}
              id="dashboard-practice-weakness-btn"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-colors"
            >
              <span>Practice this now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Spaced Repetition Active Recall Card */}
        <div className="rounded-xl bg-stone-900 border border-emerald-900/40 p-5 shadow-md flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>Active Recall Spaced Test</span>
              </div>
              <span className="text-xs bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/50">
                Spaced Repetition
              </span>
            </div>
            <p className="text-stone-300 text-sm leading-relaxed">
              Without looking at your notes, verbally explain: <br />
              <strong className="text-white text-base font-semibold">"{activeRecallTopic}"</strong>
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-stone-800/80 flex items-center justify-between">
            <span className="text-xs text-stone-400">Takes only 90 seconds</span>
            <button
              onClick={() => onNavigate('explain', { topic: activeRecallTopic })}
              id="dashboard-active-recall-btn"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold transition-colors"
            >
              <span>Explain Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Today's Training Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Today's Training</h2>
            <p className="text-xs text-stone-400">Choose an exercise or follow your customized daily plan.</p>
          </div>
          <button
            onClick={generatePlan}
            disabled={isGeneratingPlan}
            id="dashboard-generate-plan-btn"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPlan ? 'animate-spin' : ''}`} />
            <span>{isGeneratingPlan ? 'Generating Plan...' : "Generate Today's Plan"}</span>
          </button>
        </div>

        {/* 5 Core Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Random Speaking */}
          <div
            onClick={() => onNavigate('speaking')}
            id="training-card-random-speaking"
            className="group cursor-pointer rounded-xl bg-stone-900/90 border border-stone-800 hover:border-emerald-500/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-950/30 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Mic className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-100 text-sm group-hover:text-emerald-400 transition-colors">
                Random Speaking
              </h3>
              <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                Spontaneous impromptu speaking, filler word detection, and WPM pace analysis.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400 group-hover:text-emerald-300">
              <span>1–3 mins</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. Technical Topic */}
          <div
            onClick={() => onNavigate('learn')}
            id="training-card-technical-topic"
            className="group cursor-pointer rounded-xl bg-stone-900/90 border border-stone-800 hover:border-teal-500/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-950/30 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-teal-950 border border-teal-800/60 text-teal-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Brain className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-100 text-sm group-hover:text-teal-400 transition-colors">
                Technical Topic
              </h3>
              <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                17-part deep learning guides with core concepts, terminology, and interactive quizzes.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400 group-hover:text-teal-300">
              <span>Study Mode</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. Explain What You Learned */}
          <div
            onClick={() => onNavigate('explain')}
            id="training-card-explain"
            className="group cursor-pointer rounded-xl bg-stone-900/90 border border-stone-800 hover:border-cyan-500/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-950/30 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-800/60 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <MessageSquareQuote className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-100 text-sm group-hover:text-cyan-400 transition-colors">
                Explain Concept
              </h3>
              <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                Hide notes and explain in your own words. Classify correct vs misleading points.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400 group-hover:text-cyan-300">
              <span>Verbal Test</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 4. Interview Simulation */}
          <div
            onClick={() => onNavigate('interview')}
            id="training-card-interview"
            className="group cursor-pointer rounded-xl bg-stone-900/90 border border-stone-800 hover:border-indigo-500/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/30 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-indigo-950 border border-indigo-800/60 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Briefcase className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-100 text-sm group-hover:text-indigo-400 transition-colors">
                Interview Simulator
              </h3>
              <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                Realistic mock interviews: DSA, System Design, AI/ML, Projects, HR, and Pressure Mode.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400 group-hover:text-indigo-300">
              <span>5–30 mins</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 5. Quick Review */}
          <div
            onClick={() => onNavigate('quick')}
            id="training-card-quick"
            className="group cursor-pointer rounded-xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-950/30 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-amber-950 border border-amber-800/60 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-100 text-sm group-hover:text-amber-400 transition-colors">
                5-Min Rapid Drill
              </h3>
              <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                Explain 1 concept to 3 audiences: 60s pitch, layperson analogy, and interview depth.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400 group-hover:text-amber-300">
              <span>5 mins</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Daily Plan Schedule Card (if exists) */}
        {dailyPlan && (
          <div className="rounded-xl bg-stone-900/80 border border-stone-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Today's AI Custom Plan — {dailyPlan.totalMinutes} Minutes
                </h3>
              </div>
              <span className="text-xs text-stone-400">Focus: {dailyPlan.focusArea}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {dailyPlan.items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-stone-950/60 border border-stone-800/80 p-3 flex flex-col justify-between hover:border-emerald-700/60 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        {item.durationMinutes} min
                      </span>
                      <span className="font-mono uppercase text-[10px] bg-stone-800 px-1 rounded text-stone-300">
                        {item.mode}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-stone-200 line-clamp-1">{item.title}</h4>
                    <p className="text-[11px] text-stone-400 mt-1 line-clamp-2">{item.description}</p>
                  </div>
                  <button
                    onClick={() => onNavigate(item.mode, item.params)}
                    id={`daily-plan-start-btn-${idx}`}
                    className="mt-3 w-full py-1 text-center rounded bg-stone-800 hover:bg-emerald-600 text-stone-200 hover:text-stone-950 text-xs font-semibold transition-colors"
                  >
                    Start Drill
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress & Skills Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Skill Proficiency Matrix</h2>
            <p className="text-xs text-stone-400">
              Evaluated across 10 core dimensions based on speaking sessions and interview simulations.
            </p>
          </div>
          <button
            onClick={() => onNavigate('progress')}
            id="dashboard-view-all-analytics-btn"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
          >
            <span>Full Analytics & Trends</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {skillMetrics.map((skill, i) => (
            <div
              key={i}
              className="rounded-xl bg-stone-900 border border-stone-800/90 p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-300">{skill.label}</span>
                <span className={`text-sm font-bold ${skill.color}`}>{skill.value}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-stone-800 mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${skill.bar} transition-all duration-500`}
                  style={{ width: `${skill.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Weaknesses Summary Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-stone-900 border border-stone-800 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-stone-400 uppercase tracking-wider">Top Strength</span>
            <p className="text-sm font-bold text-emerald-300">{profile.strongestSkill}</p>
            <p className="text-xs text-stone-400 mt-0.5">Consistently scored highest across past sessions.</p>
          </div>
        </div>

        <div className="rounded-xl bg-stone-900 border border-stone-800 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-800/60 text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-stone-400 uppercase tracking-wider">Primary Growth Focus</span>
            <p className="text-sm font-bold text-amber-300">{profile.weakestSkill}</p>
            <p className="text-xs text-stone-400 mt-0.5">Targeted in automated daily training recommendations.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
