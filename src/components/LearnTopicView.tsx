import React, { useState } from 'react';
import {
  Brain,
  Search,
  Sparkles,
  BookOpen,
  HelpCircle,
  Clock,
  Layers,
  Code2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { TechnicalLesson } from '../types';

const DOMAIN_TOPICS: Record<string, string[]> = {
  'AI/ML': [
    'How does an LLM work?',
    'Self-Attention & Transformers',
    'RAG vs Fine-tuning Tradeoffs',
    'Vector Databases & Embeddings',
    'Prompt Engineering & Agent Reasoning',
    'Deep Learning Optimization (Adam vs SGD)',
  ],
  DSA: [
    'Binary Search O(log n) & Invariants',
    'Two Pointers vs Sliding Window',
    'Dynamic Programming Memoization',
    'Graph Traversal (BFS vs DFS)',
    'Trie (Prefix Tree) Implementation',
    'Monotonic Stack Techniques',
  ],
  'CS Fundamentals': [
    'Database Indexing (B-Trees vs Hash)',
    'Operating System Processes vs Threads',
    'TCP 3-Way Handshake & Flow Control',
    'ACID Transactions & Isolation Levels',
    'Virtual Memory & Paging',
    'REST vs gRPC vs GraphQL',
  ],
  'Backend & Systems': [
    'System Design: Distributed Rate Limiter',
    'Database Connection Pooling & Deadlocks',
    'Cache Invalidation Strategies',
    'JWT Authentication vs Session Cookies',
    'Message Queues: Kafka vs RabbitMQ',
  ],
  Programming: [
    'Java Memory Model & Garbage Collection',
    'Python GIL (Global Interpreter Lock)',
    'JavaScript Event Loop & Microtasks',
    'C++ Smart Pointers & RAII',
  ],
};

interface LearnTopicViewProps {
  initialTopic?: string;
  onGoToExplain: (topic: string, domain: string) => void;
}

export const LearnTopicView: React.FC<LearnTopicViewProps> = ({
  initialTopic = '',
  onGoToExplain,
}) => {
  const [topicInput, setTopicInput] = useState<string>(initialTopic || 'How does an LLM work?');
  const [selectedDomain, setSelectedDomain] = useState<string>('AI/ML');
  const [selectedDepth, setSelectedDepth] = useState<'Beginner' | 'Intermediate' | 'Interview' | 'Deep Technical'>('Interview');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lesson, setLesson] = useState<TechnicalLesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quiz interactive state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState<boolean>(false);

  const fetchLesson = async (overrideTopic?: string) => {
    const topicToLearn = overrideTopic || topicInput.trim();
    if (!topicToLearn) return;

    setIsLoading(true);
    setError(null);
    setSelectedAnswers({});
    setShowQuizResults(false);

    try {
      const res = await fetch('/api/learn-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicToLearn,
          domain: selectedDomain,
          depth: selectedDepth,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate technical lesson');
      const data: TechnicalLesson = await res.json();
      setLesson(data);
    } catch (err: any) {
      setError(err.message || 'Error generating lesson');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPredefined = (topic: string) => {
    setTopicInput(topic);
    fetchLesson(topic);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs uppercase tracking-wider">
          <Brain className="w-4 h-4" />
          <span>Structured Technical Mastery</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          Learn a Technical Topic
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Structured 17-part engineering lessons spanning layman analogies, architecture, production tradeoffs, and interview scripts.
        </p>
      </div>

      {/* Input & Search Bar Card */}
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLesson()}
              placeholder="e.g. How does an LLM work? or Database Indexing"
              id="input-learn-topic"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            onClick={() => fetchLesson()}
            disabled={isLoading || !topicInput.trim()}
            id="btn-learn-generate"
            className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Lesson...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Learn Topic</span>
              </>
            )}
          </button>
        </div>

        {/* Depth Level Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">Depth:</span>
            {(['Beginner', 'Intermediate', 'Interview', 'Deep Technical'] as const).map((depth) => (
              <button
                key={depth}
                onClick={() => setSelectedDepth(depth)}
                id={`btn-depth-${depth}`}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedDepth === depth
                    ? 'bg-teal-500 text-stone-950 shadow-sm'
                    : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {depth}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-stone-400 italic">
            Supports official docs grounding & structured 17-part syllabus
          </span>
        </div>

        {/* Domain Preset Tabs & Quick Topics */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {Object.keys(DOMAIN_TOPICS).map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                  selectedDomain === dom
                    ? 'bg-stone-800 text-teal-300 font-bold border border-teal-800/60'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_TOPICS[selectedDomain]?.map((tp) => (
              <button
                key={tp}
                onClick={() => handleSelectPredefined(tp)}
                className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 hover:border-teal-500 text-stone-300 text-xs transition-colors"
              >
                {tp}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-rose-950/60 border border-rose-800 p-4 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Structured 17-part lesson content */}
      {lesson && (
        <div className="space-y-6">
          {/* Top Hero Banner & Primary CTA to Explain Mode */}
          <div className="rounded-2xl bg-gradient-to-r from-teal-950/80 via-stone-900 to-stone-900 border border-teal-800/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                  {lesson.domain} • {lesson.depth} Level
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mt-1">{lesson.topic}</h2>
              <p className="text-sm text-stone-300 mt-1 italic">
                "{lesson.oneLineExplanation}"
              </p>
            </div>
            <button
              onClick={() => onGoToExplain(lesson.topic, lesson.domain)}
              id="btn-learn-to-explain"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center gap-2 shrink-0 transition-transform hover:scale-105 shadow-md shadow-emerald-950"
            >
              <span>Test Yourself: Explain In Your Words</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 1 & 2: Layman vs Technical Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Layman Analogy
              </span>
              <p className="text-stone-300 text-sm leading-relaxed">
                {lesson.laymanExplanation}
              </p>
            </div>
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                Technical Explanation
              </span>
              <p className="text-stone-300 text-sm leading-relaxed">
                {lesson.technicalExplanation}
              </p>
            </div>
          </div>

          {/* 4 & 5: Core Concepts & Architecture Flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Core Concepts</span>
              </span>
              <ul className="space-y-1.5 text-xs text-stone-300">
                {lesson.coreConcepts.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-teal-400 font-bold">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                <span>Architecture & Data Flow</span>
              </span>
              <p className="text-xs text-stone-300 leading-relaxed font-mono bg-stone-950 p-3 rounded-lg border border-stone-800">
                {lesson.architectureOrFlow}
              </p>
            </div>
          </div>

          {/* 6 & 7: Important Terminology & Practical Code/Example */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Crucial Terminology
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lesson.importantTerminology.map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-stone-950 border border-stone-800/80">
                  <strong className="text-xs text-teal-400 font-mono">{item.term}</strong>
                  <p className="text-xs text-stone-400 mt-1">{item.definition}</p>
                </div>
              ))}
            </div>

            {lesson.practicalExample && (
              <div className="pt-3 border-t border-stone-800">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Practical Code / Production Scenario
                </span>
                <pre className="mt-2 p-4 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                  {lesson.practicalExample}
                </pre>
              </div>
            )}
          </div>

          {/* 8 & 9: Real-World Use Cases & Common Misconceptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Real-World Production Use Cases
              </span>
              <ul className="space-y-1.5 text-xs text-stone-300">
                {lesson.realWorldUseCases.map((u, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Common Misconceptions (Debunked)
              </span>
              <ul className="space-y-1.5 text-xs text-stone-300">
                {lesson.commonMisconceptions.map((m, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 10, 11, 12: Interview Questions, Follow-ups, and Mistakes */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-purple-400" />
              <span>Interview Defense & Common Traps</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-purple-400">
                  Direct Interview Questions
                </span>
                <ul className="space-y-1 text-xs text-stone-300">
                  {lesson.interviewQuestions.map((q, i) => (
                    <li key={i}>• {q}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-indigo-400">
                  Aggressive Follow-Ups
                </span>
                <ul className="space-y-1 text-xs text-stone-300">
                  {lesson.followUpQuestions.map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-amber-400">
                  Mistakes Candidates Make
                </span>
                <ul className="space-y-1 text-xs text-stone-300">
                  {lesson.commonMistakesCandidatesMake.map((m, i) => (
                    <li key={i}>• {m}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 13, 14, 15: 30s, 60s, and 2-min Spoken Explanations */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Calibrated Spoken Responses for Interviews</span>
            </h3>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-[11px] font-bold uppercase text-emerald-400">
                  30-Second Elevator Pitch
                </span>
                <p className="text-xs text-stone-200 leading-relaxed font-sans">
                  "{lesson.thirtySecondExplanation}"
                </p>
              </div>
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-[11px] font-bold uppercase text-teal-400">
                  60-Second Structured Explanation (Context → Mechanism → Tradeoffs)
                </span>
                <p className="text-xs text-stone-200 leading-relaxed font-sans">
                  "{lesson.sixtySecondExplanation}"
                </p>
              </div>
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-[11px] font-bold uppercase text-cyan-400">
                  2-Minute Senior Engineer Master Response
                </span>
                <p className="text-xs text-stone-200 leading-relaxed font-sans">
                  "{lesson.twoMinuteExplanation}"
                </p>
              </div>
            </div>
          </div>

          {/* 16: Quick Revision Points */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-3">
            <h3 className="text-sm font-bold text-white">Quick Revision Takeaways</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lesson.quickRevision.map((r, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 17: Interactive Quiz */}
          {lesson.quiz && lesson.quiz.length > 0 && (
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Interactive Knowledge Check</span>
                </h3>
                <button
                  onClick={() => setShowQuizResults(!showQuizResults)}
                  className="text-xs text-teal-400 hover:underline"
                >
                  {showQuizResults ? 'Hide Explanations' : 'Check Answers'}
                </button>
              </div>

              <div className="space-y-4">
                {lesson.quiz.map((q, qIdx) => (
                  <div key={qIdx} className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                    <p className="text-xs font-semibold text-stone-200">
                      {qIdx + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const isChosen = selectedAnswers[qIdx] === optIdx;
                        const isCorrect = q.correctIndex === optIdx;
                        let btnStyle = 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700';

                        if (showQuizResults) {
                          if (isCorrect) {
                            btnStyle = 'bg-emerald-950/80 border-emerald-600 text-emerald-300 font-bold';
                          } else if (isChosen && !isCorrect) {
                            btnStyle = 'bg-rose-950/80 border-rose-600 text-rose-300';
                          }
                        } else if (isChosen) {
                          btnStyle = 'bg-teal-950 border-teal-500 text-teal-200 font-bold';
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => {
                              setSelectedAnswers({ ...selectedAnswers, [qIdx]: optIdx });
                            }}
                            className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${btnStyle}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {showQuizResults && (
                      <p className="text-[11px] text-stone-400 pt-2 border-t border-stone-800/80 italic">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trusted Sources */}
          {lesson.trustedSources && lesson.trustedSources.length > 0 && (
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 flex items-center justify-between flex-wrap gap-3">
              <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">
                Trusted Reference Material:
              </span>
              <div className="flex flex-wrap gap-2">
                {lesson.trustedSources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-950 border border-stone-800 hover:border-teal-500 text-xs text-teal-400 transition-colors"
                  >
                    <span>{src.title}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
