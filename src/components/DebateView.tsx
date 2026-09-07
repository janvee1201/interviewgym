import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Mic,
  Square,
  Send,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import { VoiceRecognizer, speakText } from '../lib/speech';

const DEBATE_TOPICS = [
  'Microservices are overengineered and counterproductive for 95% of early startups.',
  'Dynamic typing (Python/JavaScript) is obsolete for large-scale enterprise production systems.',
  'AI code generators create fragile software and degrade fundamental engineering problem-solving.',
  'Serverless architectures cost significantly more than containerized clusters at steady-state scale.',
  'Code coverage over 80% is vanity metric engineering and slows down product delivery.',
];

export const DebateView: React.FC = () => {
  const [topic, setTopic] = useState<string>(DEBATE_TOPICS[0]);
  const [stance, setStance] = useState<string>('PRO');
  const [history, setHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  const [debateEvaluation, setDebateEvaluation] = useState<any>(null);

  const recognizerRef = useRef<VoiceRecognizer | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingInternal();
    };
  }, []);

  const startDebate = () => {
    setHistory([
      {
        role: 'model',
        text: `I will be your counter-debater on the statement: "${topic}". You have declared stance: ${stance}. Present your opening argument and defend your premise.`,
      },
    ]);
    setDebateEvaluation(null);
    setInputText('');
  };

  const startRecording = async () => {
    setInputText('');
    const rec = new VoiceRecognizer();
    recognizerRef.current = rec;
    rec.onTranscriptUpdate = (txt) => setInputText(txt);
    const ok = await rec.start();
    if (ok) setIsRecording(true);
  };

  const stopRecordingInternal = (): string => {
    setIsRecording(false);
    let txt = '';
    if (recognizerRef.current) {
      txt = recognizerRef.current.stop();
    }
    return txt || inputText;
  };

  const sendTurn = async () => {
    const finalTxt = isRecording ? stopRecordingInternal() : inputText;
    const clean = finalTxt.trim();
    if (!clean) return;

    const newHistory = [...history, { role: 'user' as const, text: clean }];
    setHistory(newHistory);
    setInputText('');
    setIsWaiting(true);

    try {
      const res = await fetch('/api/debate-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          stance,
          history: newHistory,
        }),
      });
      if (!res.ok) throw new Error('Debate turn failed');
      const data = await res.json();
      setHistory([...newHistory, { role: 'model', text: data.counterArgument }]);
      if (data.evaluation) {
        setDebateEvaluation(data.evaluation);
      }
      speakText(data.counterArgument);
    } catch (err) {
      console.error(err);
    } finally {
      setIsWaiting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
          <Scale className="w-4 h-4" />
          <span>Socratic Counter-Arguer</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          AI Debate & Defense Lab
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Sharpen technical conviction, handle pushback gracefully, eliminate logical fallacies, and defend architectural trade-offs against a relentless devil's advocate.
        </p>
      </div>

      {/* Debate setup */}
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 space-y-5 shadow-xl">
        <div className="space-y-2">
          <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
            Select or Enter Motion:
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-bold uppercase">Your Stance:</span>
            <button
              onClick={() => setStance('PRO (Agree)')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                stance.startsWith('PRO')
                  ? 'bg-emerald-500 text-stone-950 shadow-sm'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              PRO (Agree)
            </button>
            <button
              onClick={() => setStance('CON (Disagree)')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                stance.startsWith('CON')
                  ? 'bg-rose-500 text-stone-950 shadow-sm'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              CON (Disagree)
            </button>
          </div>

          <button
            onClick={startDebate}
            id="btn-start-debate"
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-md shadow-rose-950"
          >
            Start Debate
          </button>
        </div>

        {/* Presets */}
        <div className="space-y-1.5 pt-2 border-t border-stone-800">
          <span className="text-[11px] text-stone-500 uppercase">Suggested Hot Topics:</span>
          <div className="flex flex-wrap gap-2">
            {DEBATE_TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 hover:border-rose-500/60 text-stone-300 text-xs text-left"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Debate conversation stream */}
      {history.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-4 shadow-xl min-h-[350px] max-h-[480px] overflow-y-auto">
            {history.map((h, i) => {
              const isAi = h.role === 'model';
              return (
                <div
                  key={i}
                  className={`flex gap-3 ${isAi ? 'items-start' : 'items-start flex-row-reverse'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isAi
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                  >
                    {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div
                    className={`rounded-2xl p-4 max-w-xl text-xs sm:text-sm leading-relaxed ${
                      isAi
                        ? 'bg-stone-950 border border-stone-800 text-stone-100'
                        : 'bg-emerald-950/60 border border-emerald-800 text-emerald-100'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-stone-400">
                      {isAi ? "Devil's Advocate (Counter-Arguer)" : 'You'}
                    </span>
                    <p className="whitespace-pre-line">{h.text}</p>
                  </div>
                </div>
              );
            })}

            {isWaiting && (
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                <span>Formulating rigorous counter-thesis...</span>
              </div>
            )}
          </div>

          {/* Real-time score feedback badge if evaluated */}
          {debateEvaluation && (
            <div className="rounded-xl bg-stone-950 border border-stone-800 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <span className="text-[10px] text-stone-400 uppercase">Persuasiveness</span>
                <p className="text-sm font-bold text-emerald-400">{debateEvaluation.persuasiveness}%</p>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-stone-400 uppercase">Logical Coherence</span>
                <p className="text-sm font-bold text-teal-400">{debateEvaluation.logicalCoherence}%</p>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-stone-400 uppercase">Counter Handling</span>
                <p className="text-sm font-bold text-indigo-400">{debateEvaluation.counterArgumentHandling}%</p>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-stone-400 uppercase">Composure</span>
                <p className="text-sm font-bold text-amber-400">{debateEvaluation.composure}%</p>
              </div>
            </div>
          )}

          {/* User Input Bar */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-3 shadow-xl">
            <div className="flex gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendTurn();
                  }
                }}
                placeholder={isRecording ? 'Listening...' : 'Speak or type your counter-argument...'}
                className="flex-1 min-h-[56px] max-h-28 p-3 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs sm:text-sm focus:outline-none focus:border-rose-500"
              />
              <div className="flex flex-col gap-2">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="p-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecordingInternal}
                    className="p-3 rounded-xl bg-rose-600 text-white animate-pulse"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                )}
                <button
                  onClick={sendTurn}
                  disabled={isWaiting || (!inputText.trim() && !isRecording)}
                  className="p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
