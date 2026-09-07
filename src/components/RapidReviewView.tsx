import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Mic,
  Square,
  Clock,
  RotateCcw,
  Sparkles,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { VoiceRecognizer, speakText } from '../lib/speech';

const DRILL_TOPICS = [
  'What is an API?',
  'How does caching work?',
  'What is Database Sharding?',
  'What is a Neural Network?',
  'Why do we need HTTPS?',
  'What is Git version control?',
];

export const RapidReviewView: React.FC = () => {
  const [topic, setTopic] = useState<string>(DRILL_TOPICS[0]);
  // Stages: 0: Kid (60s), 1: Manager (60s), 2: Senior Engineer (60s), 3: Review
  const [stage, setStage] = useState<number>(0);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [currentText, setCurrentText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);

  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const recognizerRef = useRef<VoiceRecognizer | null>(null);
  const timerRef = useRef<any>(null);

  const STAGE_CONFIGS = [
    {
      title: 'Target 1: Explain to a 10-Year-Old (Layman Analogy)',
      timeLimit: 60,
      description: 'Zero jargon. Use a relatable everyday story, playground toy, or kitchen recipe analogy.',
    },
    {
      title: 'Target 2: Explain to a Non-Technical Product Manager',
      timeLimit: 60,
      description: 'Focus on business value, efficiency, system boundaries, and user outcomes without deep code syntax.',
    },
    {
      title: 'Target 3: Explain to a Principal Staff Engineer',
      timeLimit: 60,
      description: 'Technical rigor: algorithmic complexity, failure modes, concurrency, latency, and system trade-offs.',
    },
  ];

  useEffect(() => {
    return () => {
      stopRecordingInternal();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startDrillStage = (stageIndex: number) => {
    setStage(stageIndex);
    setSecondsLeft(60);
    setCurrentText('');
    stopRecordingInternal();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = async () => {
    setCurrentText('');
    const rec = new VoiceRecognizer();
    recognizerRef.current = rec;
    rec.onTranscriptUpdate = (txt) => setCurrentText(txt);
    const ok = await rec.start();
    if (ok) setIsRecording(true);
  };

  const stopRecordingInternal = (): string => {
    setIsRecording(false);
    let txt = '';
    if (recognizerRef.current) {
      txt = recognizerRef.current.stop();
    }
    return txt || currentText;
  };

  const advanceStage = async () => {
    const finalTxt = isRecording ? stopRecordingInternal() : currentText;
    const updated = [...answers];
    updated[stage] = finalTxt.trim();
    setAnswers(updated);
    setCurrentText('');

    if (stage < 2) {
      startDrillStage(stage + 1);
    } else {
      // Evaluate all 3 audiences
      if (timerRef.current) clearInterval(timerRef.current);
      setStage(3);
      setIsEvaluating(true);
      try {
        const res = await fetch('/api/evaluate-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: `5-Min Drill on "${topic}" across 3 audiences: 1) Child: "${updated[0]}" 2) Manager: "${updated[1]}" 3) Staff Engineer: "${updated[2]}"`,
            transcript: `Child Pitch: ${updated[0]} | Manager Pitch: ${updated[1]} | Engineer Pitch: ${updated[2]}`,
            topicType: '5-Minute Rapid Review Drill',
            durationSeconds: 180,
            pressureMode: false,
          }),
        });
        const data = await res.json();
        setFeedback(data.improvedSummary || data.pacingFeedback);
      } catch (err) {
        console.error(err);
      } finally {
        setIsEvaluating(false);
      }
    }
  };

  const handleReset = () => {
    setStage(0);
    setAnswers(['', '', '']);
    setCurrentText('');
    setFeedback(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div>
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <Zap className="w-4 h-4" />
          <span>High-Intensity 5-Minute Drill</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          5-Minute Rapid Drill
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Calibrate audience awareness. Explain 1 concept to 3 distinct audiences (10-year-old, non-tech manager, and principal staff engineer) in 60-second sprints.
        </p>
      </div>

      {/* Topic selection bar */}
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3 shadow-xl">
        <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
          Select Rapid Drill Topic:
        </span>
        <div className="flex flex-wrap gap-2">
          {DRILL_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTopic(t);
                handleReset();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                topic === t
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                  : 'bg-stone-950 border border-stone-800 text-stone-300 hover:border-amber-500/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {stage < 3 ? (
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 space-y-6 shadow-xl text-center">
          {/* Progress Indicators */}
          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  stage === idx
                    ? 'bg-amber-950 border-amber-600 text-amber-300'
                    : stage > idx
                    ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                    : 'bg-stone-950 border-stone-800 text-stone-500'
                }`}
              >
                <span>Step {idx + 1}</span>
                {stage > idx && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </div>
            ))}
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              {STAGE_CONFIGS[stage].title}
            </span>
            <h2 className="text-2xl font-bold text-white mt-1">"{topic}"</h2>
            <p className="text-xs text-stone-400 max-w-lg mx-auto mt-2">
              {STAGE_CONFIGS[stage].description}
            </p>
          </div>

          <div className="text-5xl font-extrabold font-mono text-amber-400 py-2">
            0:{secondsLeft.toString().padStart(2, '0')}
          </div>

          {/* Action Mic / Advance */}
          <div className="flex justify-center gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                id="btn-rapid-drill-mic-start"
                className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition-transform hover:scale-105"
              >
                <Mic className="w-4 h-4" />
                <span>Speak 60s Answer</span>
              </button>
            ) : (
              <button
                onClick={stopRecordingInternal}
                id="btn-rapid-drill-mic-stop"
                className="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 animate-pulse"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Recording</span>
              </button>
            )}

            <button
              onClick={advanceStage}
              id="btn-rapid-drill-next"
              className="px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 transition-transform hover:scale-105 shadow-md shadow-amber-950"
            >
              <span>{stage === 2 ? 'Submit All 3 for Review' : 'Next Audience →'}</span>
            </button>
          </div>

          {/* Live Transcript / Manual Input */}
          <div className="text-left space-y-2 pt-4 border-t border-stone-800">
            <span className="text-xs text-stone-400">Your Spoken Answer:</span>
            <textarea
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              placeholder="Speech transcript will stream here, or type directly..."
              className="w-full h-24 p-3 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      ) : (
        /* Results & Review */
        <div className="space-y-6">
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Drill Performance Summary
                </span>
                <h3 className="text-2xl font-bold text-white mt-0.5">3-Tier Audience Synthesis</h3>
              </div>
              <button
                onClick={handleReset}
                id="btn-rapid-drill-restart"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Repeat Drill</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-xs font-bold uppercase text-emerald-400">10-Year-Old Layman Pitch</span>
                <p className="text-xs text-stone-300 italic">"{answers[0] || 'No speech recorded.'}"</p>
              </div>
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-xs font-bold uppercase text-teal-400">Non-Technical Manager Pitch</span>
                <p className="text-xs text-stone-300 italic">"{answers[1] || 'No speech recorded.'}"</p>
              </div>
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-xs font-bold uppercase text-indigo-400">Principal Staff Engineer Depth</span>
                <p className="text-xs text-stone-300 italic">"{answers[2] || 'No speech recorded.'}"</p>
              </div>
            </div>

            {isEvaluating ? (
              <div className="p-6 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                <span className="text-xs text-stone-300">Audience adaptation evaluation in progress...</span>
              </div>
            ) : (
              feedback && (
                <div className="p-5 rounded-xl bg-stone-950 border border-amber-900/50 space-y-2">
                  <span className="text-xs font-bold uppercase text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Communication Coach Synthesis</span>
                  </span>
                  <p className="text-xs text-stone-200 leading-relaxed font-sans">{feedback}</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
