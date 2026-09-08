import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquareQuote,
  Mic,
  Square,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  EyeOff,
  BookOpen,
  Volume2,
  Shuffle,
  ChevronRight,
} from 'lucide-react';
import { VoiceRecognizer, speakText } from '../lib/speech';
import { ExplainEvaluation, ExplainSessionRecord, DomainTopicItem } from '../types';
import { recordExplainSession } from '../lib/storage';

const DOMAINS: string[] = [
  'AI/ML',
  'DSA',
  'CS Fundamentals',
  'Backend & Systems',
  'System Design',
  'Programming Languages',
];

const CS_SUBJECTS: string[] = [
  'All Subjects',
  'Operating Systems',
  'Computer Networks',
  'DBMS & Storage',
  'Computer Architecture',
  'Compiler Design',
];

interface ExplainTopicViewProps {
  initialTopic?: string;
  initialDomain?: string;
}

export const ExplainTopicView: React.FC<ExplainTopicViewProps> = ({
  initialTopic = 'Database Indexing (B-Trees vs Hash)',
  initialDomain = 'CS Fundamentals',
}) => {
  const [topic, setTopic] = useState<string>(initialTopic);
  const [domain, setDomain] = useState<string>(initialDomain);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');

  // Dynamic unlimited domain questions state
  const [domainQuestions, setDomainQuestions] = useState<Record<string, DomainTopicItem[]>>({});
  const [isFetchingQuestions, setIsFetchingQuestions] = useState<boolean>(false);
  const [seenQuestions, setSeenQuestions] = useState<string[]>([]);

  // Steps: 'prep' -> 'countdown' -> 'speaking' -> 'evaluating' -> 'results'
  const [step, setStep] = useState<'prep' | 'countdown' | 'speaking' | 'evaluating' | 'results'>('prep');

  // Countdown timer before notes are hidden
  const [countdown, setCountdown] = useState<number>(30);
  const countdownIntervalRef = useRef<any>(null);

  // Speaking & Recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [speechSeconds, setSpeechSeconds] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>('');
  const [micError, setMicError] = useState<string | null>(null);

  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  const speechIntervalRef = useRef<any>(null);

  // Evaluation
  const [evaluation, setEvaluation] = useState<ExplainEvaluation | null>(null);

  const fetchDomainQuestions = async (
    dom: string,
    force: boolean = false,
    diff: string = selectedDifficulty,
    subj: string = selectedSubject
  ) => {
    setIsFetchingQuestions(true);
    try {
      const res = await fetch('/api/domain-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: dom,
          mode: 'explain',
          difficulty: diff !== 'All' ? diff : undefined,
          subject: dom === 'CS Fundamentals' && subj !== 'All Subjects' ? subj : undefined,
          exclude: force ? seenQuestions : [],
          count: 8,
        }),
      });

      if (!res.ok) throw new Error('Failed to load questions');
      const data = await res.json();
      const loaded: DomainTopicItem[] = data.topics || [];

      setDomainQuestions((prev) => ({
        ...prev,
        [dom]: loaded,
      }));

      const newQ = loaded.map((t) => t.topic);
      setSeenQuestions((prev) => Array.from(new Set([...prev, ...newQ])));
    } catch (err) {
      console.error('Error fetching domain questions:', err);
    } finally {
      setIsFetchingQuestions(false);
    }
  };

  useEffect(() => {
    fetchDomainQuestions(domain, false, selectedDifficulty, selectedSubject);
  }, [domain, selectedDifficulty, selectedSubject]);

  useEffect(() => {
    return () => {
      stopSpeakingInternal();
    };
  }, []);

  const startPreparationCountdown = () => {
    setStep('countdown');
    setCountdown(30);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          startSpeakingPhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const skipCountdownToSpeaking = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    startSpeakingPhase();
  };

  const startSpeakingPhase = async () => {
    setStep('speaking');
    setTranscript('');
    setSpeechSeconds(0);
    setMicError(null);

    const recognizer = new VoiceRecognizer();
    recognizerRef.current = recognizer;

    recognizer.onTranscriptUpdate = (text) => {
      setTranscript(text);
    };

    recognizer.onLevelUpdate = (lvl) => {
      setAudioLevel(lvl);
    };

    recognizer.onError = (err) => {
      setMicError(err);
    };

    const ok = await recognizer.start();
    if (!ok) return;

    setIsRecording(true);
    speechIntervalRef.current = setInterval(() => {
      setSpeechSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopSpeakingInternal = (): string => {
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);

    let recText = '';
    if (recognizerRef.current) {
      recText = recognizerRef.current.stop();
    }
    return recText || transcript;
  };

  const finishSpeakingAndEvaluate = async () => {
    const finalTranscript = stopSpeakingInternal();
    const cleanText = (finalTranscript || transcript).trim();

    if (!cleanText || cleanText.length < 5) {
      setMicError('No clear speech detected. Please speak into the mic or enter your explanation.');
      return;
    }

    setStep('evaluating');

    try {
      const res = await fetch('/api/evaluate-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          domain,
          transcript: cleanText,
        }),
      });

      if (!res.ok) throw new Error('Evaluation request failed');
      const evalData: ExplainEvaluation = await res.json();
      setEvaluation(evalData);
      setStep('results');

      // Record in storage
      const record: ExplainSessionRecord = {
        id: 'explain_' + Date.now(),
        createdAt: Date.now(),
        topic,
        domain,
        transcript: cleanText,
        evaluation: evalData,
      };
      recordExplainSession(record);
    } catch (err: any) {
      setMicError(err.message || 'Error evaluating');
      setStep('speaking');
    }
  };

  const handleRetry = () => {
    setEvaluation(null);
    setTranscript('');
    setSpeechSeconds(0);
    setMicError(null);
    setStep('prep');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
          <MessageSquareQuote className="w-4 h-4" />
          <span>Active Verbal Knowledge Retrieval</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          Learn → Explain Mode
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          The ultimate retention loop: learn the concept, gather your thoughts, hide all notes, and explain it aloud. The AI diagnoses conceptual gaps vs verbal delivery issues.
        </p>
      </div>

      {/* Step 1: Prep Screen */}
      {step === 'prep' && (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 space-y-6 shadow-xl">
          {/* Domain Tabs & Refresh Questions */}
          <div className="space-y-3 pb-3 border-b border-stone-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {/* Domain Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
                {DOMAINS.map((dom) => (
                  <button
                    key={dom}
                    onClick={() => setDomain(dom)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
                      domain === dom
                        ? 'bg-stone-800 text-cyan-300 border-cyan-700 shadow-sm'
                        : 'bg-stone-950/70 text-stone-400 border-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {dom}
                  </button>
                ))}
              </div>

              {/* Actions: Refresh Questions & Surprise Me */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => fetchDomainQuestions(domain, true, selectedDifficulty, selectedSubject)}
                  disabled={isFetchingQuestions}
                  id="btn-refresh-explain-questions"
                  title="Shuffle and get fresh verbal prompts from this vast domain"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 text-cyan-400 text-xs font-semibold border border-stone-800 hover:border-cyan-800/80 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingQuestions ? 'animate-spin' : ''}`} />
                  <span>Refresh Questions</span>
                </button>

                <button
                  onClick={() => {
                    const list = domainQuestions[domain] || [];
                    if (list.length > 0) {
                      const pick = list[Math.floor(Math.random() * list.length)];
                      setTopic(pick.topic);
                    } else {
                      fetchDomainQuestions(domain, true, selectedDifficulty, selectedSubject);
                    }
                  }}
                  id="btn-surprise-me-explain"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 text-xs font-semibold border border-cyan-800/60 transition-colors"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Surprise Me</span>
                </button>
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-stone-800/60">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mr-1">Difficulty:</span>
                {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setSelectedDifficulty(diff)}
                    id={`btn-explain-diff-${diff.toLowerCase()}`}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                      selectedDifficulty === diff
                        ? 'bg-amber-400 text-stone-950 border-amber-300 shadow-sm font-bold'
                        : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              <span className="text-[10px] sm:text-[11px] text-amber-300/90 italic font-mono">
                {selectedDifficulty === 'Beginner' && 'Foundational interview definitions & core commands'}
                {selectedDifficulty === 'Intermediate' && 'Deeper mechanics, data pipelines & tradeoffs'}
                {selectedDifficulty === 'Advanced' && 'Scenario-based, conceptual-logical depth & edge cases'}
                {selectedDifficulty === 'All' && 'Full spectrum across all experience tiers'}
              </span>
            </div>

            {/* Conditional CS Fundamentals Subject Filter */}
            {domain === 'CS Fundamentals' && (
              <div className="p-2.5 rounded-xl bg-stone-950/90 border border-stone-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-stone-400 font-semibold uppercase tracking-wider">
                  <span>CS Subject:</span>
                  <span className="text-cyan-400 font-normal">{selectedSubject}</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  {CS_SUBJECTS.map((subj) => (
                    <button
                      key={subj}
                      onClick={() => setSelectedSubject(subj)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                        selectedSubject === subj
                          ? 'bg-stone-800 text-cyan-300 border-cyan-600 font-semibold shadow-sm'
                          : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Question Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {isFetchingQuestions && (!domainQuestions[domain] || domainQuestions[domain].length === 0) ? (
                <div className="flex items-center gap-2 py-2 text-xs text-stone-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Generating fresh {domain} verbal challenges...</span>
                </div>
              ) : (
                (domainQuestions[domain] || []).map((q, qIdx) => {
                  const isSelected = topic === q.topic;
                  return (
                    <button
                      key={`${q.topic}-${qIdx}`}
                      onClick={() => setTopic(q.topic)}
                      className={`group px-3 py-2 rounded-xl text-xs transition-all text-left flex flex-col gap-1 max-w-full sm:max-w-[310px] border ${
                        isSelected
                          ? 'bg-stone-800 border-cyan-500 text-cyan-200 ring-1 ring-cyan-500/40 shadow-sm'
                          : 'bg-stone-950/90 border-stone-800 hover:border-cyan-500/70 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 w-full">
                        <span className="text-[10px] text-cyan-400/90 font-medium truncate">
                          {q.subdomain || domain}
                        </span>
                        {q.difficulty && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-300 font-mono">
                            {q.difficulty}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold line-clamp-2 leading-snug">
                        {q.topic}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
              Topic or Question to Explain in Your Own Words
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Explain KV Cache in LLMs or Database Indexing (B-Trees vs Hash)"
              className="w-full px-4 py-3 rounded-xl bg-stone-950 border border-stone-800 text-white font-semibold text-sm sm:text-base focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="rounded-xl bg-stone-950 p-5 border border-stone-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <EyeOff className="w-4 h-4" />
              <span>How This Exercise Works</span>
            </h4>
            <ol className="space-y-2 text-xs text-stone-300 leading-relaxed list-decimal list-inside">
              <li>You get 30 seconds to mentally outline your answer (Context → Mechanism → Tradeoffs).</li>
              <li>All notes and explanations are completely hidden from view.</li>
              <li>You speak aloud into the microphone for 60–120 seconds.</li>
              <li>The AI rigorously checks every concept against <strong className="text-white">CORRECT, PARTIALLY CORRECT, MISSING, INCORRECT, or MISLEADING</strong>.</li>
              <li>The AI explicitly diagnoses whether you <span className="text-emerald-400">knew it but explained badly</span> or <span className="text-rose-400">had conceptual gaps</span>.</li>
            </ol>
          </div>

          <button
            onClick={startPreparationCountdown}
            id="btn-start-explain-countdown"
            disabled={!topic.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-stone-950 font-bold text-sm shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            <span>Begin Mental Preparation (30s)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: 30-Second Countdown (Mental Prep) */}
      {step === 'countdown' && (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-8 text-center space-y-6 shadow-xl">
          <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
            Mental Preparation Buffer
          </span>
          <h2 className="text-2xl font-bold text-white max-w-xl mx-auto">
            Prepare to explain: <br />
            <span className="text-cyan-300">"{topic}"</span>
          </h2>
          <p className="text-stone-400 text-xs max-w-md mx-auto">
            Organize your mental outline. Once the timer expires, notes will be hidden and the microphone will turn on.
          </p>

          <div className="text-6xl font-extrabold font-mono text-cyan-400 animate-pulse py-2">
            0:{countdown.toString().padStart(2, '0')}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={skipCountdownToSpeaking}
              id="btn-skip-countdown"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-md shadow-emerald-950 transition-colors"
            >
              I'm Ready Now (Start Speaking)
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Speaking Phase (Notes are HIDDEN!) */}
      {step === 'speaking' && (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 space-y-6 shadow-xl text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-950/60 border border-rose-800/60 py-1.5 px-4 rounded-full max-w-fit mx-auto">
            <EyeOff className="w-3.5 h-3.5" />
            <span>Notes Hidden — Active Verbal Recall</span>
          </div>

          <div>
            <span className="text-xs text-stone-400 uppercase tracking-wider">Prompt</span>
            <h2 className="text-2xl font-extrabold text-white mt-1">
              "Explain {topic} in your own words."
            </h2>
          </div>

          {/* Speaking Timer & Wave */}
          <div className="py-2">
            <div className="text-4xl font-extrabold font-mono text-cyan-400">
              {Math.floor(speechSeconds / 60)}:
              {(speechSeconds % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Recommended: 60 to 90 seconds
            </p>
          </div>

          {/* Waveform */}
          {isRecording && (
            <div className="flex items-center justify-center gap-1.5 h-10 py-1">
              {[...Array(14)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-cyan-400 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(6, Math.min(40, (audioLevel / 100) * 40 * ((i % 3) + 0.5)))}px`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Stop / Finish Button */}
          <div className="flex justify-center">
            <button
              onClick={finishSpeakingAndEvaluate}
              id="btn-finish-explain"
              className="px-8 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-950 flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Done Explaining (Submit for Evaluation)</span>
            </button>
          </div>

          {/* Real-time transcript preview */}
          <div className="text-left space-y-2 pt-4 border-t border-stone-800">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>Transcript:</span>
              <span className="text-[11px] text-stone-500">Spoken or typed</span>
            </div>
            {isRecording ? (
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-sm leading-relaxed min-h-[80px]">
                {transcript || (
                  <span className="text-stone-500 italic">
                    Start speaking your explanation aloud...
                  </span>
                )}
              </div>
            ) : (
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Speak aloud using the microphone or type/edit your explanation here..."
                className="w-full min-h-[90px] p-4 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-sm leading-relaxed font-sans focus:outline-none focus:border-cyan-500 resize-y"
              />
            )}
          </div>

          {micError && (
            <div className="rounded-xl bg-rose-950/60 border border-rose-800 p-3 text-rose-300 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{micError}</span>
            </div>
          )}
        </div>
      )}

      {/* Evaluating Loading State */}
      {step === 'evaluating' && (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-12 text-center space-y-4 shadow-xl">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <h3 className="text-lg font-bold text-white">
            Classifying Technical Correctness & Concept Integrity...
          </h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            Checking concept depth, identifying missing invariants, and determining whether knowledge was clear or masked by verbal disfluency.
          </p>
        </div>
      )}

      {/* Step 4: Comprehensive Evaluation Results */}
      {step === 'results' && evaluation && (
        <div className="space-y-6">
          {/* Top Score Banner & Coach Diagnosis */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Verbal Explanation Scorecard
                </span>
                <h3 className="text-2xl font-extrabold text-white mt-0.5">
                  Technical Correctness: {evaluation.technicalCorrectness}/100
                </h3>
                <p className="text-xs text-stone-400 mt-1">
                  Overall Explanation Score: <strong className="text-white">{evaluation.overallScore}%</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => {
                    const list = domainQuestions[domain] || [];
                    const remaining = list.filter((q) => q.topic !== topic);
                    if (remaining.length > 0) {
                      const nextQ = remaining[Math.floor(Math.random() * remaining.length)];
                      setTopic(nextQ.topic);
                      handleRetry();
                    } else {
                      fetchDomainQuestions(domain, true).then(() => {
                        handleRetry();
                      });
                    }
                  }}
                  id="btn-next-explain-challenge"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-bold border border-stone-700 transition-colors"
                >
                  <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Next {domain} Challenge</span>
                </button>

                <button
                  onClick={handleRetry}
                  id="btn-retry-explain-exercise"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 text-xs font-bold transition-colors shadow-md shadow-cyan-950"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry This Topic</span>
                </button>
              </div>
            </div>

            {/* Mandatory Section 31 Diagnosis Distinction */}
            <div className="p-4 rounded-xl bg-stone-950 border border-cyan-900/40 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                Coach Diagnosis: {evaluation.distinctionDiagnosis.replace(/_/g, ' ')}
              </span>
              <p className="text-xs text-stone-300 leading-relaxed">
                {evaluation.diagnosisExplanation}
              </p>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Conceptual Depth</span>
                <p className="text-base font-bold text-teal-400">{evaluation.conceptualDepth}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Logical Structure</span>
                <p className="text-base font-bold text-indigo-400">{evaluation.logicalStructure}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Use of Examples</span>
                <p className="text-base font-bold text-purple-400">{evaluation.useOfExamples}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">English & Clarity</span>
                <p className="text-base font-bold text-emerald-400">{evaluation.englishAndCommunication}%</p>
              </div>
            </div>
          </div>

          {/* Section 35: Concept Status Breakdown (CORRECT, PARTIALLY_CORRECT, INCORRECT, MISSING, MISLEADING) */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Concept-by-Concept Technical Integrity</span>
            </h4>

            <div className="space-y-2.5">
              {evaluation.classifications.map((item, idx) => {
                let badgeStyle = 'bg-stone-800 text-stone-300';
                if (item.status === 'CORRECT') badgeStyle = 'bg-emerald-950 border-emerald-800 text-emerald-300';
                else if (item.status === 'PARTIALLY_CORRECT') badgeStyle = 'bg-teal-950 border-teal-800 text-teal-300';
                else if (item.status === 'INCORRECT') badgeStyle = 'bg-rose-950 border-rose-800 text-rose-300';
                else if (item.status === 'MISSING') badgeStyle = 'bg-amber-950 border-amber-800 text-amber-300';
                else if (item.status === 'MISLEADING') badgeStyle = 'bg-purple-950 border-purple-800 text-purple-300';

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-stone-950 border border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white">{item.concept}</span>
                      <p className="text-xs text-stone-400">{item.comment}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badgeStyle}`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Specific Feedback Quad: Correct vs Missed vs Misunderstood vs Add */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                What You Explained Correctly
              </span>
              <ul className="space-y-1 text-xs text-stone-300">
                {evaluation.whatExplainedCorrectly.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                What You Missed
              </span>
              <ul className="space-y-1 text-xs text-stone-300">
                {evaluation.whatMissed.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">!</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {evaluation.whatMisunderstood && evaluation.whatMisunderstood.length > 0 && (
              <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  What Was Misunderstood
                </span>
                <ul className="space-y-1 text-xs text-stone-300">
                  {evaluation.whatMisunderstood.map((pt, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold">✗</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                What to Add on Next Retry
              </span>
              <ul className="space-y-1 text-xs text-stone-300">
                {evaluation.whatToInclude.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">+</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Model Answer & Audio Playback */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Interview-Quality Benchmark Answer</span>
              </h4>
              <button
                onClick={() => speakText(evaluation.idealAnswer)}
                id="btn-speak-ideal-answer"
                className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-emerald-300"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Listen to Coach</span>
              </button>
            </div>
            <p className="text-sm text-stone-200 bg-stone-950 p-4 rounded-xl border border-stone-800 leading-relaxed font-sans">
              "{evaluation.idealAnswer}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
