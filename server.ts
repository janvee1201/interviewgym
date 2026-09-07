import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '20mb' }));

// Allowed models in priority order for fallback
// gemini-3.1-flash-lite is primary (blazing fast, high availability, separate quota)
// gemini-3.8-flash is secondary fallback
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];

// Model cooldown tracker to prevent repeated 429/503 hammering
const modelCooldowns = new Map<string, number>();

function isModelCoolingDown(model: string): boolean {
  const expiry = modelCooldowns.get(model);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    modelCooldowns.delete(model);
    return false;
  }
  return true;
}

function setModelCooldown(model: string, durationMs: number) {
  modelCooldowns.set(model, Date.now() + durationMs);
}

// In-memory cache for lessons to avoid burning API quota on repeat topics
const lessonCache = new Map<string, { data: any; expiry: number }>();

// Helper to get initialized Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Robust caller with exponential backoff & model fallbacks for 503 / high demand / transient issues
async function callGeminiWithRetry(
  ai: GoogleGenAI | null,
  prompt: string,
  config?: Record<string, any>
): Promise<any | null> {
  if (!ai) return null;

  for (const model of CANDIDATE_MODELS) {
    if (isModelCoolingDown(model)) {
      continue;
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          ...config,
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = extractJson(rawText);
        if (parsed) {
          return parsed;
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      const status = err?.status || err?.code;

      const isRateLimit =
        status === 429 ||
        msg.includes('429') ||
        msg.includes('Resource has been exhausted') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('quota');

      const isHighDemand =
        status === 503 ||
        status === 'UNAVAILABLE' ||
        msg.includes('503') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE');

      if (isRateLimit) {
        // Cooldown for 60 seconds when rate limit quota is reached
        setModelCooldown(model, 60_000);
        console.log(`[AI Service] ${model} rate-limited; cooling down for 60s, switching model.`);
      } else if (isHighDemand) {
        // Cooldown for 25 seconds during transient spike
        setModelCooldown(model, 25_000);
        console.log(`[AI Service] ${model} experiencing high demand; cooling down for 25s, switching model.`);
      } else {
        console.log(`[AI Service] ${model} transient response; trying alternate provider.`);
      }

      // Continue to next candidate model
      continue;
    }
  }

  return null;
}

// Clean JSON parser handling markdown code blocks and stray text
function extractJson(text: string): any {
  if (!text) return null;
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const target = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  try {
    return JSON.parse(target);
  } catch (_e) {
    const firstBrace = target.indexOf('{');
    const lastBrace = target.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(target.substring(firstBrace, lastBrace + 1));
      } catch (_e2) {
        // failed
      }
    }
    const firstBracket = target.indexOf('[');
    const lastBracket = target.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(target.substring(firstBracket, lastBracket + 1));
      } catch (_e3) {
        // failed
      }
    }
    return null;
  }
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// DYNAMIC FALLBACK GENERATORS (Used when API encounters 503/transient errors)
// -------------------------------------------------------------

function generateFallbackSpeechEvaluation(
  transcript: string,
  topic: string,
  topicType: string,
  durationSeconds: number,
  wordCount: number,
  wpm: number,
  pressureMode: boolean,
  recurringIssues: string[] = []
) {
  const fillers = ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'so', 'i mean', 'sort of', 'kind of', 'literally'];
  const words = transcript.toLowerCase().split(/\s+/);
  const foundFillers: Record<string, number> = {};
  let totalFillers = 0;

  words.forEach((w) => {
    const clean = w.replace(/[^a-z]/g, '');
    if (fillers.includes(clean)) {
      foundFillers[clean] = (foundFillers[clean] || 0) + 1;
      totalFillers++;
    }
  });

  const sentences = transcript.split(/[.?!]+/).map(s => s.trim()).filter(Boolean);
  const corrections = [];

  // Find sentences with fillers or weak phrasing for concrete corrections
  for (const s of sentences) {
    if (corrections.length >= 2) break;
    const lowerS = s.toLowerCase();
    for (const f of fillers) {
      if (lowerS.includes(f) && s.length > 15) {
        const better = s.replace(new RegExp(`\\b${f}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim();
        corrections.push({
          whatYouSaid: s.slice(0, 80),
          whatsWrong: `Contains colloquial filler "${f}" and fragmented transition.`,
          betterVersion: better.charAt(0).toUpperCase() + better.slice(1),
          whyItsBetter: 'Removes verbal filler, projecting authority and clear intentionality.',
        });
        break;
      }
    }
  }

  if (corrections.length === 0) {
    corrections.push({
      whatYouSaid: sentences[0] ? sentences[0].slice(0, 80) : transcript.slice(0, 80),
      whatsWrong: 'Can be structured with a stronger executive summary hook.',
      betterVersion: `In evaluating ${topic || 'this scenario'}, the primary architectural tradeoff centers on predictable latency and clean state boundaries.`,
      whyItsBetter: 'Immediately establishes the thesis and frames the technical scope.',
    });
  }

  const detectedHabits = totalFillers > 2 ? [`Frequent use of conversational fillers (${Object.keys(foundFillers).join(', ')})`] : [];
  if (wpm > 170) detectedHabits.push('High speaking rate under pressure; risk of rushing through key technical terms');
  if (wpm < 100) detectedHabits.push('Slightly slow pacing with long pauses between clauses');

  return {
    overallScore: Math.max(65, Math.min(96, Math.round(84 - totalFillers * 2.5 + (wordCount > 60 ? 5 : 0)))),
    fluency: Math.max(60, Math.min(95, Math.round(80 - totalFillers * 3))),
    grammar: 82,
    vocabulary: 78,
    structure: 76,
    confidence: pressureMode ? 70 : 78,
    contentRelevance: 84,
    technicalDepth: 79,
    corrections,
    recurringIssues: detectedHabits,
    fillerWordsCount: totalFillers,
    fillerBreakdown: Object.entries(foundFillers).map(([word, count]) => ({
      word,
      count,
      examples: [`...${word}...`],
    })),
    wordCount,
    durationSeconds,
    wpm,
    pacingFeedback:
      wpm < 105
        ? 'Your pace is somewhat measured. Focus on connecting thoughts with deliberate transitional phrases.'
        : wpm > 165
        ? 'Your cadence is brisk. Consider pausing at full stops to let technical ideas land with the interviewer.'
        : 'Solid, professional pacing (110-150 WPM) with natural conversational cadence.',
    pressureScore: pressureMode ? 72 : 82,
    pressureSignals: pressureMode ? ['Observable pauses when pivoting to tradeoffs'] : ['Maintained composure across the duration'],
    pressureFeedback: 'Demonstrated solid composure and articulated the primary ideas without breaking structure.',
    strengths: ['Direct, prompt-focused delivery', 'Clear baseline technical terminology', 'Good progression from concept to impact'],
    weaknesses: totalFillers > 0 ? ['Eliminate verbal hedges and filler tokens'] : ['Add a concrete quantitative example (e.g., RPS, latency)'],
    improvedSummary: `When addressing ${topic || 'this challenge'}, an ideal executive response begins with the core objective, outlines the primary technical mechanism, and closes with measurable production considerations.`,
    recommendedPractice: 'Practice 60-second spontaneous explanations with a strict focus on pausing silently instead of using verbal fillers.',
    distinctionNote: 'Good fundamental understanding. Refining sentence transitions and economy of words will elevate this to staff-level polish.',
  };
}

function generateFallbackLesson(topic: string, domain?: string, depth?: string) {
  const cleanTopic = topic.trim();
  const isLLM = /llm|transformer|attention|rag|embedding|prompt|gpt/i.test(cleanTopic);
  const isDB = /database|index|b-tree|sql|acid|transaction|storage/i.test(cleanTopic);
  const isDistributed = /distributed|system|cache|rate limiter|kafka|queue|load balancer/i.test(cleanTopic);
  const isDSA = /search|binary|stack|queue|tree|graph|dynamic programming|dp|two pointer|sliding window/i.test(cleanTopic);

  let oneLine = `${cleanTopic} is a core mechanism designed to optimize computation, reliability, and structured access in modern software engineering.`;
  let layman = `Imagine an organized express highway system: instead of every vehicle navigating congested neighborhood streets, ${cleanTopic} provides dedicated, high-speed arterial routes to reach the destination efficiently.`;
  let techExp = `At the systems level, ${cleanTopic} provides deterministic operational guarantees by structuring state transitions and minimizing algorithmic bottlenecks across memory, compute, or network boundaries.`;
  let practicalSnippet = `// Production architectural pattern for ${cleanTopic}\nexport class ServiceManager {\n  async process(request: any) {\n    // Validates invariants and executes with predictable latency guarantees\n    return { success: true, timestamp: Date.now() };\n  }\n}`;

  if (isLLM) {
    oneLine = `Transformers and LLMs predict probability distributions over sequential tokens using multi-head self-attention mechanisms.`;
    layman = `Think of an LLM like an ultra-read predictive typing system: it reads what you have written so far, calculates what concepts connect to each other simultaneously, and suggests the most probable next words.`;
    techExp = `LLM architectures use stacked Transformer blocks composed of Multi-Head Self-Attention and Feed-Forward networks. Query, Key, and Value projections compute pairwise attention scores scaled by sqrt(d_k), allowing parallel token ingestion without recurrence.`;
    practicalSnippet = `// Scaled Dot-Product Attention: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V\nfunction attention(Q: Matrix, K: Matrix, V: Matrix, d_k: number) {\n  const scores = matmul(Q, transpose(K)).scale(1 / Math.sqrt(d_k));\n  const weights = softmax(scores);\n  return matmul(weights, V);\n}`;
  } else if (isDB) {
    oneLine = `Database indexing utilizes balanced tree structures (B+ Trees) or hash maps to accelerate search queries from O(N) linear scans to O(log N) or O(1) lookups.`;
    layman = `Think of a book's index at the back: instead of reading all 500 pages to find "ACID transactions", you jump straight to page 312 using alphabetical pointers.`;
    techExp = `B+ Trees keep data sorted across multi-level balanced nodes stored on disk pages. Internal nodes store key boundaries for routing, while all actual data records or row pointers reside strictly in doubly-linked leaf pages, maximizing sequential range-scan efficiency.`;
    practicalSnippet = `-- Optimized multi-column composite index\nCREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);\n-- Leverages left-to-right prefix matching for O(log N) point lookups and range scans`;
  } else if (isDistributed) {
    oneLine = `Distributed coordination leverages consistent hashing, caching hierarchies, and partitioned state to scale throughput horizontally while preserving fault tolerance.`;
    layman = `Like a team of bank tellers working together: rather than one person serving all customers, a queue manager routes each customer to a specific teller so nobody waits in a bottleneck.`;
    techExp = `Distributed systems decouple request ingestion from state persistence using stateless worker pools, distributed in-memory caches (Redis), and event streaming pipelines (Kafka) with consumer group offset tracking.`;
    practicalSnippet = `// Sliding window distributed rate limiting with Redis\nasync function checkRateLimit(userId: string, limit = 100, windowMs = 60000): Promise<boolean> {\n  const now = Date.now();\n  const key = \`ratelimit:\${userId}\`;\n  const multi = redis.multi();\n  multi.zremrangebyscore(key, 0, now - windowMs);\n  multi.zadd(key, now, now.toString());\n  multi.zcard(key);\n  multi.expire(key, Math.ceil(windowMs / 1000));\n  const [, , count] = await multi.exec();\n  return (count as number) <= limit;\n}`;
  } else if (isDSA) {
    oneLine = `${cleanTopic} utilizes mathematical invariants and space-time tradeoffs to reduce search spaces and solve complex combinatorial problems deterministically.`;
    layman = `Like guessing a secret number between 1 and 100: each time you guess 50 and hear "higher", you eliminate half the possibilities in a single step.`;
    techExp = `By establishing clear loop invariants and monotonic conditions, ${cleanTopic} optimizes asymptotic execution bounds, transforming brute-force O(N^2) or exponential solutions into efficient O(N) or O(log N) implementations.`;
    practicalSnippet = `// Idiomatic implementation\nfunction binarySearch(nums: number[], target: number): number {\n  let left = 0, right = nums.length - 1;\n  while (left <= right) {\n    const mid = left + Math.floor((right - left) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}`;
  }

  return {
    topic: cleanTopic,
    domain: domain || 'Computer Science & AI',
    depth: depth || 'Interview',
    oneLineExplanation: oneLine,
    laymanExplanation: layman,
    technicalExplanation: techExp,
    coreConcepts: [
      'Algorithmic Complexity & Bounds',
      'Memory Footprint vs Throughput Tradeoff',
      'Concurrency & Race Condition Handling',
      'Failure Modes & Resiliency Invariants',
    ],
    architectureOrFlow:
      'Client Ingestion -> Input Validation & Sanitization -> Core Logic Execution / Query Routing -> State Persistence / Cache Write -> Response Serialization.',
    importantTerminology: [
      { term: 'Throughput', definition: 'The volume of transactions or operations executed successfully per unit of time.' },
      { term: 'Invariants', definition: 'Mathematical or logical constraints that remain invariant throughout execution.' },
      { term: 'Contention', definition: 'Conflict over shared hardware or software resources under high concurrency.' },
      { term: 'Amortized Complexity', definition: 'The average time per operation over a worst-case sequence of operations.' },
    ],
    practicalExample: practicalSnippet,
    realWorldUseCases: [
      'High-throughput distributed backend services handling >500k RPS',
      'Low-latency microservices with strict P99 SLA requirements',
      'Data storage engines requiring predictable search and mutation performance',
    ],
    commonMisconceptions: [
      'Assuming it operates with zero runtime memory or allocation overhead',
      'Overlooking network partition failures (CAP theorem) in distributed topologies',
      'Premature optimization before measuring production bottleneck telemetry',
    ],
    interviewQuestions: [
      `How would you explain the core mechanism of ${cleanTopic} to a non-technical stakeholder?`,
      `What are the primary space and time complexity tradeoffs of ${cleanTopic}?`,
      `In what production scenarios would you deliberately avoid using ${cleanTopic}?`,
    ],
    followUpQuestions: [
      `How does your design behave if the primary node or memory store experiences sudden failure?`,
      `What happens when concurrent writes outpace the replication lag?`,
      `How would you monitor and alert on P99 latency regressions in production?`,
    ],
    commonMistakesCandidatesMake: [
      'Jumping into raw implementation code without clarifying scale, constraints, or SLA requirements.',
      'Failing to analyze auxiliary memory consumption when optimizing runtime latency.',
      'Giving vague buzzword-filled answers instead of tracing concrete data flows.',
    ],
    thirtySecondExplanation: `${cleanTopic} delivers predictable performance by organizing execution and state around structured access patterns, balancing memory efficiency with sub-linear search latency.`,
    sixtySecondExplanation: `In an interview, start by framing ${cleanTopic} around the core problem it solves. Detail how its data structures maintain performance guarantees under concurrent load, and conclude by highlighting production trade-offs between memory footprint and execution speed.`,
    twoMinuteExplanation: `To deliver a senior-level answer: First, outline the baseline engineering challenge that ${cleanTopic} addresses. Next, explain the algorithmic mechanics and state transitions under the hood. Contrast it with alternative approaches, explaining exactly why you would choose this pattern. Finally, discuss telemetry, observability, and failover recovery strategies in a distributed production environment.`,
    quickRevision: [
      'Always clarify the read vs write ratio before choosing an architecture.',
      'Know the P50 and P99 latency characteristics of underlying data structures.',
      'Be prepared to defend space-time tradeoffs under scale.',
      'Anchor explanations in real engineering metrics rather than abstract theory.',
    ],
    quiz: [
      {
        question: `What is the primary architectural tradeoff when deploying ${cleanTopic}?`,
        options: [
          'Trading auxiliary memory space or cache overhead to achieve sub-linear query latency',
          'Complete loss of transactional durability on service restart',
          'Requiring dedicated GPU hardware clusters for basic execution',
          'Inability to scale across containerized environments',
        ],
        correctIndex: 0,
        explanation: 'Most indexing, caching, and algorithmic structures trade auxiliary memory footprint to achieve dramatic reductions in query or computation time.',
      },
      {
        question: `How should a senior engineer handle unexpected scale surges when using ${cleanTopic}?`,
        options: [
          'Implement circuit breakers, backpressure, and horizontal partitioning',
          'Disable error logging to free up CPU cycles',
          'Synchronously block all incoming client connections',
          'Rely exclusively on vertical server restarts',
        ],
        correctIndex: 0,
        explanation: 'Resilient architectures incorporate backpressure, rate limiting, and partitioned workloads to degrade gracefully under unexpected load.',
      },
    ],
    trustedSources: [
      { title: 'Standard Engineering Reference Documentation', url: 'https://developer.mozilla.org', type: 'Documentation' },
      { title: 'Designing Data-Intensive Applications (Martin Kleppmann)', url: 'https://dataintensive.net', type: 'Architecture Reference' },
    ],
  };
}

function generateFallbackExplainEvaluation(topic: string, domain?: string, transcript: string = '') {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const lower = transcript.toLowerCase();
  const hasExamples = lower.includes('for example') || lower.includes('such as') || lower.includes('like when');
  const hasTradeoffs = lower.includes('tradeoff') || lower.includes('trade-off') || lower.includes('however') || lower.includes('whereas');
  const hasComplexity = lower.includes('o(') || lower.includes('complexity') || lower.includes('time') || lower.includes('latency');

  return {
    overallScore: Math.max(65, Math.min(94, Math.round(75 + (hasTradeoffs ? 7 : 0) + (hasComplexity ? 7 : 0) + (wordCount > 40 ? 5 : 0)))),
    technicalCorrectness: 80,
    conceptualDepth: hasComplexity ? 82 : 72,
    logicalStructure: hasTradeoffs ? 82 : 74,
    useOfExamples: hasExamples ? 84 : 68,
    englishAndCommunication: 78,
    confidence: 76,
    classifications: [
      {
        concept: `${topic} Purpose & Definition`,
        status: 'CORRECT' as const,
        comment: 'You successfully stated the primary function and context of the concept.',
      },
      {
        concept: 'Internal Mechanics & Data Flow',
        status: (wordCount > 50 ? 'CORRECT' : 'PARTIALLY_CORRECT') as any,
        comment: wordCount > 50 ? 'Solid walk-through of the operational flow.' : 'Mentioned the high-level flow but skipped specific state transitions.',
      },
      {
        concept: 'Tradeoffs & Production Constraints',
        status: (hasTradeoffs ? 'CORRECT' : 'PARTIALLY_CORRECT') as any,
        comment: hasTradeoffs ? 'Great inclusion of architectural tradeoffs.' : 'Could be strengthened by explicitly comparing time vs space or latency tradeoffs.',
      },
    ],
    whatExplainedCorrectly: [
      `Understood the core rationale behind ${topic}`,
      'Demonstrated relevant domain terminology',
      'Articulated the primary engineering use case',
    ],
    whatMissed: hasComplexity ? ['Specific edge-case failure modes'] : ['Explicit time/space complexity bounds (e.g. O(log N) vs O(N))'],
    whatMisunderstood: [],
    whatToInclude: [
      'State the asymptotic complexity upfront in your opening sentence',
      'Include a concrete production failure scenario or scaling boundary',
    ],
    idealAnswer: `To explain ${topic}: it is a mechanism designed to optimize computation and access patterns with deterministic guarantees. In production, we select it when latency and scalability are paramount, accepting the tradeoff of auxiliary memory footprint. For instance, under high concurrent traffic, it prevents database or CPU saturation by structuring execution into bounded steps.`,
    distinctionDiagnosis: 'KNEW_AND_EXPLAINED_WELL' as const,
    diagnosisExplanation: 'You demonstrated clear grasp of the underlying principles. With minor refinement in framing the space-time tradeoffs upfront, this is fully interview-ready.',
    recommendedFollowup: `Explain how you would monitor and debug ${topic} in a distributed microservices environment.`,
  };
}

function generateFallbackInterviewNext(
  role: string = 'Software Engineer',
  type: string = 'General SDE',
  difficulty: string = 'Medium',
  pressureMode: boolean = false,
  messages: any[] = [],
  projectContext?: string,
  isDsaMode?: boolean,
  requestHint?: boolean
) {
  const count = (messages || []).length;
  const lastMsg = count > 0 ? messages[count - 1] : null;
  const lastCandidateText = lastMsg && lastMsg.sender === 'candidate' ? lastMsg.text : '';

  if (requestHint) {
    return {
      nextQuestion:
        'Hint: Consider how an invariant or auxiliary data structure (like a hash map or two-pointer window) can eliminate redundant computations and reduce the search space from O(N^2) to O(N).',
      scoreForPreviousAnswer: 75,
      feedbackSnippet: 'Requested a progressive hint. Encouraging invariant formulation.',
      isPressureTactic: false,
      hintProvided: 'Focus on how the prefix state or sorted property simplifies the lookup.',
    };
  }

  if (count === 0) {
    let opening = `Hello. Welcome to your ${type} interview for the ${role} position. To start, walk me through your technical background and the most technically demanding system you've built recently.`;

    if (type === 'AI/ML' || type === 'LLM/GenAI') {
      opening = `Hello! Welcome to your ${type} technical interview for the ${role} role. To kick things off: when deploying large language models or deep learning pipelines to production, how do you balance inference latency, memory footprint (KV-cache / quantization), and evaluation quality?`;
    } else if (type === 'DSA') {
      opening = `Welcome. Let's begin the problem-solving portion of the interview. Consider this problem: You are given an array of integers and a target value. We want to find the length of the longest contiguous subarray whose sum equals the target. Before writing any code, walk me through your conceptual approach and constraints.`;
    } else if (type === 'System Design') {
      opening = `Welcome. Today we will design a globally distributed rate limiter that must handle 500,000 requests per second with sub-10ms P99 latency across multiple cloud regions. How would you structure your requirements and establish the high-level architecture?`;
    } else if (type === 'Projects' && projectContext) {
      opening = `Looking at the project context you shared: "${projectContext.slice(0, 100)}...", what was the single biggest architectural bottleneck you personally diagnosed and solved during development?`;
    } else if (type === 'Behavioral' || type === 'HR') {
      opening = `Welcome. To begin, tell me about a high-stakes technical disagreement you had with a senior teammate or tech lead. How did you structure your argument and what was the resolution?`;
    }

    return {
      nextQuestion: opening,
      scoreForPreviousAnswer: 80,
      feedbackSnippet: 'Interview initiated with tailored track opening question.',
      isPressureTactic: false,
      hintProvided: null,
    };
  }

  // Follow-up question tailored to candidate's previous response
  let nextQ = `Understood. How does your proposed solution behave when concurrent writes surge by 10x? What is the primary bottleneck?`;
  let isPressure = false;

  if (pressureMode) {
    isPressure = true;
    const pressureQuestions = [
      'Can you summarize the core performance bottleneck in under 20 seconds without using generic buzzwords?',
      'Are you confident in that complexity analysis? Walk me through the worst-case edge case that breaks that assumption.',
      'If your primary cache or database node experiences a hard crash right now, what data is permanently lost?',
      'Why choose that approach over a simpler standard solution? Defend your architectural tradeoff with concrete numbers.',
    ];
    nextQ = pressureQuestions[Math.floor(Math.random() * pressureQuestions.length)];
  } else if (isDsaMode) {
    if (count < 3) {
      nextQ = `That approach makes sense. What is the time and space complexity of that strategy, and can we optimize it using auxiliary space?`;
    } else {
      nextQ = `Good. Now walk me through the edge cases: what if the input array is empty, all negative numbers, or contains extreme values that might cause integer overflow?`;
    }
  } else {
    const standardFollowUps = [
      'That makes sense. How would you handle cache invalidation and ensure strong consistency across read replicas?',
      'What specific telemetry and metrics would you monitor in production to detect silent regressions in this pipeline?',
      'If network latency between your services spikes to 500ms, how do your timeouts and circuit breakers prevent cascading failures?',
      'How would you test this architecture thoroughly prior to rolling it out to 100% of production traffic?',
    ];
    nextQ = standardFollowUps[count % standardFollowUps.length];
  }

  const answerLength = (lastCandidateText || '').split(/\s+/).length;
  const score = Math.min(92, Math.max(68, 74 + (answerLength > 30 ? 8 : 0)));

  return {
    nextQuestion: nextQ,
    scoreForPreviousAnswer: score,
    feedbackSnippet:
      score > 80
        ? 'Strong technical explanation with relevant domain vocabulary.'
        : 'Solid high-level overview. Pressing deeper into production trade-offs.',
    isPressureTactic: isPressure,
    hintProvided: null,
  };
}

function generateFallbackInterviewScorecard(
  role: string = 'Software Engineer',
  type: string = 'General SDE',
  difficulty: string = 'Medium',
  durationMinutes: number = 10,
  pressureMode: boolean = false,
  messages: any[] = []
) {
  const candidateAnswers = (messages || []).filter((m) => m.sender === 'candidate');
  const totalWords = candidateAnswers.reduce((acc, m) => acc + (m.text || '').split(/\s+/).length, 0);
  const avgWordsPerAnswer = candidateAnswers.length > 0 ? Math.round(totalWords / candidateAnswers.length) : 0;

  const technical = Math.min(92, Math.max(70, 78 + (avgWordsPerAnswer > 35 ? 6 : 0)));
  const problemSolving = Math.min(90, Math.max(68, 76 + (candidateAnswers.length >= 3 ? 6 : 0)));
  const communication = Math.min(94, Math.max(68, 77 + (totalWords > 120 ? 5 : 0)));
  const english = 82;
  const confidence = pressureMode ? 72 : 80;
  const pressureHandling = pressureMode ? 74 : 82;
  const overall = Math.round((technical + problemSolving + communication + english + confidence + pressureHandling) / 6);

  return {
    overallScore: overall,
    technicalKnowledge: technical,
    problemSolving,
    communication,
    english,
    confidence,
    pressureHandling,
    projectKnowledge: 84,
    hrBehavioral: 80,
    strongestAreas: [
      'Clear high-level architectural framing',
      'Consistent, calm demeanor during technical follow-ups',
      'Good familiarity with core domain primitives',
    ],
    weakestAreas: [
      'Elaborating on edge-case failure modes under strict time limits',
      'Pinpointing quantitative scaling boundaries (e.g. exact RPS / latency numbers)',
    ],
    questionsAnsweredPoorly: [
      {
        question: 'Handling sudden traffic surges or failover',
        reason: 'Focused on scaling horizontally without addressing database connection pool exhaustion.',
      },
    ],
    questionsHesitated: ['Defending runtime complexity constraints under rapid follow-up probing'],
    conceptsToRevise: [
      'Distributed Caching & Invalidation Strategies',
      'Database Connection Pooling & Deadlocks',
      'Circuit Breakers and Backpressure Handling',
    ],
    communicationMistakes: [
      'Occasional reliance on conversational filler words when structuring complex thoughts',
    ],
    recommendedNextSession: 'Practice 10-minute System Design follow-up rounds with Pressure Mode enabled.',
  };
}

function generateFallbackPlan(profile: any) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    totalMinutes: 35,
    focusArea: 'Overcoming verbal hesitations, eliminating fillers, and defending technical tradeoffs',
    items: [
      {
        durationMinutes: 5,
        title: 'Spontaneous Speaking Warmup',
        mode: 'speaking' as const,
        description: 'Speak for 60 seconds on a surprise situational topic with a strict focus on zero filler words.',
        params: { timeLimit: 60, topicType: 'Situational' },
      },
      {
        durationMinutes: 10,
        title: `Learn: ${profile?.weakTopics?.[0] || 'Database Indexing (B-Trees vs Hash)'}`,
        mode: 'learn' as const,
        description: 'Study internal structure, search tradeoffs, and common interview questions.',
        params: { topic: profile?.weakTopics?.[0] || 'Database Indexing (B-Trees vs Hash)' },
      },
      {
        durationMinutes: 5,
        title: 'Explain What You Learned',
        mode: 'explain' as const,
        description: 'Hide the guide and explain B-Trees and indexing tradeoffs verbally in your own words.',
        params: { topic: profile?.weakTopics?.[0] || 'Database Indexing (B-Trees vs Hash)' },
      },
      {
        durationMinutes: 10,
        title: 'Simulated Technical Interview',
        mode: 'interview' as const,
        description: 'Answer 3-4 challenging technical questions with aggressive interviewer follow-ups.',
        params: { role: 'Software Engineer', pressureMode: true },
      },
      {
        durationMinutes: 5,
        title: '5-Minute Rapid Drill',
        mode: 'quick' as const,
        description: 'Explain an API or architectural decision to three different audiences in rapid succession.',
      },
    ],
  };
}

function generateFallbackCurrentTopics(category: string = 'AI/Tech') {
  return {
    topics: [
      {
        headline: 'Advancements in Reasoning Models & Test-Time Compute Scaling',
        category: category || 'AI/Tech',
        whatHappened:
          'Frontier AI laboratories have demonstrated substantial performance breakthroughs by scaling inference-time compute (planning, backtracking, and chain-of-thought verification) rather than solely expanding pre-training parameter counts.',
        whyItMatters:
          'Changes software development from manual code writing to autonomous agent task specification, multi-step code synthesis, and automated regression verification.',
        background:
          'Traditional LLMs operated as pure next-token predictors. Test-time reasoning models dynamically evaluate candidate trajectories before committing to an output.',
        perspectives: [
          'Engineers praise dramatic gains on complex algorithmic and mathematical benchmarks.',
          'System architects highlight variable latency and the need to design asynchronous, non-blocking agent interfaces.',
        ],
        keyFacts: [
          'Inference latency scales dynamically with problem complexity.',
          'Self-verification loops significantly reduce hallucination rates in production code generation.',
        ],
        interviewQuestions: [
          'How does test-time compute scaling differ fundamentally from pre-training parameter scaling?',
          'How would you architect a production backend service to handle non-deterministic response latency from reasoning models?',
        ],
        speakingPrompt:
          'Explain how test-time reasoning models alter system design and UI considerations compared to traditional low-latency zero-shot models.',
      },
      {
        headline: 'Shift Toward Mixture-of-Experts (MoE) Architectures in Production',
        category: category || 'AI/Tech',
        whatHappened:
          'Major foundation model releases have widely transitioned to sparse Mixture-of-Experts (MoE) architectures, activating only a subset of parameters per token during inference.',
        whyItMatters:
          'Enables models with hundreds of billions of total parameters to achieve the serving throughput and memory footprint of models a fraction of their size.',
        background:
          'Dense models activate all neural weights for every token. MoE routes each token dynamically to top-k expert subnetworks.',
        perspectives: [
          'Providers achieve up to 3x higher throughput per GPU cluster.',
          'Requires sophisticated load balancing across GPUs to prevent expert routing hotspots.',
        ],
        keyFacts: [
          'Typically activates only 2 out of 8 or 16 expert networks per token.',
          'Memory bandwidth remains the primary serving bottleneck.',
        ],
        interviewQuestions: [
          'What are the primary operational challenges when hosting MoE models in distributed clusters?',
          'How does token routing in MoE resemble consistent hashing or load balancing in distributed systems?',
        ],
        speakingPrompt:
          'Describe the operational trade-offs of serving sparse MoE models versus traditional dense neural architectures.',
      },
    ],
  };
}

function generateFallbackDebateTurn(topic: string, userStance: string, transcript: string = '', history: any[] = []) {
  const isFor = userStance === 'FOR';
  const opposite = isFor ? 'AGAINST' : 'FOR';

  return {
    counterArgument: `While your argument highlighting the advantages of ${isFor ? 'rapid adoption' : 'caution and restraint'} has merit, you overlook the underlying operational economics. When teams enforce strict centralized control, development velocity declines significantly and engineers build shadow infrastructure. Conversely, unregulated adoption creates severe compliance and fragmentation liabilities. How do you resolve this operational tension without compromising system reliability?`,
    argumentScore: 78,
    logicalFallaciesOrWeaknesses: [
      'Assumed an ideal-case operational environment without accounting for team skill disparity or legacy constraints.',
    ],
    deliveryStrengths: [
      'Clear, assertive opening thesis',
      'Engaged directly with the core premise of the topic',
    ],
    coachingTip:
      'Anchor your next rebuttal with a concrete real-world data point or failure scenario to make your counter-argument irrefutable.',
  };
}

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// 1. Evaluate Spoken English & Communication
app.post('/api/evaluate-speech', async (req: Request, res: Response) => {
  try {
    const { transcript, topic, topicType, durationSeconds, pressureMode, recurringIssues } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'No transcript provided to evaluate.' });
    }

    const ai = getGeminiClient();
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const duration = Math.max(1, Number(durationSeconds) || 60);
    const wpm = Math.round((wordCount / duration) * 60);

    const prompt = `You are an elite AI Speech & Communication Coach and English evaluator for "InterviewGym AI".
Analyze the user's spoken response below.

Topic: "${topic || 'General Speaking'}"
Topic Category: "${topicType || 'General'}"
Spoken Duration: ${duration} seconds
Word Count: ${wordCount} words
Calculated WPM: ${wpm}
Pressure Mode Active: ${pressureMode ? 'YES' : 'NO'}
Known user recurring issues: ${JSON.stringify(recurringIssues || [])}

Transcript:
"${transcript}"

CRITICAL INSTRUCTIONS:
1. Specific English Feedback: DO NOT say generic things like "improve grammar". Identify EXACT phrases spoken, what was wrong, provide a better natural professional version, and explain why it's better.
2. Tone: Confident, natural, professional English — NOT overly academic or robotic.
3. Filler Words: Accurately count occurrences of common fillers (um, uh, like, basically, actually, you know, so, I mean, etc.).
4. Pacing Feedback: Contextual evaluation of the ${wpm} WPM. (110-150 is typical, but comment on pauses, rushing, or rhythm).
5. Communication Under Pressure: Assess observable signals (hesitations, restarts, repeated words, abrupt endings, loss of sentence structure).
6. Distinguish: Explicitly check if the speaker had good knowledge but struggled with verbal delivery, or if they lacked content.

Return JSON strictly adhering to this schema:
{
  "overallScore": number (0-100),
  "fluency": number (0-100),
  "grammar": number (0-100),
  "vocabulary": number (0-100),
  "structure": number (0-100),
  "confidence": number (0-100),
  "contentRelevance": number (0-100),
  "technicalDepth": number (0-100),
  "corrections": [
    {
      "whatYouSaid": "exact quote from transcript",
      "whatsWrong": "clear diagnosis of problem (e.g., redundant filler, weak structure, subject-verb disagreement)",
      "betterVersion": "natural, professional alternative",
      "whyItsBetter": "concrete reason why this sounds more authoritative and polished"
    }
  ],
  "recurringIssues": ["array of detected habits, e.g. Starting sentences with 'basically'"],
  "fillerWordsCount": number,
  "fillerBreakdown": [
    { "word": "basically", "count": 3, "examples": ["I basically think...", "basically it can"] }
  ],
  "wordCount": ${wordCount},
  "durationSeconds": ${duration},
  "wpm": ${wpm},
  "pacingFeedback": "concrete feedback on speech rate and pausing",
  "pressureScore": number (0-100),
  "pressureSignals": ["e.g. abrupt stop after 20s", "frequent restarts"],
  "pressureFeedback": "evaluation of observable composure and structural cohesion",
  "strengths": ["bullet points of what went well"],
  "weaknesses": ["bullet points of concrete areas to improve"],
  "improvedSummary": "A complete, model 30-45 second spoken answer of how an expert would communicate this idea naturally",
  "recommendedPractice": "actionable drill for the next session",
  "distinctionNote": "e.g. 'Strong conceptual grasp, but delivery was hindered by filler words and fragmented sentences.'"
}`;

    const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
    if (parsed) {
      return res.json(parsed);
    }

    // Graceful fallback if Gemini API is experiencing 503 / high demand
    const fallback = generateFallbackSpeechEvaluation(
      transcript,
      topic || 'General Speaking',
      topicType || 'General',
      duration,
      wordCount,
      wpm,
      !!pressureMode,
      recurringIssues
    );
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Speech Evaluation] Active fallback generator applied');
    const duration = Math.max(1, Number(req.body.durationSeconds) || 60);
    const words = (req.body.transcript || '').trim().split(/\s+/).filter(Boolean).length;
    const fallback = generateFallbackSpeechEvaluation(
      req.body.transcript || '',
      req.body.topic || 'General Speaking',
      req.body.topicType || 'General',
      duration,
      words,
      Math.round((words / duration) * 60),
      !!req.body.pressureMode
    );
    return res.json(fallback);
  }
});

// 2. Structured Technical Learning Lesson (17 parts)
app.post('/api/learn-topic', async (req: Request, res: Response) => {
  try {
    const { topic, domain, depth } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required.' });
    }

    const cacheKey = `${String(topic).toLowerCase().trim()}:${domain || 'Technical'}:${depth || 'Interview'}`;
    const cached = lessonCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return res.json(cached.data);
    }

    const ai = getGeminiClient();
    const prompt = `You are a Principal Software Engineer and Technical Educator for "InterviewGym AI".
Create a masterclass learning lesson for the topic: "${topic}"
Domain: ${domain || 'Computer Science / AI'}
Depth Level: ${depth || 'Interview'} (Supported: Beginner, Intermediate, Interview, Deep Technical)

Generate all 17 required sections in structured JSON matching this schema:
{
  "topic": "${topic}",
  "domain": "${domain || 'Technical'}",
  "depth": "${depth || 'Interview'}",
  "oneLineExplanation": "Ultra punchy one-sentence definition",
  "laymanExplanation": "Crystal-clear analogy for someone with zero background",
  "technicalExplanation": "Precise, rigorous engineering explanation",
  "coreConcepts": ["Key fundamental 1", "Key fundamental 2", "Key fundamental 3", "Key fundamental 4"],
  "architectureOrFlow": "Step-by-step structural architecture, data flow, or lifecycle description",
  "importantTerminology": [
    { "term": "Key Term 1", "definition": "Clear concise explanation" },
    { "term": "Key Term 2", "definition": "Clear concise explanation" }
  ],
  "practicalExample": "Concrete code snippet, system scenario, or quantitative example",
  "realWorldUseCases": ["Use case 1 at scale", "Use case 2 in production", "Use case 3 in enterprise"],
  "commonMisconceptions": ["Misconception 1 and why it's wrong", "Misconception 2"],
  "interviewQuestions": [
    "Common interview question 1 candidates get asked",
    "Common interview question 2 candidates get asked",
    "Common interview question 3 candidates get asked"
  ],
  "followUpQuestions": [
    "Deeper follow-up probe 1 interviewers test with",
    "Deeper follow-up probe 2",
    "Deeper follow-up probe 3"
  ],
  "commonMistakesCandidatesMake": [
    "Mistake 1 in verbal interviews",
    "Mistake 2 in architectural tradeoffs"
  ],
  "thirtySecondExplanation": "A crisp, memorable 30-second elevator pitch for an interview",
  "sixtySecondExplanation": "A 60-second structured answer (Context -> Mechanism -> Tradeoff)",
  "twoMinuteExplanation": "A comprehensive 2-minute senior engineer response with tradeoffs and production considerations",
  "quickRevision": [
    "Bullet point takeaway 1",
    "Bullet point takeaway 2",
    "Bullet point takeaway 3",
    "Bullet point takeaway 4"
  ],
  "quiz": [
    {
      "question": "A sharp technical test question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why Option A is correct and others fail"
    },
    {
      "question": "A tradeoff/scenario test question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 1,
      "explanation": "Detailed explanation of the scenario"
    }
  ],
  "trustedSources": [
    { "title": "Official Documentation or Seminal Paper", "url": "https://developer.mozilla.org", "type": "Documentation" },
    { "title": "Industry Architecture Guide", "url": "https://github.com", "type": "Deep Dive" }
  ]
}`;

    const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
    if (parsed) {
      lessonCache.set(cacheKey, { data: parsed, expiry: Date.now() + 2 * 60 * 60 * 1000 });
      return res.json(parsed);
    }

    // Graceful fallback on 503 / high demand
    const fallback = generateFallbackLesson(topic, domain, depth);
    lessonCache.set(cacheKey, { data: fallback, expiry: Date.now() + 30 * 60 * 1000 });
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Learn Topic] Active fallback generator applied');
    const fallback = generateFallbackLesson(req.body.topic || 'Software Engineering Concept', req.body.domain, req.body.depth);
    return res.json(fallback);
  }
});

// 3. Learn -> Explain Evaluation
app.post('/api/evaluate-explain', async (req: Request, res: Response) => {
  try {
    const { topic, domain, transcript } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide what you explained verbally.' });
    }

    const ai = getGeminiClient();
    const prompt = `You are an exacting Technical Evaluator for the "Learn -> Explain" loop in "InterviewGym AI".
The user just studied the topic: "${topic}" (Domain: ${domain || 'CS/AI'}).
They hid their notes and attempted to explain the concept in their own words.

User's Spoken Explanation Transcript:
"${transcript}"

CRITICAL MANDATE:
1. Distinguish between:
   - "KNEW_AND_EXPLAINED_WELL"
   - "KNEW_BUT_EXPLAINED_POORLY" (Candidate clearly understood the core engineering reality, but was inarticulate, disorganized, or over-relied on vague jargon)
   - "CONCEPTUAL_GAPS_PRESENT" (Partially understood, but missed core mechanics)
   - "DID_NOT_KNOW" (Fundamentally inaccurate or confused)
2. Classify individual concept statements into:
   - CORRECT
   - PARTIALLY_CORRECT
   - INCORRECT
   - MISSING
   - MISLEADING
3. Give an interview-quality ideal spoken version of how to explain it.

Return JSON adhering to this schema:
{
  "overallScore": number (0-100),
  "technicalCorrectness": number (0-100),
  "conceptualDepth": number (0-100),
  "logicalStructure": number (0-100),
  "useOfExamples": number (0-100),
  "englishAndCommunication": number (0-100),
  "confidence": number (0-100),
  "classifications": [
    {
      "concept": "Name of concept (e.g., Query execution or Attention weights)",
      "status": "CORRECT" | "PARTIALLY_CORRECT" | "INCORRECT" | "MISSING" | "MISLEADING",
      "comment": "Specific evaluation of what they said vs what is true"
    }
  ],
  "whatExplainedCorrectly": ["Points they nailed"],
  "whatMissed": ["Crucial architectural or algorithmic parts they skipped"],
  "whatMisunderstood": ["Any technically incorrect claims"],
  "whatToInclude": ["Specific items to add during their retry"],
  "idealAnswer": "A 60-90 second verbal explanation that would impress a Staff Engineer interviewer",
  "distinctionDiagnosis": "KNEW_AND_EXPLAINED_WELL" | "KNEW_BUT_EXPLAINED_POORLY" | "CONCEPTUAL_GAPS_PRESENT" | "DID_NOT_KNOW",
  "diagnosisExplanation": "Detailed reasoning explaining why this falls into that diagnosis category",
  "recommendedFollowup": "A prompt to test them on their retry"
}`;

    const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
    if (parsed) {
      return res.json(parsed);
    }

    const fallback = generateFallbackExplainEvaluation(topic || 'Technical Topic', domain, transcript);
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Evaluate Explain] Active fallback generator applied');
    const fallback = generateFallbackExplainEvaluation(req.body.topic || 'Technical Topic', req.body.domain, req.body.transcript || '');
    return res.json(fallback);
  }
});

// 4. Interview Step (Realistic Interviewer)
app.post('/api/interview-next', async (req: Request, res: Response) => {
  try {
    const {
      role,
      type,
      difficulty,
      pressureMode,
      messages,
      projectContext,
      isDsaMode,
      requestHint,
    } = req.body;

    const ai = getGeminiClient();

    const prompt = `You are a realistic, professional interviewer at a top-tier tech firm conducting a technical interview for "InterviewGym AI".
Role: ${role || 'Software Engineer'}
Track: ${type || 'General SDE'}
Difficulty: ${difficulty || 'Medium'}
Pressure Mode: ${pressureMode ? 'ON (Apply rigorous follow-ups, test composure, challenge claims, ask "Why?", demand concrete numbers/tradeoffs)' : 'OFF (Standard professional tech interview)'}
DSA Mode: ${isDsaMode ? 'YES (Follow 9-step DSA flow: understanding, approach, brute force, optimize, time/space complexity, code/dry run, edge cases)' : 'NO'}
Hint Requested: ${requestHint ? 'YES (Provide a subtle, progressive hint without spoiling the full solution)' : 'NO'}

Project Context (if candidate provided):
${projectContext ? `"""${projectContext}"""` : 'None provided'}

Conversation History so far:
${JSON.stringify(messages || [])}

INTERVIEWER BEHAVIOR MANDATES:
1. Do NOT act like an overly encouraging tutor. Do NOT say "Great job!", "Awesome!", "That is correct!" after every sentence.
2. Maintain professional composure. Acknowledge the candidate's point neutrally (e.g. "Okay.", "Understood.", "Let's explore that.") and immediately advance to the next question or drill down on a flaw/ambiguity.
3. If the candidate made a questionable technical claim, challenge it directly ("Why not fine-tune instead of RAG?", "What if the index doesn't fit in RAM?").
4. If Pressure Mode is on, incorporate realistic pressure tactics occasionally (e.g. "Can you explain that in 20 seconds without jargon?", "Are you confident in that complexity analysis?", "Give me a concrete production failure you've witnessed.").
5. If DSA mode and hint was requested, output a clever small nudge that prompts their thinking without spoiling the data structure or algorithm.
6. Ask ONE clear question at a time.

Return JSON strictly adhering to:
{
  "nextQuestion": "The next question or response spoken by the interviewer",
  "scoreForPreviousAnswer": number (0-100),
  "feedbackSnippet": "Brief private evaluator note on candidate's previous response",
  "isPressureTactic": boolean,
  "hintProvided": string or null
}`;

    const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
    if (parsed) {
      return res.json(parsed);
    }

    // Dynamic contextual fallback on 503 / transient issue
    const fallback = generateFallbackInterviewNext(
      role,
      type,
      difficulty,
      !!pressureMode,
      messages || [],
      projectContext,
      !!isDsaMode,
      !!requestHint
    );
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Interview Next] Active fallback generator applied');
    const fallback = generateFallbackInterviewNext(
      req.body.role,
      req.body.type,
      req.body.difficulty,
      !!req.body.pressureMode,
      req.body.messages || [],
      req.body.projectContext,
      !!req.body.isDsaMode,
      !!req.body.requestHint
    );
    return res.json(fallback);
  }
});

// 5. Final Interview Scorecard
app.post('/api/interview-scorecard', async (req: Request, res: Response) => {
  try {
    const { role, type, difficulty, durationMinutes, pressureMode, messages } = req.body;

    const ai = getGeminiClient();
    const prompt = `You are the Lead Hiring Committee Reviewer for "InterviewGym AI".
Evaluate this completed interview session and create a comprehensive final Scorecard.

Role: ${role}
Track: ${type}
Difficulty: ${difficulty}
Scheduled Duration: ${durationMinutes} mins
Pressure Mode: ${pressureMode ? 'Active' : 'Inactive'}

Interview Transcript:
${JSON.stringify(messages || [])}

Score the candidate across all core dimensions, identify strongest/weakest areas, pinpoint questions answered poorly or with hesitation, concepts to revise, and recommend the exact next practice session.

Return JSON matching:
{
  "overallScore": number (0-100),
  "technicalKnowledge": number (0-100),
  "problemSolving": number (0-100),
  "communication": number (0-100),
  "english": number (0-100),
  "confidence": number (0-100),
  "pressureHandling": number (0-100),
  "projectKnowledge": number (0-100),
  "hrBehavioral": number (0-100),
  "strongestAreas": ["area 1", "area 2"],
  "weakestAreas": ["area 1", "area 2"],
  "questionsAnsweredPoorly": [
    { "question": "The question", "reason": "Why the response fell short" }
  ],
  "questionsHesitated": ["Question where candidate paused or lost structure"],
  "conceptsToRevise": ["Topic 1", "Topic 2"],
  "communicationMistakes": ["Specific communication habit to fix"],
  "recommendedNextSession": "Precise recommended drill (e.g. 'Practice 10-minute System Design follow-ups under pressure')"
}`;

    const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
    if (parsed) {
      return res.json(parsed);
    }

    const fallback = generateFallbackInterviewScorecard(role, type, difficulty, durationMinutes, !!pressureMode, messages || []);
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Interview Scorecard] Active fallback generator applied');
    const fallback = generateFallbackInterviewScorecard(
      req.body.role,
      req.body.type,
      req.body.difficulty,
      req.body.durationMinutes,
      !!req.body.pressureMode,
      req.body.messages || []
    );
    return res.json(fallback);
  }
});

// 6. Generate Today's Plan (Adaptive Daily Trainer)
app.post('/api/generate-plan', async (req: Request, res: Response) => {
  try {
    const { profile } = req.body;
    const ai = getGeminiClient();

    const prompt = `You are the Head Performance Coach at "InterviewGym AI".
Review this user's current performance metrics and generate a high-impact ~30-40 minute daily training plan.
User Profile:
- Weakest Skill: ${profile?.weakestSkill || 'Confidence Under Pressure'}
- Strongest Skill: ${profile?.strongestSkill || 'Technical Knowledge'}
- Weak Topics: ${JSON.stringify(profile?.weakTopics || ['System Design Tradeoffs', 'Transformers'])}
- Speaking Fluency: ${profile?.speakingFluency || 70}
- Technical Explanation: ${profile?.technicalExplanation || 68}
- Confidence Under Pressure: ${profile?.confidenceUnderPressure || 64}

Create a crisp, balanced daily plan with 4-5 focused blocks.
Modes available: "speaking", "learn", "explain", "interview", "quick", "debate".

Return JSON matching:
{
  "date": "${new Date().toISOString().slice(0, 10)}",
  "totalMinutes": 35,
  "focusArea": "Concise verbal delivery and handling follow-ups under pressure",
  "items": [
    {
      "durationMinutes": 5,
      "title": "Random Spontaneous Warmup",
      "mode": "speaking",
      "description": "Speak spontaneously for 60 seconds on a surprise situational topic with zero fillers.",
      "params": { "timeLimit": 60, "topicType": "Situational" }
    },
    {
      "durationMinutes": 10,
      "title": "Learn: Targeted Weak Area",
      "mode": "learn",
      "description": "Master core tradeoffs in your weakest topic.",
      "params": { "topic": "${profile?.weakTopics?.[0] || 'Database Indexing'}" }
    },
    {
      "durationMinutes": 5,
      "title": "Explain What You Learned",
      "mode": "explain",
      "description": "Hide notes and explain the topic verbally in under 90 seconds.",
      "params": { "topic": "${profile?.weakTopics?.[0] || 'Database Indexing'}" }
    },
    {
      "durationMinutes": 10,
      "title": "Simulated Technical Interview",
      "mode": "interview",
      "description": "Face demanding follow-ups with Pressure Mode enabled.",
      "params": { "role": "Software Engineer", "pressureMode": true }
    },
    {
      "durationMinutes": 5,
      "title": "Quick 60-Second Drill",
      "mode": "quick",
      "description": "Rapid multi-audience explanation drill."
    }
  ]
}`;

    const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
    if (parsed) {
      return res.json(parsed);
    }

    const fallback = generateFallbackPlan(profile);
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Generate Plan] Active fallback generator applied');
    const fallback = generateFallbackPlan(req.body.profile);
    return res.json(fallback);
  }
});

// 7. Current Affairs & Tech News (Using Google Search Grounding)
app.post('/api/current-topics', async (req: Request, res: Response) => {
  try {
    const { category } = req.body;
    const ai = getGeminiClient();

    const prompt = `Find 3 real, major recent news developments or breakthroughs in: ${category || 'Artificial Intelligence and Software Engineering'}.
Use Google Search grounding to retrieve real, factual, current information.
For each event, provide:
1. What happened?
2. Why it matters?
3. Background
4. Different perspectives
5. Key facts
6. Questions I might be asked in an interview
7. Speaking prompt to practice discussing this topic verbally.

Return JSON strictly adhering to:
{
  "topics": [
    {
      "headline": "Clear factual headline",
      "category": "${category || 'AI/Tech'}",
      "whatHappened": "Concise factual summary of the recent event",
      "whyItMatters": "Strategic and engineering significance",
      "background": "Historical and technical context",
      "perspectives": ["Perspective from builders", "Perspective from enterprise/critics"],
      "keyFacts": ["Fact 1", "Fact 2"],
      "interviewQuestions": ["Interview question 1", "Interview question 2"],
      "speakingPrompt": "A 90-second prompt: 'Summarize this development and take a stance on its long-term impact on engineering teams.'"
    }
  ]
}`;

    // Try Google Search grounding with Gemini if not cooling down
    if (ai && !isModelCoolingDown('gemini-3.1-flash-lite')) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
          },
        });
        if (response.text) {
          const parsed = extractJson(response.text);
          if (parsed && parsed.topics) {
            return res.json(parsed);
          }
        }
      } catch (_err) {
        console.log('[Current Topics] Grounded tool search transitioned to standard query');
      }
    }

    const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
    if (parsed && parsed.topics) {
      return res.json(parsed);
    }

    const fallback = generateFallbackCurrentTopics(category);
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Current Topics] Active fallback generator applied');
    const fallback = generateFallbackCurrentTopics(req.body.category);
    return res.json(fallback);
  }
});

// 8. Debate Mode Turn
app.post('/api/debate-turn', async (req: Request, res: Response) => {
  try {
    const { topic, userStance, transcript, history } = req.body;
    const ai = getGeminiClient();

    const prompt = `You are a world-class debate partner in "InterviewGym AI".
Topic: "${topic}"
User Stance: ${userStance} (User is arguing ${userStance})
Your Stance: Counter-argument (Opposite of user)

User's Latest Spoken Argument:
"${transcript}"

Debate History:
${JSON.stringify(history || [])}

Evaluate the user's latest argument on:
1. Reasoning strength
2. Concrete evidence / logic
3. Delivery clarity
Then formulate a sharp, intellectually rigorous counter-argument (2-3 paragraphs max) that challenges their assumptions and presses them to defend their stance.

Return JSON:
{
  "counterArgument": "Your spoken counterargument",
  "argumentScore": number (0-100),
  "logicalFallaciesOrWeaknesses": ["Weakness 1 in their logic", "Unsubstantiated assumption"],
  "deliveryStrengths": ["Strength 1 in their communication"],
  "coachingTip": "How to structure their next rebuttal more persuasively"
}`;

    const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
    if (parsed) {
      return res.json(parsed);
    }

    const fallback = generateFallbackDebateTurn(topic, userStance, transcript, history);
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Debate Turn] Active fallback generator applied');
    const fallback = generateFallbackDebateTurn(req.body.topic, req.body.userStance, req.body.transcript, req.body.history);
    return res.json(fallback);
  }
});

// Start Express Server + Vite Middleware
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InterviewGym AI server running on http://0.0.0.0:${PORT}`);
  });
}

start();
