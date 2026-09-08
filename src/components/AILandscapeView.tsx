import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  Search,
  ArrowRight,
  Briefcase,
  MessageSquareQuote,
  Layers,
  Bot,
  Code2,
  Cpu,
  Wand2,
  Database,
  CheckCircle2,
  HelpCircle,
  X,
  PlusCircle,
  ExternalLink,
  BookOpen,
  Filter,
  Flame,
  Globe,
  Radio,
  Share2,
} from 'lucide-react';
import { AILandscapeItem, AILandscapeCategory, NavigationTab } from '../types';
import { AI_LANDSCAPE_CATEGORIES, INITIAL_AI_LANDSCAPE_ITEMS } from '../data/aiLandscapeData';

interface AILandscapeViewProps {
  onNavigate: (tab: NavigationTab, params?: Record<string, any>) => void;
}

const CATEGORY_ICONS: Record<AILandscapeCategory, React.ComponentType<{ className?: string }>> = {
  'Major AI Models': Bot,
  'AI Coding Tools': Code2,
  'AI Agent Tools & Ecosystem': Layers,
  'Generative AI Tools': Wand2,
  'AI Infrastructure': Database,
  "What's New": Flame,
};

export const AILandscapeView: React.FC<AILandscapeViewProps> = ({ onNavigate }) => {
  const [items, setItems] = useState<AILandscapeItem[]>(INITIAL_AI_LANDSCAPE_ITEMS);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<AILandscapeItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('Official Catalog Active');

  // Custom tool lookup / analyze modal
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState<boolean>(false);
  const [customToolName, setCustomToolName] = useState<string>('');
  const [customToolCategory, setCustomToolCategory] = useState<AILandscapeCategory>('Major AI Models');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeError, setAnalyzeError] = useState<string>('');

  // Fetch / refresh dynamic landscape using Google Search Grounding from official sources
  const fetchLandscape = async (force: boolean = false, query: string = '') => {
    if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await fetch('/api/ai-landscape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: activeCategory !== 'All' ? activeCategory : undefined,
          query: query || undefined,
          force,
        }),
      });

      if (!res.ok) throw new Error('Failed to load AI landscape');
      const data = await res.json();
      const loadedItems: AILandscapeItem[] = data.items || [];
      if (loadedItems.length > 0) {
        setItems(loadedItems);
        setLastRefreshedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (selectedItem) {
          const matched = loadedItems.find((i) => i.id === selectedItem.id || i.name === selectedItem.name);
          if (matched) setSelectedItem(matched);
        }
      }
    } catch (err) {
      console.warn('Using seeded official AI landscape catalog:', err);
      if (items.length === 0) {
        setItems(INITIAL_AI_LANDSCAPE_ITEMS);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Analyze a custom or newly released tool with real-time web search
  const handleAnalyzeCustomTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToolName.trim()) return;

    setIsAnalyzing(true);
    setAnalyzeError('');

    try {
      const res = await fetch('/api/ai-landscape/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: customToolName.trim(),
          category: customToolCategory,
        }),
      });

      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      if (data.item) {
        setItems((prev) => [data.item, ...prev]);
        setSelectedItem(data.item);
        setIsAnalyzeModalOpen(false);
        setCustomToolName('');
      } else {
        throw new Error('No analysis generated');
      }
    } catch (err: any) {
      setAnalyzeError(err.message || 'Could not analyze tool. Please check spelling.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Extract subcategories available in current view
  const availableSubcategories = useMemo(() => {
    const list = items
      .filter((i) => activeCategory === 'All' || i.category === activeCategory)
      .map((i) => i.subcategory)
      .filter(Boolean);
    return ['All', ...Array.from(new Set(list))];
  }, [items, activeCategory]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSubcategory = selectedSubcategory === 'All' || item.subcategory === selectedSubcategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.creator.toLowerCase().includes(q) ||
        item.subcategory.toLowerCase().includes(q) ||
        item.whatItIs.toLowerCase().includes(q) ||
        item.whyEngineerShouldKnow.toLowerCase().includes(q) ||
        item.conceptualDifference.toLowerCase().includes(q) ||
        item.capabilities.some((c) => c.toLowerCase().includes(q));

      return matchesCategory && matchesSubcategory && matchesQuery;
    });
  }, [items, activeCategory, selectedSubcategory, searchQuery]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans pb-24">
      {/* Header Banner */}
      <div className="border-b border-stone-800/80 bg-gradient-to-b from-stone-900/90 via-stone-900/40 to-stone-950 px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Interview Awareness & Industry Landscape
                </span>
                <span className="text-xs text-stone-400 hidden sm:inline">•</span>
                <span className="text-xs text-stone-400 hidden sm:inline flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  {lastRefreshedTime}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans']">
                AI Tools & Model Landscape
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-stone-300 max-w-3xl leading-relaxed">
                Practical, interview-focused intelligence covering major foundation models, AI coding agents, orchestration
                frameworks, generative tools, and infrastructure—with conceptual distinctions and senior interview questions.
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => fetchLandscape(true, searchQuery)}
                disabled={isRefreshing}
                id="btn-refresh-official-sources"
                className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700/80 text-xs font-semibold text-stone-200 transition-all flex items-center gap-2 shadow-sm hover:border-stone-600 disabled:opacity-50"
                title="Refresh with fresh data from official documentation and announcements"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing Sources...' : 'Refresh from Official Sources'}</span>
              </button>

              <button
                onClick={() => setIsAnalyzeModalOpen(true)}
                id="btn-analyze-custom-tool"
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950 hover:scale-[1.02]"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Analyze Any Tool</span>
              </button>
            </div>
          </div>

          {/* Search & Stats Bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models, tools, or infra (e.g., Claude 3.7, Cursor, DeepSeek, vLLM, MCP, FLUX, pgvector)..."
                id="input-landscape-search"
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-stone-900/90 border border-stone-800 text-stone-100 placeholder-stone-500 text-xs sm:text-sm focus:outline-none focus:border-teal-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-xs text-stone-400 shrink-0 self-end sm:self-center px-2 py-1 bg-stone-900/70 border border-stone-800/80 rounded-lg">
              Showing <strong className="text-emerald-400">{filteredItems.length}</strong> of{' '}
              <strong className="text-stone-300">{items.length}</strong> entries
            </div>
          </div>

          {/* 6 Category Tabs */}
          <div className="mt-5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => {
                setActiveCategory('All');
                setSelectedSubcategory('All');
              }}
              id="tab-category-all"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeCategory === 'All'
                  ? 'bg-emerald-500 text-stone-950 shadow-md font-bold'
                  : 'bg-stone-900/70 hover:bg-stone-800 text-stone-300 border border-stone-800/80'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All Landscape</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-950/40 text-inherit font-mono">
                {items.length}
              </span>
            </button>

            {AI_LANDSCAPE_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id];
              const count = items.filter((i) => i.category === cat.id).length;
              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedSubcategory('All');
                  }}
                  id={`tab-category-${cat.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-500 text-stone-950 shadow-md font-bold'
                      : 'bg-stone-900/70 hover:bg-stone-800 text-stone-300 border border-stone-800/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-950/40 text-inherit font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Subcategory Pills */}
          {availableSubcategories.length > 2 && (
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <span className="text-[11px] text-stone-500 font-medium shrink-0 flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" /> Focus:
              </span>
              {availableSubcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory(sub)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                    selectedSubcategory === sub
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 font-semibold'
                      : 'bg-stone-900/50 text-stone-400 hover:text-stone-200 border border-stone-800/50'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-stone-400">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-400 mb-3" />
            <p className="text-sm">Retrieving verified intelligence from official sources...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-stone-900/30 rounded-2xl border border-stone-800/60 p-8 max-w-lg mx-auto">
            <Bot className="w-10 h-10 text-stone-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-stone-200">No matching models or tools found</h3>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Try adjusting your search terms or analyze this tool directly using the &quot;Analyze Any Tool&quot; button.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
                setSelectedSubcategory('All');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-200"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const CategoryIcon = CATEGORY_ICONS[item.category] || Sparkles;

              return (
                <div
                  key={item.id}
                  id={`card-item-${item.id}`}
                  className="rounded-2xl bg-stone-900/80 border border-stone-800 hover:border-stone-700/80 transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:shadow-xl hover:shadow-black/40"
                >
                  {/* Card Top */}
                  <div className="p-5">
                    {/* Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700">
                          {item.creator}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                          <CategoryIcon className="w-2.5 h-2.5" />
                          {item.subcategory}
                        </span>
                      </div>
                      {item.isNew && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                          <Flame className="w-2.5 h-2.5 text-amber-400" />
                          New
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors tracking-tight leading-snug">
                      {item.name}
                    </h3>

                    {/* What It Is */}
                    <p className="mt-2 text-xs text-stone-300 leading-relaxed line-clamp-3">
                      {item.whatItIs}
                    </p>

                    {/* Mainly Used For */}
                    <div className="mt-3 pt-3 border-t border-stone-800/60">
                      <div className="text-[11px] font-semibold text-stone-400 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                        Mainly Used For:
                      </div>
                      <p className="text-xs text-stone-300 line-clamp-2">{item.mainlyUsedFor}</p>
                    </div>

                    {/* Key Capabilities Preview */}
                    <div className="mt-3 space-y-1.5">
                      {item.capabilities.slice(0, 2).map((cap, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-stone-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{cap}</span>
                        </div>
                      ))}
                    </div>

                    {/* Conceptual Difference Callout */}
                    <div className="mt-3.5 p-2.5 rounded-xl bg-stone-950/70 border border-stone-800/80 text-[11px] text-stone-300">
                      <div className="font-semibold text-amber-300/90 text-[10px] uppercase tracking-wider mb-0.5">
                        Conceptual Distinction vs Alternatives:
                      </div>
                      <p className="line-clamp-2 text-stone-400 leading-relaxed">
                        {item.conceptualDifference}
                      </p>
                    </div>

                    {/* Interview Questions Preview */}
                    {item.interviewQuestions && item.interviewQuestions.length > 0 && (
                      <div className="mt-3 p-2.5 rounded-xl bg-purple-950/20 border border-purple-900/30 text-[11px]">
                        <div className="font-semibold text-purple-300 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-purple-400" />
                          Interview Question:
                        </div>
                        <p className="text-stone-300 italic line-clamp-2">
                          &ldquo;{item.interviewQuestions[0]}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="p-4 bg-stone-950/50 border-t border-stone-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedItem(item)}
                      id={`btn-learn-more-${item.id}`}
                      className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                      <span>Learn More</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          onNavigate('explain', {
                            topic: item.name,
                            domain: 'AI/ML',
                          })
                        }
                        title="Practice explaining this verbally in under 90 seconds"
                        className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white transition-colors"
                      >
                        <MessageSquareQuote className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() =>
                          onNavigate('interview', {
                            topic: item.name,
                            track: 'LLM/GenAI',
                          })
                        }
                        id={`btn-interview-me-${item.id}`}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all hover:scale-[1.02] flex items-center gap-1.5 shadow-md shadow-purple-950"
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Interview Me</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* "LEARN MORE" DEEP-DIVE MODAL */}
      {/* ========================================================================= */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-stone-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/80">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-stone-800 bg-stone-950/60 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-stone-800 text-stone-300 border border-stone-700">
                    Made by {selectedItem.creator}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                    {selectedItem.category} • {selectedItem.subcategory}
                  </span>
                  {selectedItem.isNew && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-800/60">
                      Latest Release
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {selectedItem.name}
                </h2>
                {selectedItem.officialSource && (
                  <p className="mt-1 text-[11px] text-stone-400 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 text-stone-500" />
                    Source: {selectedItem.officialSource}
                  </p>
                )}
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-stone-200 text-xs sm:text-sm leading-relaxed">
              {/* What it is */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1.5">
                  1. What It Is
                </h4>
                <p className="text-stone-300 bg-stone-950/50 p-3.5 rounded-xl border border-stone-800/70">
                  {selectedItem.whatItIs}
                </p>
              </div>

              {/* Mainly used for */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1.5">
                  2. What It Is Mainly Used For
                </h4>
                <p className="text-stone-300 bg-stone-950/50 p-3.5 rounded-xl border border-stone-800/70">
                  {selectedItem.mainlyUsedFor}
                </p>
              </div>

              {/* Capabilities */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2">
                  3. Important Capabilities
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedItem.capabilities.map((cap, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-stone-950/40 border border-stone-800/60 flex items-start gap-2 text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why an engineer should know it */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
                  4. Why an AI / Software Engineer Should Know It
                </h4>
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-stone-200">
                  {selectedItem.whyEngineerShouldKnow}
                </div>
              </div>

              {/* Conceptual Difference vs Alternatives */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  5. How It Differs Conceptually from Alternatives
                </h4>
                <div className="p-4 rounded-xl bg-amber-950/15 border border-amber-900/30 text-stone-300">
                  {selectedItem.conceptualDifference}
                </div>
              </div>

              {/* Interview Questions & Talking Points */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" />
                  6. High-Frequency Interview Questions & Defense Points
                </h4>
                <div className="space-y-3">
                  {selectedItem.interviewQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40"
                    >
                      <p className="font-semibold text-purple-200 text-xs sm:text-sm">
                        Q{idx + 1}: &ldquo;{q}&rdquo;
                      </p>
                      {selectedItem.sampleAnswers && selectedItem.sampleAnswers[idx] && (
                        <div className="mt-2.5 pt-2.5 border-t border-purple-900/30 text-xs text-stone-300">
                          <strong className="text-emerald-400 font-semibold">Key talking point: </strong>
                          {selectedItem.sampleAnswers[idx]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer CTA */}
            <div className="p-4 sm:p-5 border-t border-stone-800 bg-stone-950 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-stone-400">
                Ready to test your active knowledge?
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    const name = selectedItem.name;
                    setSelectedItem(null);
                    onNavigate('explain', {
                      topic: name,
                      domain: 'AI/ML',
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <MessageSquareQuote className="w-3.5 h-3.5 text-stone-400" />
                  <span>Explain It Yourself</span>
                </button>

                <button
                  onClick={() => {
                    const name = selectedItem.name;
                    setSelectedItem(null);
                    onNavigate('interview', {
                      topic: name,
                      track: 'LLM/GenAI',
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-950 flex items-center gap-1.5 hover:scale-[1.02]"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Interview Me on This Topic</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* "ANALYZE ANY TOOL" MODAL */}
      {/* ========================================================================= */}
      {isAnalyzeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl shadow-black/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Analyze Any AI Model or Tool</h3>
                  <p className="text-xs text-stone-400">Queries official docs via Google Search grounding</p>
                </div>
              </div>
              <button
                onClick={() => setIsAnalyzeModalOpen(false)}
                className="p-1 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAnalyzeCustomTool} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Tool or Model Name *
                </label>
                <input
                  type="text"
                  required
                  value={customToolName}
                  onChange={(e) => setCustomToolName(e.target.value)}
                  placeholder="e.g., Together AI, Whisper v3, FLUX Schnell, Qdrant, Grok 3..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs sm:text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Category
                </label>
                <select
                  value={customToolCategory}
                  onChange={(e) => setCustomToolCategory(e.target.value as AILandscapeCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs sm:text-sm focus:outline-none focus:border-teal-500"
                >
                  {AI_LANDSCAPE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {analyzeError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                  {analyzeError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAnalyzeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAnalyzing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isAnalyzing ? 'Searching & Analyzing...' : 'Analyze with Grounded Search'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
