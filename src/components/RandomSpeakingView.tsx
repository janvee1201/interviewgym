import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  RefreshCw,
  Clock,
  Zap,
  AlertTriangle,
  Volume2,
  VolumeX,
  CheckCircle,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Flame,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { VoiceRecognizer, speakText, stopSpeaking } from '../lib/speech';
import { SpeechEvaluation, SpeakingSessionRecord } from '../types';
import { recordSpeakingSession, getProfile } from '../lib/storage';

const TOPIC_PRESETS: Record<string, string[]> = {
  Technical: [
    'How does a database index (B-Tree) actually speed up read queries?',
    'Why is binary search O(log n) time complexity, and how do invariants guarantee correctness?',
    'Explain the fundamental difference between synchronous blocking I/O and asynchronous event loops.',
    'How do Large Language Models generate the next token using transformer attention mechanisms?',
    'What is the difference between horizontal and vertical scaling in distributed databases?',
  ],
  General: [
    'Is social media making modern knowledge workers less productive?',
    'Should college education be mandatory for entry-level software engineering roles?',
    'Will remote work remain the dominant model for high-performing engineering organizations?',
  ],
  Abstract: [
    'What does genuine professional success mean to you beyond title and compensation?',
    'Is failure strictly necessary for substantial cognitive and technical growth?',
    'How do you define the boundary between healthy perfectionism and destructive procrastination?',
  ],
  Personal: [
    'Describe a difficult technical crisis or outage you navigated, and how you handled it.',
    'What is an accomplishment or piece of software you built that you are genuinely proud of?',
    'Tell me about a time when you received harsh critical feedback and how you adapted.',
  ],
  Situational: [
    'A teammate on a critical release path is consistently missing commitments. How do you intervene?',
    'Your engineering manager strongly rejects an architectural proposal you spent weeks designing. What do you do?',
    'You discover a security vulnerability in production on a Friday afternoon before a long holiday. Walk through your actions.',
  ],
  Debate: [
    'Should startups prioritize speed of shipping features over clean code and unit testing?',
    'Is dynamic typing (e.g. Python, JS) superior to static typing (e.g. Go, TypeScript) for early-stage prototypes?',
  ],
  Creative: [
    'Imagine a programming language designed purely around human speech. How would concurrency work?',
    'If you had unlimited cloud compute for 48 hours, what technical problem would you attempt to simulate?',
  ],
};

const ALL_CATEGORIES = [
  'Technical',
  'General',
  'Abstract',
  'Personal',
  'Situational',
  'Debate',
  'Creative',
  'Random',
];

export const RandomSpeakingView: React.FC = () => {
  // Setup State
  const [topicCount, setTopicCount] = useState<number>(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Technical', 'Situational']);
  const [timeLimitSecs, setTimeLimitSecs] = useState<number>(60);
  const [pressureMode, setPressureMode] = useState<boolean>(false);

  // Session State
  const [sessionTopics, setSessionTopics] = useState<string[]>([]);
  const [currentTopicIndex, setCurrentTopicIndex] = useState<number>(0);
  const [sessionActive, setSessionActive] = useState<boolean>(false);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>('');
  const [pressureChallenge, setPressureChallenge] = useState<string | null>(null);

  // Evaluation State
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<SpeechEvaluation | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      stopRecording();
      stopSpeaking();
    };
  }, []);

  const toggleCategory = (cat: string) => {
    if (cat === 'Random') {
      setSelectedCategories(['Random']);
      return;
    }
    const filtered = selectedCategories.filter((c) => c !== 'Random');
    if (filtered.includes(cat)) {
      const next = filtered.filter((c) => c !== cat);
      setSelectedCategories(next.length > 0 ? next : ['Technical']);
    } else {
      setSelectedCategories([...filtered, cat]);
    }
  };

  const startNewSession = () => {
    // Generate topics
    const generated: string[] = [];
    const pool = selectedCategories.includes('Random')
      ? Object.values(TOPIC_PRESETS).flat()
      : selectedCategories.flatMap((cat) => TOPIC_PRESETS[cat] || TOPIC_PRESETS.General);

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < topicCount; i++) {
      generated.push(shuffled[i % shuffled.length]);
    }

    setSessionTopics(generated);
    setCurrentTopicIndex(0);
    setEvaluation(null);
    setSessionActive(true);
    setElapsedTime(0);
    setTranscript('');
    setPressureChallenge(null);
    setMicError(null);
  };

  const startRecording = async () => {
    setMicError(null);
    setTranscript('');
    setElapsedTime(0);
    setPressureChallenge(null);
    setEvaluation(null);

    const recognizer = new VoiceRecognizer();
    recognizerRef.current = recognizer;

    recognizer.onTranscriptUpdate = (text) => {
      setTranscript(text);
    };

    recognizer.onLevelUpdate = (level) => {
      setAudioLevel(level);
    };

    recognizer.onError = (err) => {
      setMicError(err);
    };

    const success = await recognizer.start();
    if (!success) {
      return;
    }

    setIsRecording(true);

    timerIntervalRef.current = setInterval(() => {
      setElapsedTime((prev) => {
        const next = prev + 1;

        // Pressure Mode tactics
        if (pressureMode) {
          if (next === Math.floor(timeLimitSecs / 2)) {
            setPressureChallenge('Challenge: Give a concrete real-world example now!');
          } else if (next === timeLimitSecs - 15) {
            setPressureChallenge('15 SECONDS LEFT: State your conclusion without fillers!');
          }
        }

        // Auto stop at time limit
        if (next >= timeLimitSecs) {
          stopAndEvaluate();
          return timeLimitSecs;
        }

        return next;
      });
    }, 1000);
  };

  const stopRecording = (): string => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);

    let recordedText = '';
    if (recognizerRef.current) {
      recordedText = recognizerRef.current.stop();
    }
    return recordedText || transcript;
  };

  const stopAndEvaluate = async () => {
    const finalTranscript = stopRecording();
    const cleanTranscript = (finalTranscript || transcript).trim();

    if (!cleanTranscript || cleanTranscript.length < 5) {
      setMicError('No clear speech was captured. Please speak into your microphone or enter text below.');
      return;
    }

    setIsEvaluating(true);
    try {
      const profile = getProfile();
      const res = await fetch('/api/evaluate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: cleanTranscript,
          topic: sessionTopics[currentTopicIndex] || 'Spontaneous Speaking',
          topicType: selectedCategories.join(', '),
          durationSeconds: Math.max(elapsedTime, 5),
          pressureMode,
          recurringIssues: profile.weakTopics,
        }),
      });

      if (!res.ok) {
        throw new Error('Evaluation request failed');
      }

      const evalData: SpeechEvaluation = await res.json();
      setEvaluation(evalData);

      // Record in storage
      const record: SpeakingSessionRecord = {
        id: 'speak_' + Date.now(),
        createdAt: Date.now(),
        topic: sessionTopics[currentTopicIndex],
        topicType: selectedCategories[0] || 'General',
        timeLimitSeconds: timeLimitSecs,
        actualDurationSeconds: elapsedTime,
        transcript: cleanTranscript,
        evaluation: evalData,
        pressureMode,
      };
      recordSpeakingSession(record);
    } catch (err: any) {
      setMicError(err.message || 'Evaluation error');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRetryCurrentTopic = () => {
    setEvaluation(null);
    setTranscript('');
    setElapsedTime(0);
    setPressureChallenge(null);
    setMicError(null);
  };

  const handleNextTopic = () => {
    if (currentTopicIndex + 1 < sessionTopics.length) {
      setCurrentTopicIndex(currentTopicIndex + 1);
      setEvaluation(null);
      setTranscript('');
      setElapsedTime(0);
      setPressureChallenge(null);
      setMicError(null);
    } else {
      setSessionActive(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <Zap className="w-4 h-4" />
          <span>Spontaneous Impromptu Trainer</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          Random Speaking & Pressure Lab
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Train spontaneous thinking, eliminate fillers, control speech tempo (WPM), and speak confidently under time pressure.
        </p>
      </div>

      {!sessionActive ? (
        /* Setup Configuration Screen */
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 space-y-8 shadow-xl">
          {/* Number of Topics */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
              Number of Topics in Session
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 5, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => setTopicCount(num)}
                  id={`btn-topic-count-${num}`}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    topicCount === num
                      ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {num} {num === 1 ? 'Topic' : 'Topics'}
                </button>
              ))}
            </div>
          </div>

          {/* Topic Categories */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
              Topic Domains (Multi-Select)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    id={`btn-category-${cat}`}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-teal-500 text-stone-950 font-bold shadow-sm'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Limit */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
              Time Limit per Topic
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '30 sec', val: 30 },
                { label: '60 sec', val: 60 },
                { label: '90 sec', val: 90 },
                { label: '2 min', val: 120 },
                { label: '3 min', val: 180 },
              ].map((t) => (
                <button
                  key={t.val}
                  onClick={() => setTimeLimitSecs(t.val)}
                  id={`btn-timelimit-${t.val}`}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    timeLimitSecs === t.val
                      ? 'bg-cyan-500 text-stone-950 shadow-md shadow-cyan-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pressure Mode Toggle */}
          <div className="rounded-xl bg-stone-950/60 border border-stone-800 p-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Flame className="w-4 h-4" />
                <span>Pressure Mode</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed max-w-xl">
                Simulates high-stress interview conditions with unexpected mid-speech challenges ("Explain without jargon", "Give a concrete example"), stricter pacing, and heightened scrutiny.
              </p>
            </div>
            <button
              onClick={() => setPressureMode(!pressureMode)}
              id="btn-toggle-pressure-mode"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pressureMode
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
              }`}
            >
              {pressureMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Start Button */}
          <button
            onClick={startNewSession}
            id="btn-start-speaking-session"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-stone-950 font-bold text-base shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
          >
            <span>Start Speaking Session</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        /* Active Speaking Room or Evaluation Result */
        <div className="space-y-6">
          {/* Progress Header */}
          <div className="flex items-center justify-between text-xs text-stone-400 bg-stone-900/60 border border-stone-800 px-4 py-2.5 rounded-xl">
            <span>
              Topic <strong className="text-white">{currentTopicIndex + 1}</strong> of{' '}
              <strong className="text-white">{sessionTopics.length}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-stone-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Target: {timeLimitSecs}s
            </span>
            {pressureMode && (
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-semibold">
                Pressure Mode Active
              </span>
            )}
            <button
              onClick={() => {
                stopRecording();
                setSessionActive(false);
              }}
              className="text-stone-400 hover:text-stone-200 underline"
            >
              Exit
            </button>
          </div>

          {/* The Prompt Card */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 text-center space-y-3 shadow-xl">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Spontaneous Prompt
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white max-w-2xl mx-auto leading-snug">
              "{sessionTopics[currentTopicIndex]}"
            </h2>
          </div>

          {/* Active Speaking & Recording Panel */}
          {!evaluation && (
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 text-center space-y-6 shadow-xl">
              {/* Timer Display */}
              <div className="flex flex-col items-center">
                <div
                  className={`text-4xl sm:text-5xl font-extrabold font-mono tracking-wider ${
                    elapsedTime > timeLimitSecs - 15 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                  }`}
                >
                  {Math.floor(elapsedTime / 60)}:
                  {(elapsedTime % 60).toString().padStart(2, '0')}
                  <span className="text-stone-500 text-2xl font-normal">
                    {' '}/ {Math.floor(timeLimitSecs / 60)}:
                    {(timeLimitSecs % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {isRecording ? 'Listening... speak naturally' : 'Press start when ready'}
                </p>
              </div>

              {/* Audio Waveform / Level Meter */}
              {isRecording && (
                <div className="flex items-center justify-center gap-1.5 h-12 py-2">
                  {[...Array(16)].map((_, i) => {
                    const height = Math.max(6, Math.min(48, Math.round((audioLevel / 100) * 48 * ((i % 3) + 0.5))));
                    return (
                      <div
                        key={i}
                        className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75"
                        style={{ height: `${height}px` }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Pressure Challenge Popup */}
              {pressureChallenge && (
                <div className="rounded-xl bg-amber-950/80 border border-amber-800/80 p-3 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{pressureChallenge}</span>
                </div>
              )}

              {/* Primary Mic Record Action */}
              <div className="flex flex-col items-center gap-4">
                {!isRecording ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      onClick={startRecording}
                      id="btn-speaking-mic-start"
                      className="w-24 h-24 rounded-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 flex flex-col items-center justify-center shadow-xl shadow-emerald-950/60 hover:scale-105 transition-transform"
                    >
                      <Mic className="w-8 h-8" />
                      <span className="text-[11px] font-extrabold uppercase mt-1">Speak</span>
                    </button>
                    {transcript.trim().length >= 5 && (
                      <button
                        onClick={stopAndEvaluate}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-bold transition-colors shadow-md"
                      >
                        Evaluate Text Directly
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={stopAndEvaluate}
                    id="btn-speaking-mic-stop"
                    className="w-24 h-24 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center shadow-xl shadow-rose-950/60 animate-pulse hover:scale-105 transition-transform"
                  >
                    <Square className="w-8 h-8 fill-current" />
                    <span className="text-[11px] font-extrabold uppercase mt-1">Finish</span>
                  </button>
                )}

                {isRecording && (
                  <button
                    onClick={stopAndEvaluate}
                    className="text-xs text-stone-400 hover:text-stone-200 underline"
                  >
                    Done speaking early? Click to evaluate
                  </button>
                )}
              </div>

              {/* Live Streaming Transcript */}
              <div className="text-left space-y-2 pt-4 border-t border-stone-800/80">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>Live Spoken Transcript</span>
                  <span>{transcript.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                {isRecording ? (
                  <div className="min-h-[80px] p-4 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-sm leading-relaxed font-sans">
                    {transcript ? (
                      <span>{transcript}</span>
                    ) : (
                      <span className="text-stone-500 italic">
                        Your speech will appear here in real-time as you speak...
                      </span>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Speak using the microphone above, or type/paste your speech here..."
                    className="w-full min-h-[90px] p-4 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-sm leading-relaxed font-sans focus:outline-none focus:border-emerald-500 resize-y"
                  />
                )}

                {/* Manual Edit Fallback */}
                <div className="text-[11px] text-stone-500">
                  Tip: If your mic is quiet or you are in a quiet room, you can type or edit your response above.
                </div>
              </div>

              {/* Mic error / permission */}
              {micError && (
                <div className="rounded-xl bg-rose-950/60 border border-rose-800/60 p-3 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{micError}</span>
                </div>
              )}

              {/* Evaluating Spinner */}
              {isEvaluating && (
                <div className="rounded-xl bg-stone-950/80 border border-stone-800 p-6 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                  <p className="text-sm font-semibold text-stone-200">
                    Evaluating English, fillers, structure, and communication under pressure...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Comprehensive Evaluation Results View */}
          {evaluation && (
            <div className="space-y-6">
              {/* Overall Scorecard Bar */}
              <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Performance Evaluation
                    </span>
                    <h3 className="text-2xl font-extrabold text-white mt-0.5">
                      Overall Score: {evaluation.overallScore}/100
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      {evaluation.distinctionNote || 'Evaluation complete across English and delivery.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRetryCurrentTopic}
                      id="btn-retry-speaking-topic"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Topic</span>
                    </button>
                    <button
                      onClick={handleNextTopic}
                      id="btn-next-speaking-topic"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold transition-colors shadow-md shadow-emerald-950"
                    >
                      <span>Next Topic</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Metric Badges Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                    <span className="text-[11px] text-stone-400 uppercase">Fluency</span>
                    <p className="text-lg font-bold text-emerald-400">{evaluation.fluency}%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                    <span className="text-[11px] text-stone-400 uppercase">Grammar</span>
                    <p className="text-lg font-bold text-teal-400">{evaluation.grammar}%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                    <span className="text-[11px] text-stone-400 uppercase">Vocabulary</span>
                    <p className="text-lg font-bold text-cyan-400">{evaluation.vocabulary}%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                    <span className="text-[11px] text-stone-400 uppercase">Structure</span>
                    <p className="text-lg font-bold text-indigo-400">{evaluation.structure}%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                    <span className="text-[11px] text-stone-400 uppercase">Confidence</span>
                    <p className="text-lg font-bold text-purple-400">{evaluation.confidence}%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                    <span className="text-[11px] text-stone-400 uppercase">Under Pressure</span>
                    <p className="text-lg font-bold text-amber-400">{evaluation.pressureScore}%</p>
                  </div>
                </div>
              </div>

              {/* Exact Transcript with Highlighted Fillers */}
              <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>Exact Transcript & Filler Analysis</span>
                  </h4>
                  <span className="text-xs bg-amber-950 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded font-mono">
                    {evaluation.fillerWordsCount} filler {evaluation.fillerWordsCount === 1 ? 'word' : 'words'}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-sm leading-relaxed">
                  {transcript}
                </div>
                {evaluation.fillerBreakdown && evaluation.fillerBreakdown.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-stone-400">Detected:</span>
                    {evaluation.fillerBreakdown.map((f, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800 text-amber-300 text-xs font-mono"
                      >
                        "{f.word}": {f.count}x
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 5: Specific English Feedback (Mandatory: What you said -> What's wrong -> Better -> Why) */}
              <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <span>Specific English Corrections</span>
                  </h4>
                  <span className="text-xs text-stone-400">Natural professional English</span>
                </div>

                {evaluation.corrections && evaluation.corrections.length > 0 ? (
                  <div className="space-y-4">
                    {evaluation.corrections.map((corr, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl bg-stone-950/70 border border-stone-800/90 p-4 space-y-3"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                            What you said
                          </span>
                          <p className="text-xs text-rose-200 bg-rose-950/40 p-2 rounded border border-rose-900/40 font-mono">
                            "{corr.whatYouSaid}"
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                            What's wrong
                          </span>
                          <p className="text-xs text-stone-300">{corr.whatsWrong}</p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                            Better version
                          </span>
                          <p className="text-xs text-emerald-200 bg-emerald-950/40 p-2 rounded border border-emerald-900/40 font-medium">
                            "{corr.betterVersion}"
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                            Why it's better
                          </span>
                          <p className="text-xs text-stone-400 italic">{corr.whyItsBetter}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">
                    Great phrasing! No major grammatical disfluencies or repetitive filler patterns identified.
                  </p>
                )}

                {/* Recurring Issues */}
                {evaluation.recurringIssues && evaluation.recurringIssues.length > 0 && (
                  <div className="rounded-xl bg-amber-950/30 border border-amber-800/40 p-3">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Recurring Issue Detected
                    </span>
                    <ul className="list-disc list-inside text-xs text-stone-300 mt-1 space-y-1">
                      {evaluation.recurringIssues.map((iss, i) => (
                        <li key={i}>{iss}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Speed / Pacing Analysis & Pressure Signals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* WPM Pacing */}
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                      Speaking Speed & Cadence
                    </h5>
                    <span className="text-xs font-bold text-emerald-400">{evaluation.wpm} WPM</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-stone-400">
                    <span>Words: <strong className="text-white">{evaluation.wordCount}</strong></span>
                    <span>Duration: <strong className="text-white">{evaluation.durationSeconds}s</strong></span>
                  </div>
                  <p className="text-xs text-stone-300 bg-stone-950 p-3 rounded-lg border border-stone-800 leading-relaxed">
                    {evaluation.pacingFeedback}
                  </p>
                </div>

                {/* Communication Under Pressure */}
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                      Communication Under Pressure
                    </h5>
                    <span className="text-xs font-bold text-amber-400">{evaluation.pressureScore}/100</span>
                  </div>
                  <p className="text-xs text-stone-300 bg-stone-950 p-3 rounded-lg border border-stone-800 leading-relaxed">
                    {evaluation.pressureFeedback}
                  </p>
                  {evaluation.pressureSignals && evaluation.pressureSignals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {evaluation.pressureSignals.map((sig, i) => (
                        <span key={i} className="text-[10px] bg-stone-800 text-stone-300 px-2 py-0.5 rounded">
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Model Improved Summary Answer */}
              {evaluation.improvedSummary && (
                <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Model Spoken Answer (Read & Retain)</span>
                    </h5>
                    <button
                      onClick={() => speakText(evaluation.improvedSummary)}
                      id="btn-speak-improved-summary"
                      className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-emerald-300"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Listen</span>
                    </button>
                  </div>
                  <p className="text-sm text-stone-200 bg-stone-950 p-4 rounded-xl border border-stone-800 leading-relaxed font-sans">
                    "{evaluation.improvedSummary}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
