import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Clock,
  Flame,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Send,
  HelpCircle,
  FileText,
  User,
  Bot,
  Layers,
} from 'lucide-react';
import { VoiceRecognizer, speakText, stopSpeaking } from '../lib/speech';
import { InterviewMessage, InterviewScorecard, InterviewSession } from '../types';
import { recordInterviewSession } from '../lib/storage';

const ROLES = [
  'Software Engineer',
  'AI/ML Engineer',
  'GenAI Engineer',
  'Backend Developer',
  'Software Developer',
  'General SDE',
];

const TRACKS = [
  'AI/ML',
  'LLM/GenAI',
  'DSA',
  'System Design',
  'Projects',
  'DBMS',
  'OS',
  'CN',
  'OOP',
  'Java',
  'Python',
  'HR',
  'Behavioral',
  'Mixed (Random)',
];

export interface InterviewViewProps {
  initialTrack?: string;
  initialTopic?: string;
}

export const InterviewView: React.FC<InterviewViewProps> = ({
  initialTrack,
  initialTopic,
}) => {
  // Config
  const [role, setRole] = useState<string>('Software Engineer');
  const [track, setTrack] = useState<string>(initialTrack || 'AI/ML');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [pressureMode, setPressureMode] = useState<boolean>(false);
  const [projectContext, setProjectContext] = useState<string>('');
  const [targetTopicFocus, setTargetTopicFocus] = useState<string>(initialTopic || '');

  useEffect(() => {
    if (initialTrack) setTrack(initialTrack);
    if (initialTopic) setTargetTopicFocus(initialTopic);
  }, [initialTrack, initialTopic]);

  // Session state: 'setup' | 'active' | 'scorecard'
  const [stage, setStage] = useState<'setup' | 'active' | 'scorecard'>('setup');
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(600);
  const [isSpeakingTts, setIsSpeakingTts] = useState<boolean>(true);

  // Candidate input
  const [inputText, setInputText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isWaitingInterviewer, setIsWaitingInterviewer] = useState<boolean>(false);
  const [hintMessage, setHintMessage] = useState<string | null>(null);

  // Scorecard
  const [scorecard, setScorecard] = useState<InterviewScorecard | null>(null);
  const [activeRetryQuestion, setActiveRetryQuestion] = useState<{ question: string; index: number } | null>(null);

  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      stopRecordingInternal();
      stopSpeaking();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const startInterview = async () => {
    setMessages([]);
    setScorecard(null);
    setRemainingSeconds(durationMinutes * 60);
    setStage('active');
    setIsWaitingInterviewer(true);
    setHintMessage(null);

    // Initial interviewer opening question
    try {
      const res = await fetch('/api/interview-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          type: track,
          difficulty,
          pressureMode,
          messages: [],
          projectContext: track === 'Projects'
            ? projectContext
            : (targetTopicFocus ? `Target Topic: ${targetTopicFocus}. Test the candidate on this specific topic.` : undefined),
          isDsaMode: track === 'DSA',
        }),
      });

      if (!res.ok) throw new Error('Failed to start interview');
      const data = await res.json();

      const firstMsg: InterviewMessage = {
        id: 'msg_' + Date.now(),
        sender: 'interviewer',
        text: data.nextQuestion,
        timestamp: Date.now(),
        isPressureTactic: data.isPressureTactic,
      };

      setMessages([firstMsg]);

      if (isSpeakingTts) {
        speakText(data.nextQuestion);
      }
    } catch (err) {
      console.error(err);
      // Fallback greeting
      const fallback = `Hello. Let's begin the ${track} interview for the ${role} position. To start, walk me through your technical background and what high-scale systems you've built recently.`;
      setMessages([
        {
          id: 'msg_init',
          sender: 'interviewer',
          text: fallback,
          timestamp: Date.now(),
        },
      ]);
      if (isSpeakingTts) speakText(fallback);
    } finally {
      setIsWaitingInterviewer(false);
    }

    // Start timer
    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          finishInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = async () => {
    setInputText('');
    const recognizer = new VoiceRecognizer();
    recognizerRef.current = recognizer;

    recognizer.onTranscriptUpdate = (text) => {
      setInputText(text);
    };

    recognizer.onLevelUpdate = (lvl) => {
      setAudioLevel(lvl);
    };

    const ok = await recognizer.start();
    if (!ok) return;
    setIsRecording(true);
  };

  const stopRecordingInternal = (): string => {
    setIsRecording(false);
    setAudioLevel(0);
    let captured = '';
    if (recognizerRef.current) {
      captured = recognizerRef.current.stop();
    }
    return captured || inputText;
  };

  const submitCandidateAnswer = async () => {
    const captured = isRecording ? stopRecordingInternal() : inputText;
    const answer = captured.trim();
    if (!answer) return;

    const candidateMsg: InterviewMessage = {
      id: 'msg_cand_' + Date.now(),
      sender: 'candidate',
      text: answer,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, candidateMsg];
    setMessages(updatedMessages);
    setInputText('');
    setHintMessage(null);
    setIsWaitingInterviewer(true);

    try {
      const res = await fetch('/api/interview-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          type: track,
          difficulty,
          pressureMode,
          messages: updatedMessages,
          projectContext: track === 'Projects' ? projectContext : undefined,
          isDsaMode: track === 'DSA',
        }),
      });

      if (!res.ok) throw new Error('Interviewer response error');
      const data = await res.json();

      const nextInterviewerMsg: InterviewMessage = {
        id: 'msg_int_' + Date.now(),
        sender: 'interviewer',
        text: data.nextQuestion,
        timestamp: Date.now(),
        score: data.scoreForPreviousAnswer,
        feedbackSnippet: data.feedbackSnippet,
        isPressureTactic: data.isPressureTactic,
      };

      setMessages([...updatedMessages, nextInterviewerMsg]);

      if (isSpeakingTts) {
        speakText(data.nextQuestion);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsWaitingInterviewer(false);
    }
  };

  const requestDsaHint = async () => {
    setIsWaitingInterviewer(true);
    try {
      const res = await fetch('/api/interview-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          type: track,
          difficulty,
          pressureMode,
          messages,
          isDsaMode: true,
          requestHint: true,
        }),
      });
      const data = await res.json();
      if (data.hintProvided) {
        setHintMessage(data.hintProvided);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsWaitingInterviewer(false);
    }
  };

  const finishInterview = async () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    stopRecordingInternal();
    stopSpeaking();
    setIsWaitingInterviewer(true);

    try {
      const res = await fetch('/api/interview-scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          type: track,
          difficulty,
          durationMinutes,
          pressureMode,
          messages,
        }),
      });

      if (!res.ok) throw new Error('Scorecard generation failed');
      const card: InterviewScorecard = await res.json();
      setScorecard(card);
      setStage('scorecard');

      // Save completed session to storage
      const sessionObj: InterviewSession = {
        id: 'session_' + Date.now(),
        createdAt: Date.now(),
        role,
        type: track,
        difficulty,
        durationMinutes,
        pressureMode,
        messages,
        scorecard: card,
        projectContext: track === 'Projects' ? projectContext : undefined,
      };
      recordInterviewSession(sessionObj);
    } catch (err) {
      console.error(err);
      setStage('scorecard');
    } finally {
      setIsWaitingInterviewer(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
          <Briefcase className="w-4 h-4" />
          <span>Realistic Mock Environment</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          Interview Simulator & Scorecard
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Simulates authentic, demanding interviewers across DSA, System Design, AI/ML, Projects, and Behavioral rounds with strict follow-ups and comprehensive hiring committee scorecards.
        </p>
      </div>

      {/* SETUP STAGE */}
      {stage === 'setup' && (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 space-y-8 shadow-xl">
          {/* Target Role */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
              Target Engineering Role
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    role === r
                      ? 'bg-indigo-500 text-stone-950 font-bold shadow-md shadow-indigo-950'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Interview Track */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                Interview Track / Round Type
              </label>
              {targetTopicFocus && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-teal-950/80 border border-teal-700/60 text-teal-300 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  Topic: {targetTopicFocus}
                  <button
                    onClick={() => setTargetTopicFocus('')}
                    className="ml-1 text-teal-400 hover:text-teal-100 font-bold"
                    title="Clear topic focus"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTrack(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    track === t
                      ? 'bg-emerald-500 text-stone-950 font-bold shadow-sm'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Project Details Box (If Projects track is selected) */}
          {track === 'Projects' && (
            <div className="space-y-2 rounded-xl bg-stone-950 p-4 border border-stone-800">
              <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Paste Your Project Details & Tech Stack
              </label>
              <textarea
                value={projectContext}
                onChange={(e) => setProjectContext(e.target.value)}
                placeholder="Paste your architecture, tech stack, biggest bottlenecks, and what YOU personally built (e.g. Distributed caching layer in Redis with write-through consistency)..."
                className="w-full h-24 p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-stone-500">
                The interviewer will interrogate your architectural decisions, trade-offs, and debugging methods.
              </p>
            </div>
          )}

          {/* Difficulty & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                Difficulty Level
              </label>
              <div className="flex gap-2">
                {(['Easy', 'Medium', 'Hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                      difficulty === diff
                        ? 'bg-purple-500 text-stone-950 font-bold shadow-sm'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                Interview Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 20, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setDurationMinutes(mins)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      durationMinutes === mins
                        ? 'bg-cyan-500 text-stone-950 font-bold shadow-sm'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pressure Mode Toggle */}
          <div className="rounded-xl bg-stone-950/60 border border-stone-800 p-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Flame className="w-4 h-4" />
                <span>Interviewer Pressure Mode</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed max-w-xl">
                The interviewer will challenge your claims ("Are you sure?", "Explain without jargon", "You have 20 seconds"), test resilience, and demand concrete production metrics.
              </p>
            </div>
            <button
              onClick={() => setPressureMode(!pressureMode)}
              id="btn-interview-pressure-toggle"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                pressureMode
                  ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-950'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
              }`}
            >
              {pressureMode ? 'ACTIVE' : 'INACTIVE'}
            </button>
          </div>

          {/* Start Interview Action */}
          <button
            onClick={startInterview}
            id="btn-start-interview-session"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-950 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
          >
            <span>Enter Mock Interview Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ACTIVE INTERVIEW STAGE */}
      {stage === 'active' && (
        <div className="space-y-4">
          {/* Top In-Call Bar */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 px-5 py-3 flex items-center justify-between gap-4 shadow-md text-xs">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-stone-300 font-bold">
                {role} • {track}
              </span>
              <span className="hidden sm:inline text-stone-500">|</span>
              <span className="hidden sm:inline text-stone-400 font-mono">
                {difficulty} Difficulty
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Timer */}
              <div className="flex items-center gap-1.5 font-mono font-bold text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {Math.floor(remainingSeconds / 60)}:
                  {(remainingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* TTS Toggle */}
              <button
                onClick={() => {
                  if (isSpeakingTts) stopSpeaking();
                  setIsSpeakingTts(!isSpeakingTts);
                }}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  isSpeakingTts
                    ? 'bg-stone-800 border-stone-700 text-stone-200'
                    : 'bg-stone-950 border-stone-800 text-stone-500'
                }`}
                title="Toggle Voice Readout"
              >
                {isSpeakingTts ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Conclude Button */}
              <button
                onClick={finishInterview}
                id="btn-conclude-interview"
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
              >
                End & Review Scorecard
              </button>
            </div>
          </div>

          {/* Conversation Stream Room */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-4 shadow-xl min-h-[380px] max-h-[500px] overflow-y-auto">
            {messages.map((m) => {
              const isInt = m.sender === 'interviewer';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isInt ? 'items-start' : 'items-start flex-row-reverse'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isInt ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {isInt ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  <div
                    className={`rounded-2xl p-4 max-w-xl text-xs sm:text-sm leading-relaxed ${
                      isInt
                        ? 'bg-stone-950 border border-stone-800 text-stone-100'
                        : 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1 text-[10px] text-stone-400">
                      <span className="font-semibold uppercase tracking-wider">
                        {isInt ? 'Interviewer' : 'You (Candidate)'}
                      </span>
                      {m.isPressureTactic && (
                        <span className="text-amber-400 font-bold uppercase">
                          Pressure Drill
                        </span>
                      )}
                    </div>
                    <p className="font-sans whitespace-pre-line">{m.text}</p>
                  </div>
                </div>
              );
            })}

            {isWaitingInterviewer && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  <span>Interviewer is analyzing your response...</span>
                </div>
              </div>
            )}
          </div>

          {/* DSA Hint Box (If active) */}
          {hintMessage && (
            <div className="rounded-xl bg-amber-950/60 border border-amber-800/60 p-4 text-xs text-amber-200 flex items-start gap-3">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 uppercase tracking-wider block mb-0.5">
                  Interviewer Progressive Clue
                </strong>
                <span>{hintMessage}</span>
              </div>
            </div>
          )}

          {/* Candidate Response Console (Speech + Text) */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span className="font-semibold uppercase tracking-wider">
                Your Answer
              </span>
              {track === 'DSA' && (
                <button
                  onClick={requestDsaHint}
                  disabled={isWaitingInterviewer}
                  className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Request Small Hint</span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitCandidateAnswer();
                  }
                }}
                placeholder={isRecording ? 'Listening to your microphone...' : 'Speak with the mic or type your response...'}
                className="flex-1 min-h-[64px] max-h-32 p-3 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 placeholder-stone-500 text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
              />

              <div className="flex flex-col gap-2">
                {/* Speech Mic Toggle */}
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    id="btn-interview-mic-start"
                    className="p-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
                    title="Speak answer via microphone"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecordingInternal}
                    id="btn-interview-mic-stop"
                    className="p-3 rounded-xl bg-rose-600 text-white animate-pulse"
                    title="Stop speaking"
                  >
                    <Square className="w-5 h-5 fill-current" />
                  </button>
                )}

                {/* Send Button */}
                <button
                  onClick={submitCandidateAnswer}
                  disabled={isWaitingInterviewer || (!inputText.trim() && !isRecording)}
                  id="btn-interview-send-answer"
                  className="p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold transition-colors disabled:opacity-40"
                  title="Submit answer to interviewer"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCORECARD & REPLAY STAGE */}
      {stage === 'scorecard' && scorecard && (
        <div className="space-y-6">
          {/* Main Scorecard Header */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Hiring Committee Review
                </span>
                <h2 className="text-3xl font-extrabold text-white mt-1">
                  Overall Score: {scorecard.overallScore}/100
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  Role: <strong className="text-white">{role}</strong> • Track: <strong className="text-white">{track}</strong>
                </p>
              </div>

              <button
                onClick={() => setStage('setup')}
                id="btn-new-interview-session"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-md shadow-emerald-950 transition-colors"
              >
                Start New Interview
              </button>
            </div>

            {/* 8-Axis Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Technical Knowledge</span>
                <p className="text-lg font-bold text-purple-400">{scorecard.technicalKnowledge}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Problem Solving</span>
                <p className="text-lg font-bold text-teal-400">{scorecard.problemSolving}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Communication</span>
                <p className="text-lg font-bold text-emerald-400">{scorecard.communication}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Spoken English</span>
                <p className="text-lg font-bold text-cyan-400">{scorecard.english}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Confidence</span>
                <p className="text-lg font-bold text-indigo-400">{scorecard.confidence}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Under Pressure</span>
                <p className="text-lg font-bold text-amber-400">{scorecard.pressureHandling}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">Project Depth</span>
                <p className="text-lg font-bold text-fuchsia-400">{scorecard.projectKnowledge}%</p>
              </div>
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <span className="text-[11px] text-stone-400 uppercase">HR / Behavioral</span>
                <p className="text-lg font-bold text-rose-400">{scorecard.hrBehavioral}%</p>
              </div>
            </div>
          </div>

          {/* Strongest vs Weakest Areas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Strongest Competencies
              </span>
              <ul className="space-y-1 text-xs text-stone-300">
                {scorecard.strongestAreas.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Weakest Areas / Red Flags
              </span>
              <ul className="space-y-1 text-xs text-stone-300">
                {scorecard.weakestAreas.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Questions Answered Poorly & Hesitation Points */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4">
            <h4 className="text-sm font-bold text-white">Questions Answered Poorly & Key Stumbles</h4>
            <div className="space-y-3">
              {scorecard.questionsAnsweredPoorly.map((q, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-stone-950 border border-stone-800/80 space-y-1">
                  <span className="text-xs font-semibold text-rose-300 block">
                    "{q.question}"
                  </span>
                  <p className="text-xs text-stone-400">{q.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations and Next Session */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Recommended Next Practice Session
            </span>
            <p className="text-sm text-stone-200 bg-stone-950 p-4 rounded-xl border border-stone-800 leading-relaxed font-sans">
              {scorecard.recommendedNextSession}
            </p>
          </div>

          {/* Question-by-Question Replay & "Retry This Question" */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">Full Interview Replay & Question Retry</h4>
              <span className="text-xs text-stone-400">
                {messages.filter((m) => m.sender === 'interviewer').length} Questions Asked
              </span>
            </div>

            <div className="space-y-4">
              {messages.map((m, idx) => {
                if (m.sender !== 'interviewer') return null;
                const nextCandidateAnswer = messages[idx + 1]?.sender === 'candidate' ? messages[idx + 1].text : null;

                return (
                  <div key={m.id} className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-xs font-bold text-indigo-300 leading-relaxed">
                        Q: "{m.text}"
                      </p>
                      <button
                        onClick={() => {
                          setInputText('');
                          setActiveRetryQuestion({ question: m.text, index: idx });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry this question</span>
                      </button>
                    </div>

                    {nextCandidateAnswer && (
                      <div className="space-y-1 pt-1 border-t border-stone-800/60">
                        <span className="text-[10px] uppercase font-bold text-stone-500">
                          Your Spoken Response
                        </span>
                        <p className="text-xs text-stone-300 italic bg-stone-900/60 p-2.5 rounded border border-stone-800/80">
                          "{nextCandidateAnswer}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
