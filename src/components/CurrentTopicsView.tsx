import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Sparkles,
  ExternalLink,
  MessageSquareQuote,
  Mic,
  RefreshCw,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { CurrentTopicItem, NavigationTab } from '../types';

interface CurrentTopicsViewProps {
  onNavigate: (tab: NavigationTab, params?: Record<string, any>) => void;
}

export const CurrentTopicsView: React.FC<CurrentTopicsViewProps> = ({ onNavigate }) => {
  const [topics, setTopics] = useState<CurrentTopicItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTopic, setSelectedTopic] = useState<CurrentTopicItem | null>(null);

  const fetchTrends = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/current-topics');
      if (!res.ok) throw new Error('Failed to load trends');
      const data = await res.json();
      setTopics(data.topics || []);
      if (data.topics && data.topics.length > 0) {
        setSelectedTopic(data.topics[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-fuchsia-400 font-semibold text-xs uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>2025–2026 Industry Landscape</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
            AI & Tech Trends Pulse
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Current discussions top interviewers test in modern engineering rounds: Reasoning models, DeepSeek architectures, Agentic workflows, and MCP.
          </p>
        </div>

        <button
          onClick={fetchTrends}
          disabled={isLoading}
          id="btn-refresh-trends"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 text-xs font-semibold border border-stone-800 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Trends</span>
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-12 text-center space-y-3 shadow-xl">
          <RefreshCw className="w-6 h-6 text-fuchsia-400 animate-spin mx-auto" />
          <p className="text-xs text-stone-300 font-semibold">
            Synthesizing latest frontier AI & systems developments...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend List Column */}
          <div className="lg:col-span-1 space-y-2">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2">
              Frontier Topics
            </span>
            {topics.map((t, idx) => {
              const isSel = selectedTopic?.title === t.title;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedTopic(t)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                    isSel
                      ? 'bg-stone-900 border-fuchsia-500 shadow-md shadow-fuchsia-950/40'
                      : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-stone-400 mb-1">
                    <span className="bg-stone-800 px-1.5 py-0.5 rounded font-mono text-stone-300">
                      {t.category}
                    </span>
                  </div>
                  <h4
                    className={`text-xs font-bold line-clamp-1 ${
                      isSel ? 'text-fuchsia-300' : 'text-stone-200'
                    }`}
                  >
                    {t.title}
                  </h4>
                  <p className="text-[11px] text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                    {t.summary}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Detailed Selected Trend Card */}
          {selectedTopic && (
            <div className="lg:col-span-2 rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-6 shadow-xl">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-fuchsia-950/80 border border-fuchsia-800/80 text-fuchsia-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3" />
                  <span>{selectedTopic.category}</span>
                </div>
                <h2 className="text-xl font-bold text-white">{selectedTopic.title}</h2>
                <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                  {selectedTopic.summary}
                </p>
              </div>

              {/* Why it Matters in Production */}
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Why It Matters in Production
                </span>
                <p className="text-xs text-stone-300 leading-relaxed font-sans">
                  {selectedTopic.whyItMatters}
                </p>
              </div>

              {/* Interview Questions Candidates Get Asked */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Real Interview Questions Asked on This Topic
                </span>
                <ul className="space-y-2 text-xs text-stone-200">
                  {selectedTopic.interviewQuestions.map((q, qIdx) => (
                    <li
                      key={qIdx}
                      className="p-3 rounded-lg bg-stone-950 border border-stone-800 flex items-start gap-2"
                    >
                      <span className="text-fuchsia-400 font-bold">•</span>
                      <span>"{q}"</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons to Practice This Now */}
              <div className="pt-4 border-t border-stone-800 flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    onNavigate('explain', {
                      topic: selectedTopic.title,
                      domain: selectedTopic.category,
                    })
                  }
                  id="btn-trend-explain-now"
                  className="px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-md shadow-fuchsia-950"
                >
                  <MessageSquareQuote className="w-4 h-4" />
                  <span>Verbal Drill: Explain This Trend</span>
                </button>

                <button
                  onClick={() =>
                    onNavigate('speaking')
                  }
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  <span>Impromptu Speaking Mode</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
