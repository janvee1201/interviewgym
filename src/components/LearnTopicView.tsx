import React, { useState, useEffect, useMemo } from 'react';
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
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Zap,
  Shuffle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Star,
  Check,
  Copy,
  Compass,
  Filter,
  Trophy,
  Target,
  GitCommit,
  Play,
  Mic,
  MessageSquare,
  Terminal,
  MapPin,
  Route,
  Network,
  ListChecks,
} from 'lucide-react';
import { TechnicalLesson } from '../types';
import {
  AI_CURRICULUM_SECTIONS,
  CurriculumTopic,
  CurriculumSection,
  findTopic,
  searchCurriculum,
  TopicStatus,
} from '../data/aiCurriculum';
import {
  getTopicStatus,
  markTopicInProgress,
  markTopicLearned,
  getSectionProgress,
  pickIntelligentSurpriseTopic,
} from '../lib/topicProgress';

interface LearnTopicViewProps {
  initialTopic?: string;
  onGoToExplain: (topic: string, domain: string) => void;
  onGoToInterview?: (topic: string, track?: string) => void;
}

// Canonical 17-domain progression sequence for software engineering & AI/ML interviews
const ORDERED_SECTION_IDS = [
  'ai-fundamentals',
  'machine-learning',
  'deep-learning',
  'nlp',
  'llms',
  'generative-ai',
  'rag',
  'fine-tuning',
  'agentic-ai',
  'mcp',
  'multimodal-ai',
  'ai-engineering',
  'dsa',
  'oop',
  'dbms',
  'os',
  'cn',
];

const getTrackForSection = (sectionId?: string): string => {
  if (sectionId === 'dsa') return 'DSA';
  if (sectionId === 'oop') return 'OOP';
  if (sectionId === 'dbms') return 'DBMS';
  if (sectionId === 'os') return 'OS';
  if (sectionId === 'cn') return 'CN';
  if (['llms', 'generative-ai', 'rag', 'fine-tuning', 'agentic-ai', 'mcp'].includes(sectionId || '')) {
    return 'LLM/GenAI';
  }
  return 'AI/ML';
};

export const LearnTopicView: React.FC<LearnTopicViewProps> = ({
  initialTopic = '',
  onGoToExplain,
  onGoToInterview,
}) => {
  // Navigation and active selection
  const [selectedSectionId, setSelectedSectionId] = useState<string>('llms');
  const [activeCurriculumTopic, setActiveCurriculumTopic] = useState<CurriculumTopic | null>(null);
  const [viewMode, setViewMode] = useState<'curriculum' | 'lesson'>('curriculum');
  const [showRoadmap, setShowRoadmap] = useState<boolean>(true);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<'All' | 'Beginner' | 'Intermediate' | 'Interview'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'not_started' | 'in_progress' | 'learned' | 'completed'>('All');

  // Technical lesson state
  const [selectedDepth, setSelectedDepth] = useState<'Beginner' | 'Intermediate' | 'Interview' | 'Deep Technical'>('Interview');
  const [lesson, setLesson] = useState<TechnicalLesson | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState<boolean>(false);

  // Status & copy feedback triggers
  const [progressKey, setProgressKey] = useState<number>(0);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Curriculum sections ordered by recommended progression path
  const orderedSections = useMemo(() => {
    return [...AI_CURRICULUM_SECTIONS].sort((a, b) => {
      const idxA = ORDERED_SECTION_IDS.indexOf(a.id);
      const idxB = ORDERED_SECTION_IDS.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, []);

  // Active section data
  const currentSection = useMemo(() => {
    return (
      AI_CURRICULUM_SECTIONS.find((s) => s.id === selectedSectionId) ||
      AI_CURRICULUM_SECTIONS[0]
    );
  }, [selectedSectionId]);

  // Overall curriculum stats
  const overallStats = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const sec of AI_CURRICULUM_SECTIONS) {
      for (const top of sec.topics) {
        total++;
        const st = getTopicStatus(top.title);
        if (st === 'learned' || st === 'explained' || st === 'interviewed') {
          completed++;
        }
      }
    }
    return {
      total,
      completed,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [progressKey]);

  // Search results with section references
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const results = searchCurriculum(searchQuery);
    return results.filter(({ topic }) => {
      if (levelFilter !== 'All' && topic.level !== levelFilter) return false;
      if (statusFilter !== 'All') {
        const st = getTopicStatus(topic.title);
        if (statusFilter === 'completed') {
          return st === 'learned' || st === 'explained' || st === 'interviewed';
        }
        return st === statusFilter;
      }
      return true;
    });
  }, [searchQuery, levelFilter, statusFilter, progressKey]);

  // Grouped topics by subgroups for hierarchical navigation
  const groupedSubgroupTopics = useMemo(() => {
    if (searchQuery.trim()) return [];

    const filtered = currentSection.topics.filter((topic) => {
      if (levelFilter !== 'All' && topic.level !== levelFilter) return false;
      if (statusFilter !== 'All') {
        const st = getTopicStatus(topic.title);
        if (statusFilter === 'completed') {
          return st === 'learned' || st === 'explained' || st === 'interviewed';
        }
        return st === statusFilter;
      }
      return true;
    });

    const groups: Array<{
      subgroup: string;
      description: string;
      topics: CurriculumTopic[];
    }> = [];

    const subgroupDescriptions: Record<string, string> = {
      Basics: 'What do I need to understand the concept? Foundational intuition & core mental models',
      Algorithms: 'Core algorithmic mechanics, mathematical formulation & computational complexity',
      Intermediate: 'How does it actually work? Under-the-hood execution mechanics & architectures',
      Metrics: 'Evaluation metrics, tradeoffs & offline/online validation criteria',
      'CNN & Vision': 'Spatial representations, convolutions & spatial invariance',
      'Interview / Advanced': 'What might an interviewer ask me, and what tradeoffs should I understand?',
    };

    for (const sg of currentSection.subgroups) {
      const topicsInSg = filtered.filter((t) => t.subgroup === sg);
      if (topicsInSg.length > 0) {
        groups.push({
          subgroup: sg,
          description: subgroupDescriptions[sg] || 'Curated interview preparation topics',
          topics: topicsInSg,
        });
      }
    }

    // Capture any topic with unlisted subgroup
    const remaining = filtered.filter((t) => !currentSection.subgroups.includes(t.subgroup));
    if (remaining.length > 0) {
      groups.push({
        subgroup: 'Additional Topics',
        description: 'Further concepts in this domain',
        topics: remaining,
      });
    }

    return groups;
  }, [searchQuery, currentSection, levelFilter, statusFilter, progressKey]);

  // Total topics currently visible
  const totalVisibleCount = useMemo(() => {
    if (searchQuery.trim()) return searchResults.length;
    return groupedSubgroupTopics.reduce((acc, g) => acc + g.topics.length, 0);
  }, [searchQuery, searchResults, groupedSubgroupTopics]);

  // Load initial topic if provided
  useEffect(() => {
    if (initialTopic) {
      const found = findTopic(initialTopic);
      if (found) {
        handleOpenTopic(found);
      } else {
        // Custom topic outside predefined list
        fetchCustomLesson(initialTopic);
      }
    }
  }, [initialTopic]);

  const fetchLessonForTopic = async (topic: CurriculumTopic, depth: string = selectedDepth) => {
    setIsLoading(true);
    setError(null);
    setSelectedAnswers({});
    setShowQuizResults(false);
    markTopicInProgress(topic.title);
    setProgressKey((k) => k + 1);

    try {
      const res = await fetch('/api/learn-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.title,
          domain: 'AI/ML/GenAI',
          depth,
        }),
      });

      if (!res.ok) throw new Error('Failed to load topic lesson');
      const data: TechnicalLesson = await res.json();

      // Enrich with curriculum metadata if missing
      const enriched: TechnicalLesson = {
        ...data,
        whyItExists: data.whyItExists || topic.whyItExists,
        intuition: data.intuition || topic.intuition,
        howItWorks: data.howItWorks,
        prerequisites: data.prerequisites || topic.prerequisites,
        relatedTopics: data.relatedTopics || topic.relatedTopics,
        nextTopics: data.nextTopics || topic.nextTopics,
        interviewRelevance: topic.interviewRelevance,
      };

      setLesson(enriched);
    } catch (err: any) {
      setError(err.message || 'Error loading technical lesson');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomLesson = async (customTitle: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedAnswers({});
    setShowQuizResults(false);

    try {
      const res = await fetch('/api/learn-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: customTitle,
          domain: 'AI/ML/GenAI',
          depth: selectedDepth,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate custom lesson');
      const data: TechnicalLesson = await res.json();
      setLesson(data);
      setViewMode('lesson');
    } catch (err: any) {
      setError(err.message || 'Error generating custom lesson');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTopic = (topic: CurriculumTopic) => {
    setActiveCurriculumTopic(topic);
    setSelectedSectionId(topic.sectionId);
    setViewMode('lesson');
    fetchLessonForTopic(topic, selectedDepth);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToTopic = (titleOrId: string) => {
    const found = findTopic(titleOrId);
    if (found) {
      handleOpenTopic(found);
    } else {
      const searchRes = searchCurriculum(titleOrId);
      if (searchRes.length > 0) {
        handleOpenTopic(searchRes[0].topic);
      } else {
        fetchCustomLesson(titleOrId);
      }
    }
  };

  const handleDepthChange = (newDepth: 'Beginner' | 'Intermediate' | 'Interview' | 'Deep Technical') => {
    setSelectedDepth(newDepth);
    if (activeCurriculumTopic) {
      fetchLessonForTopic(activeCurriculumTopic, newDepth);
    } else if (lesson) {
      fetchCustomLesson(lesson.topic);
    }
  };

  const handleMarkAsLearned = () => {
    if (!lesson) return;
    markTopicLearned(lesson.topic);
    setProgressKey((k) => k + 1);
  };

  const handleSurpriseMe = () => {
    const topic = pickIntelligentSurpriseTopic(selectedSectionId);
    handleOpenTopic(topic);
  };

  const handleCopyPitch = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const renderStatusBadge = (title: string) => {
    const status: TopicStatus = getTopicStatus(title);
    switch (status) {
      case 'interviewed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/90 border border-purple-700/80 text-purple-300">
            <Terminal className="w-2.5 h-2.5" /> Interviewed
          </span>
        );
      case 'explained':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-950/90 border border-teal-700/80 text-teal-300">
            <Mic className="w-2.5 h-2.5" /> Explained
          </span>
        );
      case 'learned':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 border border-emerald-700/80 text-emerald-300">
            <CheckCircle2 className="w-2.5 h-2.5" /> Learned
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/90 border border-amber-700/80 text-amber-300">
            <Clock className="w-2.5 h-2.5" /> In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-800/80 border border-stone-700/60 text-stone-400">
            ○ Not Started
          </span>
        );
    }
  };

  const renderRelevanceStars = (rating: number = 3) => {
    const labels: Record<number, string> = {
      5: 'Very High',
      4: 'High',
      3: 'Medium',
      2: 'Low',
      1: 'General',
    };
    return (
      <div className="flex items-center gap-1.5" title={`Interview Relevance: ${rating} / 5 (${labels[rating] || 'Medium'})`}>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-3 h-3 ${
                star <= rating ? 'text-amber-400 fill-amber-400' : 'text-stone-700'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-medium text-stone-400">
          {labels[rating] || 'Medium'}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 px-3 sm:px-4 w-full min-w-0 font-['Plus_Jakarta_Sans']">
      {/* Top Banner: Software Engineering + AI/ML/GenAI Curriculum Header */}
      <div className="rounded-2xl bg-gradient-to-br from-stone-900 via-stone-900 to-teal-950/40 border border-stone-800 p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
              <Brain className="w-4 h-4" />
              <span>Software Engineering + AI/ML/GenAI Curriculum</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Technical Mastery & Interview Knowledge Map
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              Structured {orderedSections.length}-section technical progression from foundational software engineering,
              algorithms, and operating systems to LLM architectures, RAG systems, MLOps, and staff-level interview defenses.
            </p>
          </div>

          {/* Quick Progress Dashboard Badge */}
          <div className="shrink-0 bg-stone-950/90 border border-stone-800 rounded-xl p-4 min-w-[220px] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-400 font-medium">Curriculum Progress</span>
              <span className="text-teal-400 font-bold">{overallStats.pct}%</span>
            </div>
            <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${overallStats.pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>
                <strong className="text-stone-200">{overallStats.completed}</strong> of{' '}
                {overallStats.total} mastered
              </span>
              <span className="text-emerald-400 font-semibold">{orderedSections.length} Core Sections</span>
            </div>
          </div>
        </div>

        {/* Global Controls & Smart Recommendation */}
        <div className="mt-6 pt-5 border-t border-stone-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {viewMode === 'lesson' && (
              <button
                onClick={() => setViewMode('curriculum')}
                id="btn-back-to-curriculum"
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-stone-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Browse All Sections</span>
              </button>
            )}
            <button
              onClick={handleSurpriseMe}
              id="btn-surprise-me-smart"
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 text-teal-300 border border-teal-600/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Intelligently picks an unmastered or high-yield topic"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Smart Recommendation / Surprise Me</span>
            </button>
          </div>

          <div className="text-xs text-stone-400 flex items-center gap-3">
            <span className="hidden sm:inline">Every topic integrates with:</span>
            <span className="inline-flex items-center gap-1 text-teal-400">
              <Mic className="w-3 h-3" /> Learn → Explain
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-purple-400">
              <Terminal className="w-3 h-3" /> Interview Simulator
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CURRICULUM BROWSER VIEW (Categories & Structured Topics) */}
      {/* ========================================================================= */}
      {viewMode === 'curriculum' && (
        <div className="space-y-6">
          {/* Search and Filters Bar */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search across all curriculum topics (e.g. Binary Search, B-Tree, TCP, Attention, RAG, Virtual Memory)..."
                  className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-500 text-xs sm:text-sm focus:outline-none focus:border-teal-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-stone-500 hover:text-stone-300 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={levelFilter}
                  onChange={(e: any) => setLevelFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-300 text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="All">All Levels</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Interview">Interview / Advanced</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-300 text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Learned / Mastered</option>
                </select>
              </div>
            </div>

            {searchQuery && (
              <p className="text-xs text-stone-400">
                Found <strong>{searchResults.length}</strong> matching topics across all 12 domains.
              </p>
            )}
          </div>

          {/* ========================================================================= */}
          {/* VISUAL ROADMAP: Recommended 12-Domain Progression Flow */}
          {/* ========================================================================= */}
          {!searchQuery && (
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 sm:p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-teal-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    Recommended Learning Roadmap (12 Domains)
                  </h2>
                </div>
                <button
                  onClick={() => setShowRoadmap(!showRoadmap)}
                  className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1 font-medium transition-colors"
                >
                  <span>{showRoadmap ? 'Collapse Roadmap' : 'Expand Roadmap'}</span>
                  {showRoadmap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showRoadmap && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Recommended chronological progression from algorithmic fundamentals to LLM architectures, RAG, agents, MCP, and production engineering. Jump to any domain at any time:
                  </p>

                  {/* Horizontal Scrollable Progression Strip */}
                  <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-700">
                    <div className="flex items-center gap-2 min-w-max">
                      {orderedSections.map((sec, idx) => {
                        const isCurrent = selectedSectionId === sec.id;
                        const prog = getSectionProgress(sec.id);
                        return (
                          <React.Fragment key={sec.id}>
                            <button
                              onClick={() => {
                                setSelectedSectionId(sec.id);
                                setSearchQuery('');
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 shrink-0 ${
                                isCurrent
                                  ? 'bg-stone-800 border-teal-500 shadow-md shadow-teal-950/40 ring-1 ring-teal-500/60 text-white'
                                  : 'bg-stone-950/80 border-stone-800 hover:border-stone-700 hover:bg-stone-850 text-stone-300'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center shrink-0 ${
                                  isCurrent
                                    ? 'bg-teal-500 text-stone-950'
                                    : prog.percentage === 100
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-stone-800 text-stone-400'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div className="text-left">
                                <span className="text-xs font-bold block whitespace-nowrap">
                                  {sec.shortTitle}
                                </span>
                                <span className="text-[10px] text-stone-500 block">
                                  {prog.completed}/{prog.total} mastered
                                </span>
                              </div>
                            </button>

                            {idx < orderedSections.length - 1 && (
                              <ArrowRight className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 12 Curriculum Section Tabs (Module Grid) */}
          {!searchQuery && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-teal-400" />
                  <span>Knowledge Domains (12 Modules)</span>
                </h2>
                <span className="text-[11px] text-stone-500">Select any domain to view structured topics</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {orderedSections.map((section, idx) => {
                  const isSelected = selectedSectionId === section.id;
                  const prog = getSectionProgress(section.id);
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setSelectedSectionId(section.id);
                        setSearchQuery('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-stone-800 border-teal-500 shadow-lg shadow-teal-950/40 ring-1 ring-teal-500/60'
                          : 'bg-stone-900/90 border-stone-800/80 hover:bg-stone-850 hover:border-stone-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-teal-400 font-bold">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-950 font-semibold text-stone-400">
                            {prog.completed}/{prog.total}
                          </span>
                        </div>
                        <h3 className={`text-xs font-bold line-clamp-2 ${isSelected ? 'text-white' : 'text-stone-200'}`}>
                          {section.title}
                        </h3>
                      </div>

                      {/* Mini progress bar */}
                      <div className="w-full bg-stone-950 h-1 rounded-full overflow-hidden mt-2.5">
                        <div
                          className={`h-full transition-all ${
                            prog.percentage === 100
                              ? 'bg-emerald-400'
                              : isSelected
                              ? 'bg-teal-400'
                              : 'bg-stone-700'
                          }`}
                          style={{ width: `${prog.percentage}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION DETAIL & HIERARCHICAL TOPICS LIST */}
          {/* ========================================================================= */}
          <div className="space-y-6">
            {/* Active Module Header (when not searching) */}
            {!searchQuery && (
              <div className="p-4 sm:p-5 rounded-2xl bg-stone-900 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                      Active Domain
                    </span>
                    <span className="text-stone-600">•</span>
                    <span className="text-xs text-stone-400">
                      {currentSection.topics.length} core interview topics across {currentSection.subgroups.length} phases
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white tracking-tight">{currentSection.title}</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">{currentSection.description}</p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs text-stone-400 hidden sm:inline">Target Roles:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-teal-950/80 border border-teal-800 text-teal-300 text-xs font-semibold">
                    {currentSection.targetInterviewRoles?.join(', ') || 'Software & AI Engineers'}
                  </span>
                </div>
              </div>
            )}

            {/* Render Search Results with Full Path if Search Query Active */}
            {searchQuery && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-400 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    Showing <strong>{searchResults.length}</strong> matching topics with domain paths:
                  </span>
                  <span className="text-teal-400 font-medium">Click any topic card to study or practice</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {searchResults.map(({ topic, section }) => (
                    <div key={topic.id} className="space-y-1.5">
                      {/* Breadcrumb Path Banner */}
                      <div className="text-[11px] font-semibold text-teal-400 flex items-center gap-1.5 px-1">
                        <span className="text-stone-500">AI/ML</span>
                        <span className="text-stone-600">→</span>
                        <span className="text-stone-300">{section.shortTitle}</span>
                        <span className="text-stone-600">→</span>
                        <span className="text-teal-300 font-bold">{topic.subgroup}</span>
                      </div>

                      {/* Topic Card */}
                      <div className="rounded-xl bg-stone-900 border border-stone-800/90 hover:border-stone-700 p-4 flex flex-col justify-between gap-3 transition-all hover:bg-stone-850 hover:shadow-lg hover:shadow-stone-950/50 group">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              {renderStatusBadge(topic.title)}
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-stone-800 text-stone-300">
                                {topic.level}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-stone-400">
                              {renderRelevanceStars(topic.interviewRelevance)}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                              {topic.title}
                            </h4>
                            <p className="text-xs text-stone-300 mt-1 line-clamp-2 leading-relaxed">
                              {topic.oneLiner}
                            </p>
                          </div>

                          {topic.whyItExists && (
                            <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-850 text-[11px] text-stone-400 line-clamp-2">
                              <strong className="text-stone-300 font-semibold">Why it exists:</strong>{' '}
                              {topic.whyItExists}
                            </div>
                          )}

                          {topic.prerequisites && topic.prerequisites.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-stone-400">
                              <span className="text-stone-500 font-medium">Prereqs:</span>
                              {topic.prerequisites.map((p, i) => (
                                <button
                                  key={i}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigateToTopic(p);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 hover:border-teal-500 text-stone-400 hover:text-teal-300 transition-colors"
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-stone-800/70 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleOpenTopic(topic)}
                            className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Study Topic</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onGoToExplain(topic.title, 'AI/ML/GenAI')}
                              className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1 transition-colors"
                              title="Practice explaining out loud"
                            >
                              <Mic className="w-3 h-3 text-teal-400" />
                              <span>Explain</span>
                            </button>

                            {onGoToInterview && (
                              <button
                                onClick={() => onGoToInterview(topic.title, 'AI/ML')}
                                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                title="Start interview simulator on this topic"
                              >
                                <Terminal className="w-3 h-3 text-purple-400" />
                                <span>Interview Me</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Render Hierarchical Subgroups (Basics -> Algorithms -> Intermediate -> Metrics -> Interview / Advanced) */}
            {!searchQuery && (
              <div className="space-y-8">
                {groupedSubgroupTopics.map((group) => (
                  <div key={group.subgroup} className="space-y-3.5">
                    {/* Subgroup Hierarchical Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-stone-800 gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-xs font-mono font-bold tracking-wider px-2.5 py-1 rounded-md uppercase border ${
                            group.subgroup === 'Basics'
                              ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                              : group.subgroup === 'Algorithms'
                              ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                              : group.subgroup === 'Intermediate'
                              ? 'bg-teal-950/60 border-teal-800 text-teal-300'
                              : group.subgroup === 'Metrics'
                              ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                              : group.subgroup === 'CNN & Vision'
                              ? 'bg-indigo-950/60 border-indigo-800 text-indigo-300'
                              : 'bg-purple-950/60 border-purple-800 text-purple-300'
                          }`}
                        >
                          {group.subgroup}
                        </span>
                        <span className="text-xs text-stone-400 font-medium">
                          {group.description}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-500 font-semibold shrink-0">
                        {group.topics.length} {group.topics.length === 1 ? 'topic' : 'topics'}
                      </span>
                    </div>

                    {/* Subgroup Topic Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {group.topics.map((topic) => (
                        <div
                          key={topic.id}
                          className="rounded-xl bg-stone-900 border border-stone-800/90 hover:border-stone-700 p-4 flex flex-col justify-between gap-3 transition-all hover:bg-stone-850 hover:shadow-lg hover:shadow-stone-950/50 group"
                        >
                          <div className="space-y-2">
                            {/* Top Badges */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                {renderStatusBadge(topic.title)}
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-stone-800 text-stone-300">
                                  {topic.level}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-stone-400">
                                {renderRelevanceStars(topic.interviewRelevance)}
                              </div>
                            </div>

                            {/* Title & Description */}
                            <div>
                              <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">
                                {topic.title}
                              </h4>
                              <p className="text-xs text-stone-300 mt-1 line-clamp-2 leading-relaxed">
                                {topic.oneLiner}
                              </p>
                            </div>

                            {/* Why it exists snippet */}
                            {topic.whyItExists && (
                              <div className="p-2 rounded-lg bg-stone-950/80 border border-stone-850 text-[11px] text-stone-400 line-clamp-2">
                                <strong className="text-stone-300 font-semibold">Why it exists:</strong>{' '}
                                {topic.whyItExists}
                              </div>
                            )}

                            {/* Prerequisites tags (Clickable!) */}
                            {topic.prerequisites && topic.prerequisites.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-stone-400">
                                <span className="text-stone-500 font-medium">Prereqs:</span>
                                {topic.prerequisites.map((p, i) => (
                                  <button
                                    key={i}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNavigateToTopic(p);
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 hover:border-teal-500 text-stone-400 hover:text-teal-300 transition-colors"
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-stone-800/70 flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleOpenTopic(topic)}
                              className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Study Topic</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onGoToExplain(topic.title, 'AI/ML/GenAI')}
                                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                title="Practice explaining out loud"
                              >
                                <Mic className="w-3 h-3 text-teal-400" />
                                <span>Explain</span>
                              </button>

                              {onGoToInterview && (
                                <button
                                  onClick={() => onGoToInterview(topic.title, 'AI/ML')}
                                  className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                  title="Start interview simulator on this topic"
                                >
                                  <Terminal className="w-3 h-3 text-purple-400" />
                                  <span>Interview Me</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State when zero topics match */}
            {totalVisibleCount === 0 && (
              <div className="text-center py-12 rounded-xl bg-stone-900 border border-stone-800 space-y-3">
                <AlertCircle className="w-8 h-8 text-stone-500 mx-auto" />
                <p className="text-stone-300 text-sm">No topics match your current search and filter settings.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setLevelFilter('All');
                    setStatusFilter('All');
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-semibold hover:bg-stone-700"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOPIC DEEP-DIVE LESSON VIEW (Rich 17-Part Content + Integrations) */}
      {/* ========================================================================= */}
      {viewMode === 'lesson' && (
        <div className="space-y-6">
          {/* Breadcrumb Navigation Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <button
              onClick={() => setViewMode('curriculum')}
              className="inline-flex items-center gap-1.5 text-stone-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-teal-400" />
              <span>Back to Curriculum Overview</span>
            </button>

            {activeCurriculumTopic && (
              <div className="text-stone-400 flex items-center gap-2">
                <span>{currentSection.title}</span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-600" />
                <span className="text-teal-400 font-semibold">{activeCurriculumTopic.title}</span>
              </div>
            )}
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-12 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Synthesizing Comprehensive Engineering Lesson...
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Structuring intuition, system architecture, tradeoffs, and interview scripts for{' '}
                  <strong className="text-teal-300">
                    {activeCurriculumTopic ? activeCurriculumTopic.title : 'this topic'}
                  </strong>
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="rounded-2xl bg-rose-950/60 border border-rose-800 p-5 text-xs text-rose-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() =>
                  activeCurriculumTopic && fetchLessonForTopic(activeCurriculumTopic, selectedDepth)
                }
                className="px-3 py-1.5 rounded-lg bg-rose-900 hover:bg-rose-800 text-white font-semibold shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Lesson Content Render */}
          {lesson && !isLoading && (
            <div className="space-y-6">
              {/* Primary Topic Header Card */}
              <div className="rounded-2xl bg-gradient-to-r from-stone-900 via-stone-900 to-teal-950/50 border border-teal-800/60 p-5 sm:p-7 shadow-xl space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderStatusBadge(lesson.topic)}
                      <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                        {lesson.domain}
                      </span>
                      <span className="text-stone-600">•</span>
                      <span className="text-xs text-stone-400">
                        {lesson.depth} Level
                      </span>
                      {activeCurriculumTopic?.interviewRelevance && (
                        <>
                          <span className="text-stone-600">•</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-stone-400">Interview Yield:</span>
                            {renderRelevanceStars(activeCurriculumTopic.interviewRelevance)}
                          </div>
                        </>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {lesson.topic}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-300 italic">
                      "{lesson.oneLineExplanation}"
                    </p>
                  </div>

                  {/* Primary Integrations Action Group */}
                  <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <button
                      onClick={handleMarkAsLearned}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                        getTopicStatus(lesson.topic) === 'learned' ||
                        getTopicStatus(lesson.topic) === 'explained' ||
                        getTopicStatus(lesson.topic) === 'interviewed'
                          ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                          : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-200'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>
                        {getTopicStatus(lesson.topic) === 'learned' ||
                        getTopicStatus(lesson.topic) === 'explained' ||
                        getTopicStatus(lesson.topic) === 'interviewed'
                          ? 'Mastered'
                          : 'Mark as Learned'}
                      </span>
                    </button>

                    <button
                      onClick={() => onGoToExplain(lesson.topic, lesson.domain)}
                      id="btn-lesson-explain-yourself"
                      className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-teal-950 transition-all hover:scale-[1.02]"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Explain It Yourself</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {onGoToInterview && (
                      <button
                        onClick={() =>
                          onGoToInterview(
                            lesson.topic,
                            getTrackForSection(activeCurriculumTopic?.sectionId)
                          )
                        }
                        id="btn-lesson-interview-me"
                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-950 transition-all hover:scale-[1.02]"
                      >
                        <Terminal className="w-4 h-4" />
                        <span>Interview Me</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Depth Calibration Pills */}
                <div className="pt-4 border-t border-stone-800 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 font-semibold">Depth Calibration:</span>
                    {(['Beginner', 'Intermediate', 'Interview', 'Deep Technical'] as const).map(
                      (depth) => (
                        <button
                          key={depth}
                          onClick={() => handleDepthChange(depth)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            selectedDepth === depth
                              ? 'bg-teal-500 text-stone-950 font-bold shadow-sm'
                              : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                          }`}
                        >
                          {depth}
                        </button>
                      )
                    )}
                  </div>

                  <span className="text-[11px] text-stone-500">
                    Switch depth to recalibrate explanations and interview prompts
                  </span>
                </div>
              </div>

              {/* Intuition & Why It Exists (Staff+ Mental Model) */}
              {(lesson.whyItExists || lesson.intuition) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lesson.whyItExists && (
                    <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        <span>Why This Technology Exists</span>
                      </span>
                      <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                        {lesson.whyItExists}
                      </p>
                    </div>
                  )}

                  {lesson.intuition && (
                    <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5" />
                        <span>Core Intuitive Mental Model</span>
                      </span>
                      <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                        {lesson.intuition}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 1 & 2: Layman Analogy vs Technical Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Layman Analogy
                  </span>
                  <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                    {lesson.laymanExplanation}
                  </p>
                </div>

                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                    Technical Explanation
                  </span>
                  <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                    {lesson.technicalExplanation}
                  </p>
                </div>
              </div>

              {/* 3 & 4: Core Concepts & Architecture Flow */}
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
                    <span>Architecture & Execution Flow</span>
                  </span>
                  <div className="text-xs text-stone-300 leading-relaxed font-mono bg-stone-950 p-3 rounded-lg border border-stone-800 whitespace-pre-wrap overflow-x-auto max-w-full">
                    {lesson.architectureOrFlow}
                  </div>
                </div>
              </div>

              {/* 5 & 6: Crucial Terminology & Practical Code */}
              <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Crucial Terminology for Interviews
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                        Practical Implementation / Scenario
                      </span>
                      <button
                        onClick={() => handleCopyPitch(lesson.practicalExample, 'code')}
                        className="text-[11px] text-teal-400 hover:text-teal-200 flex items-center gap-1"
                      >
                        {copiedSection === 'code' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy Code
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-emerald-300 overflow-x-auto max-w-full whitespace-pre-wrap break-all sm:break-normal">
                      {lesson.practicalExample}
                    </pre>
                  </div>
                )}
              </div>

              {/* 7 & 8: Real-World Use Cases & Common Misconceptions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Production Systems & Real-World Scale
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

              {/* 9 & 10: Interview Defense & Traps */}
              <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-400" />
                  <span>Interview Defense: Questions, Probes & Candidate Mistakes</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                    <span className="text-[11px] font-bold uppercase text-purple-400">
                      Standard Interview Questions
                    </span>
                    <ul className="space-y-1.5 text-xs text-stone-300">
                      {lesson.interviewQuestions.map((q, i) => (
                        <li key={i} className="leading-relaxed">• {q}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                    <span className="text-[11px] font-bold uppercase text-indigo-400">
                      Deep Follow-Up Probes
                    </span>
                    <ul className="space-y-1.5 text-xs text-stone-300">
                      {lesson.followUpQuestions.map((f, i) => (
                        <li key={i} className="leading-relaxed">• {f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                    <span className="text-[11px] font-bold uppercase text-amber-400">
                      Mistakes Candidates Make
                    </span>
                    <ul className="space-y-1.5 text-xs text-stone-300">
                      {lesson.commonMistakesCandidatesMake.map((m, i) => (
                        <li key={i} className="leading-relaxed">• {m}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 11: Calibrated Spoken Responses with 1-Click Copy */}
              <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Calibrated Spoken Responses for Live Interviews</span>
                  </h3>
                  <span className="text-[11px] text-stone-400">Use these to structure verbal answers</span>
                </div>

                <div className="space-y-3">
                  {/* 30-Sec Pitch */}
                  <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-emerald-400">
                        30-Second Elevator Pitch
                      </span>
                      <button
                        onClick={() => handleCopyPitch(lesson.thirtySecondExplanation, '30s')}
                        className="text-[11px] text-stone-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedSection === '30s' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-sans">
                      "{lesson.thirtySecondExplanation}"
                    </p>
                  </div>

                  {/* 60-Sec Pitch */}
                  <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-teal-400">
                        60-Second Structured Explanation (Context → Mechanism → Tradeoffs)
                      </span>
                      <button
                        onClick={() => handleCopyPitch(lesson.sixtySecondExplanation, '60s')}
                        className="text-[11px] text-stone-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedSection === '60s' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-sans">
                      "{lesson.sixtySecondExplanation}"
                    </p>
                  </div>

                  {/* 2-Min Master Response */}
                  <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-cyan-400">
                        2-Minute Senior Engineer Response
                      </span>
                      <button
                        onClick={() => handleCopyPitch(lesson.twoMinuteExplanation, '2m')}
                        className="text-[11px] text-stone-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedSection === '2m' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-sans">
                      "{lesson.twoMinuteExplanation}"
                    </p>
                  </div>
                </div>
              </div>

              {/* 12: Quick Revision Takeaways */}
              <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-3">
                <h3 className="text-sm font-bold text-white">Quick Revision Takeaways</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lesson.quickRevision.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prerequisites & Next Topics in Learning Progression (Clickable!) */}
              {(activeCurriculumTopic?.prerequisites?.length ||
                activeCurriculumTopic?.nextTopics?.length ||
                activeCurriculumTopic?.relatedTopics?.length) && (
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
                    <GitCommit className="w-4 h-4" />
                    <span>Curriculum Progression & Connections</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Prerequisites */}
                    {activeCurriculumTopic?.prerequisites &&
                      activeCurriculumTopic.prerequisites.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-stone-300">
                            Foundational Prerequisites:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {activeCurriculumTopic.prerequisites.map((p, i) => {
                              const found = findTopic(p);
                              return (
                                <button
                                  key={i}
                                  onClick={() => found && handleOpenTopic(found)}
                                  disabled={!found}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                                    found
                                      ? 'bg-stone-950 hover:bg-stone-850 border-stone-800 hover:border-teal-500 text-teal-300 cursor-pointer'
                                      : 'bg-stone-950 border-stone-850 text-stone-500 cursor-default'
                                  }`}
                                >
                                  ← {p}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Next Topics */}
                    {activeCurriculumTopic?.nextTopics &&
                      activeCurriculumTopic.nextTopics.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-stone-300">
                            Next Topics in Mastery Path:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {activeCurriculumTopic.nextTopics.map((n, i) => {
                              const found = findTopic(n);
                              return (
                                <button
                                  key={i}
                                  onClick={() => found && handleOpenTopic(found)}
                                  disabled={!found}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                                    found
                                      ? 'bg-stone-950 hover:bg-stone-850 border-stone-800 hover:border-emerald-500 text-emerald-300 cursor-pointer'
                                      : 'bg-stone-950 border-stone-850 text-stone-500 cursor-default'
                                  }`}
                                >
                                  {n} →
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* 13: Interactive Quiz */}
              {lesson.quiz && lesson.quiz.length > 0 && (
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-4">
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
                      <div
                        key={qIdx}
                        className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-3"
                      >
                        <p className="text-xs font-semibold text-stone-200">
                          {qIdx + 1}. {q.question}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const isChosen = selectedAnswers[qIdx] === optIdx;
                            const isCorrect = q.correctIndex === optIdx;
                            let btnStyle =
                              'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700';

                            if (showQuizResults) {
                              if (isCorrect) {
                                btnStyle =
                                  'bg-emerald-950/80 border-emerald-600 text-emerald-300 font-bold';
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
                                className={`p-2.5 rounded-lg border text-left text-xs transition-colors break-words w-full ${btnStyle}`}
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

              {/* 14: Trusted References & Research Papers */}
              {lesson.trustedSources && lesson.trustedSources.length > 0 && (
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-xs text-stone-400 font-semibold uppercase tracking-wider">
                    Official Documentation & Seminal Papers:
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
                        <span className="truncate max-w-[240px]">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Continuous Learning & Testing Loop */}
              <div className="rounded-2xl bg-gradient-to-r from-stone-900 via-stone-900 to-teal-950/60 border border-teal-800/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                    Continuous Learning Loop
                  </span>
                  <h4 className="text-sm font-bold text-white">
                    Ready to practice verbal recall or simulate a technical round?
                  </h4>
                  <p className="text-xs text-stone-300">
                    Test your verbal delivery of "{lesson.topic}" against our real-time AI evaluator.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => onGoToExplain(lesson.topic, lesson.domain)}
                    id="btn-bottom-explain-yourself"
                    className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-stone-950 text-xs font-bold transition-all hover:scale-[1.02] flex items-center gap-2 shadow-md shadow-teal-950"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Explain It Yourself</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {onGoToInterview && (
                    <button
                      onClick={() =>
                        onGoToInterview(
                          lesson.topic,
                          getTrackForSection(activeCurriculumTopic?.sectionId)
                        )
                      }
                      id="btn-bottom-interview-me"
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all hover:scale-[1.02] flex items-center gap-2 shadow-md shadow-purple-950"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Interview Me</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
