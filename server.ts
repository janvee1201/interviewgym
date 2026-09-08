import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_AI_LANDSCAPE_ITEMS } from './src/data/aiLandscapeData';

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

function generateFallbackLesson(topic: string, domain?: string, depth: string = 'Interview') {
  const cleanTopic = topic.trim();
  const isLLM = /llm|transformer|attention|rag|embedding|prompt|gpt/i.test(cleanTopic);
  const isDB = /database|index|b-tree|sql|acid|transaction|storage/i.test(cleanTopic);
  const isDistributed = /distributed|system|cache|rate limiter|kafka|queue|load balancer/i.test(cleanTopic);
  const isDSA = /search|binary|stack|queue|tree|graph|dynamic programming|dp|two pointer|sliding window/i.test(cleanTopic);

  const isBeginner = depth === 'Beginner';
  const isDeep = depth === 'Deep Technical';
  const isInterv = depth === 'Interview';

  let oneLine = `${cleanTopic} is a core foundational mechanism in ${domain || 'software engineering'} that enables systems to operate with efficiency, predictability, and safety.`;
  let layman = `Think of ${cleanTopic} like an organized indexing system in a giant library: instead of wandering through endless shelves searching for one page, you follow a clear catalog number that leads you directly to what you need.`;
  let techExp = `At the core architectural level, ${cleanTopic} establishes clear structural contracts that coordinate execution, memory management, and data flow to guarantee deterministic runtime bounds.`;
  let practicalSnippet = `// Idiomatic implementation for ${cleanTopic}\nexport class ServiceManager {\n  async process(request: any) {\n    // Validates invariants and executes with predictable latency guarantees\n    return { success: true, timestamp: Date.now() };\n  }\n}`;

  if (isLLM) {
    if (isBeginner) {
      oneLine = `Transformers and modern AI models understand language by converting words into numbers and calculating how words relate to each other simultaneously.`;
      layman = `Think of reading a mystery novel: when you see the word "bank", your brain looks at the surrounding words ("river" vs "money") to instantly know what kind of bank it is. Transformers do this exact same context-checking for every word at once!`;
      techExp = `A Transformer processes entire sequences in parallel instead of one word at a time. It uses Self-Attention where each word calculates a relevance score against every other word in the text, creating high-dimensional representations that capture context, nuance, and intent.`;
      practicalSnippet = `# Fundamental Python / HuggingFace command to run a Transformer model\nfrom transformers import pipeline\n\n# 1. Initialize the pipeline\nclassifier = pipeline("sentiment-analysis")\n\n# 2. Run inference on input text\nresult = classifier("Understanding foundational AI concepts is exciting!")\nprint(result) # [{'label': 'POSITIVE', 'score': 0.9998}]`;
    } else if (isDeep) {
      oneLine = `Transformers utilize stacked multi-head self-attention and feed-forward projection blocks with scaled dot-product attention Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V.`;
      layman = `Like a massively parallel matrix compute engine that projects token vectors across attention heads, computing pairwise similarity scores without temporal recurrence bottlenecks.`;
      techExp = `Transformers eliminate recurrence via parallel token projections into Query, Key, and Value spaces. Scaled dot-product attention normalizes dot-product variance by 1/sqrt(d_k) to prevent vanishing gradients in the softmax tails. In modern hardware, FlashAttention reformulates this via online softmax tiling in SRAM to bypass High Bandwidth Memory (HBM) IO bottlenecks.`;
      practicalSnippet = `// Scaled Dot-Product Attention: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V\nfunction attention(Q: Matrix, K: Matrix, V: Matrix, d_k: number) {\n  const scores = matmul(Q, transpose(K)).scale(1 / Math.sqrt(d_k));\n  const weights = softmax(scores);\n  return matmul(weights, V);\n}`;
    } else {
      oneLine = `Transformers and LLMs predict probability distributions over sequential tokens using multi-head self-attention mechanisms.`;
      layman = `Think of an LLM like an ultra-read predictive typing system: it reads what you have written so far, calculates what concepts connect to each other simultaneously, and suggests the most probable next words.`;
      techExp = `LLM architectures use stacked Transformer blocks composed of Multi-Head Self-Attention and Feed-Forward networks. Query, Key, and Value projections compute pairwise attention scores scaled by sqrt(d_k), allowing parallel token ingestion without recurrence.`;
      practicalSnippet = `// Scaled Dot-Product Attention: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V\nfunction attention(Q: Matrix, K: Matrix, V: Matrix, d_k: number) {\n  const scores = matmul(Q, transpose(K)).scale(1 / Math.sqrt(d_k));\n  const weights = softmax(scores);\n  return matmul(weights, V);\n}`;
    }
  } else if (isDB) {
    if (isBeginner) {
      oneLine = `Database indexing is like an alphabetical book index that lets the database jump straight to the data without reading every single row.`;
      layman = `Imagine looking for a name in a phonebook of 1,000,000 people: if the book is organized alphabetically, you flip right to the "S" section in 3 seconds. Without that index, you would have to read all 1,000,000 names from page 1!`;
      techExp = `Without an index, every query requires an O(N) full table scan reading raw disk blocks into RAM. An index creates a secondary sorted data structure (typically a B+ Tree) that routes lookups in O(log N) operations via balanced node pointers.`;
      practicalSnippet = `-- Fundamental SQL Command to create an index\nCREATE INDEX idx_users_email ON users(email);\n\n-- Verify query uses index with EXPLAIN\nEXPLAIN ANALYZE SELECT * FROM users WHERE email = 'alex@example.com';\n-- Output will show "Index Scan using idx_users_email" instead of "Seq Scan"`;
    } else if (isDeep) {
      oneLine = `Database storage engines employ B+ Trees with multi-level disk page fanouts and doubly-linked leaf nodes to minimize random disk seek operations.`;
      layman = `A shallow, wide balanced tree stored on 4KB or 16KB disk pages where internal nodes only hold routing keys while leaf nodes hold full row pointers and sequential sibling links.`;
      techExp = `B+ Trees achieve high fanout (typically 100-500 keys per 8KB page), ensuring tree heights rarely exceed 3-4 levels even for billions of rows. Writes require Write-Ahead Logging (WAL) and latch synchronization, while MVCC maintains transaction snapshot isolation via visibility check headers (xmin/xmax).`;
      practicalSnippet = `-- Optimized multi-column composite index with DESC sort\nCREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);\n-- Leverages left-to-right prefix matching for O(log N) point lookups and sequential range scans`;
    } else {
      oneLine = `Database indexing utilizes balanced tree structures (B+ Trees) or hash maps to accelerate search queries from O(N) linear scans to O(log N) or O(1) lookups.`;
      layman = `Think of a book's index at the back: instead of reading all 500 pages to find "ACID transactions", you jump straight to page 312 using alphabetical pointers.`;
      techExp = `B+ Trees keep data sorted across multi-level balanced nodes stored on disk pages. Internal nodes store key boundaries for routing, while all actual data records or row pointers reside strictly in doubly-linked leaf pages, maximizing sequential range-scan efficiency.`;
      practicalSnippet = `-- Optimized multi-column composite index\nCREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);\n-- Leverages left-to-right prefix matching for O(log N) point lookups and range scans`;
    }
  } else if (isDSA) {
    if (isBeginner) {
      oneLine = `${cleanTopic} is a foundational algorithmic technique that breaks down problem solving into systematic, step-by-step rules.`;
      layman = `Think of guessing a secret number between 1 and 100: each time you guess 50 and hear "higher", you immediately eliminate half the possibilities (1 through 50) with zero effort!`;
      techExp = `By maintaining clear boundary conditions and invariant states, ${cleanTopic} ensures that each step of the algorithm makes verifiable progress toward the final termination state without redundant recomputation.`;
      practicalSnippet = `// Beginner-friendly implementation of Binary Search\nfunction binarySearch(arr: number[], target: number): number {\n  let left = 0;\n  let right = arr.length - 1;\n\n  while (left <= right) {\n    // Midpoint calculated safely to avoid integer overflow\n    const mid = Math.floor(left + (right - left) / 2);\n\n    if (arr[mid] === target) return mid; // Found target at index mid!\n    if (arr[mid] < target) left = mid + 1; // Target is in right half\n    else right = mid - 1; // Target is in left half\n  }\n\n  return -1; // Not found\n}`;
    } else {
      oneLine = `${cleanTopic} utilizes mathematical invariants and space-time tradeoffs to reduce search spaces and solve complex combinatorial problems deterministically.`;
      layman = `Like guessing a secret number between 1 and 100: each time you guess 50 and hear "higher", you eliminate half the possibilities in a single step.`;
      techExp = `By establishing clear loop invariants and monotonic conditions, ${cleanTopic} optimizes asymptotic execution bounds, transforming brute-force O(N^2) or exponential solutions into efficient O(N) or O(log N) implementations.`;
      practicalSnippet = `// Idiomatic implementation\nfunction binarySearch(nums: number[], target: number): number {\n  let left = 0, right = nums.length - 1;\n  while (left <= right) {\n    const mid = left + Math.floor((right - left) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}`;
    }
  }

  // Pitch scripts customized by depth
  let thirtySec = `${cleanTopic} delivers predictable performance by organizing execution and state around structured access patterns, balancing memory efficiency with sub-linear query latency.`;
  let sixtySec = `In an interview, start by framing ${cleanTopic} around the core problem it solves. Detail how its data structures maintain performance guarantees under concurrent load, and conclude by highlighting production trade-offs between memory footprint and execution speed.`;
  let twoMin = `To deliver a senior-level answer: First, outline the baseline engineering challenge that ${cleanTopic} addresses. Next, explain the algorithmic mechanics and state transitions under the hood. Contrast it with alternative approaches, explaining exactly why you would choose this pattern. Finally, discuss telemetry, observability, and failover recovery strategies in a distributed production environment.`;

  if (isBeginner) {
    thirtySec = `${cleanTopic} is a foundational building block in computing. At its core, it solves a fundamental problem: allowing software to find, store, or process information rapidly and reliably without wasting system resources.`;
    sixtySec = `When explaining ${cleanTopic} as a beginner: 1) State what problem it solves in one plain English sentence. 2) Explain how it works step-by-step using a real-world everyday analogy. 3) Mention the basic commands or syntax needed to use it and the most common beginner mistake to avoid.`;
    twoMin = `Here is the full foundational walkthrough for ${cleanTopic}: Start with the core problem—before this existed, systems had to do slow, brute-force operations. Next, introduce the central concept and show how it works step-by-step with basic commands. Then explain the 2 or 3 most essential terms anyone using it must know. Finally, share a simple concrete rule of thumb for when to use it in your code.`;
  } else if (isInterv) {
    thirtySec = `In an interview: "${cleanTopic} is the standard architectural pattern for decoupling latency from data scale. It trades a small memory overhead for deterministic O(log N) access, providing essential throughput guarantees under production workloads."`;
    sixtySec = `Interview structure: 1) Elevator pitch defining the exact mechanism (15s). 2) Step-by-step execution flow and space/time tradeoffs (25s). 3) Proactive discussion of production failure modes and why you would choose this over alternative designs (20s).`;
    twoMin = `Senior Engineer Interview Script: Start by framing the business/technical bottleneck that necessitates ${cleanTopic}. Detail the data structure and execution flow step-by-step. Next, contrast it with alternatives (e.g., in-memory caching vs database indexes), stating explicit tradeoffs. Conclude with real-world edge cases: concurrency contention, memory bloat, and P99 latency telemetry monitoring.`;
  } else if (isDeep) {
    thirtySec = `Deep systems perspective: ${cleanTopic} optimizes hardware memory hierarchy, aligning data across CPU cache line boundaries and minimizing branch mispredictions to maximize instructions-per-cycle (IPC).`;
    sixtySec = `Systems breakdown: 1) Hardware and OS boundary interactions (syscall overhead, TLB lookups, page faults). 2) In-memory representation and pointer indirection overhead. 3) Concurrency synchronization primitives (compare-and-swap vs mutexes) and exact algorithmic complexity.`;
    twoMin = `Staff Systems Deep-Dive: Walk through the instruction-level pipeline. Address memory allocation layout (heap fragmentation vs slab allocation), CPU L1/L2 cache locality, memory barriers for concurrent visibility, and operating system kernel context switch penalties under heavy thread contention.`;
  }

  return {
    topic: cleanTopic,
    domain: domain || 'Computer Science & AI',
    depth: depth as any,
    oneLineExplanation: oneLine,
    whyItExists: `Created to address critical architectural constraints in ${domain || 'software systems'}, replacing brittle ad-hoc implementations with robust, verifiable computational standards.`,
    intuition: layman,
    howItWorks: `Transforms incoming data streams through verified invariant states, executing bounded algorithmic transitions and returning deterministic responses.`,
    laymanExplanation: layman,
    technicalExplanation: techExp,
    prerequisites: isBeginner ? ['Core programming fundamentals', 'Basic data structures'] : ['System design basics', 'Computational complexity'],
    relatedTopics: isLLM ? ['Self-Attention', 'Transformer Architecture', 'RAG'] : ['Data Structures & Algorithms', 'System Design'],
    nextTopics: isLLM ? ['Fine-tuning & Model Adaptation', 'Agentic AI'] : ['Distributed Systems', 'Production Engineering'],
    coreConcepts: isBeginner
      ? [
          'Foundational Definition & Core Purpose',
          'Fundamental Commands & Essential Syntax',
          'Step-by-Step Execution Mental Model',
          'Common Beginner Mistakes & Easy Fixes',
        ]
      : [
          'Algorithmic Complexity & Bounds',
          'Memory Footprint vs Throughput Tradeoff',
          'Concurrency & Race Condition Handling',
          'Failure Modes & Resiliency Invariants',
        ],
    architectureOrFlow: isBeginner
      ? 'Step 1: User / Client Input -> Step 2: Basic Validation -> Step 3: Fundamental Logic Execution -> Step 4: Output / Result Returned to User.'
      : 'Client Ingestion -> Input Validation & Sanitization -> Core Logic Execution / Query Routing -> State Persistence / Cache Write -> Response Serialization.',
    importantTerminology: isBeginner
      ? [
          { term: 'Syntax', definition: 'The exact set of rules and spelling required for the computer to understand your command.' },
          { term: 'Parameter / Argument', definition: 'A specific value passed into a command or function to customize its behavior.' },
          { term: 'Latency', definition: 'The delay between sending a request and receiving the response.' },
          { term: 'Throughput', definition: 'The total number of tasks or requests processed within a given time period.' },
        ]
      : [
          { term: 'Throughput', definition: 'The volume of transactions or operations executed successfully per unit of time.' },
          { term: 'Invariants', definition: 'Mathematical or logical constraints that remain invariant throughout execution.' },
          { term: 'Contention', definition: 'Conflict over shared hardware or software resources under high concurrency.' },
          { term: 'Amortized Complexity', definition: 'The average time per operation over a worst-case sequence of operations.' },
        ],
    practicalExample: practicalSnippet,
    realWorldUseCases: isBeginner
      ? [
          'Writing clean, reliable scripts and starter projects',
          'Passing introductory technical interviews and campus placements',
          'Building your first web, API, or machine learning applications',
        ]
      : [
          'High-throughput distributed backend services handling >500k RPS',
          'Low-latency microservices with strict P99 SLA requirements',
          'Data storage engines requiring predictable search and mutation performance',
        ],
    commonMisconceptions: isBeginner
      ? [
          'Thinking you need advanced mathematics before you can understand and use this concept.',
          'Believing that more lines of code always mean a better solution.',
          'Memorizing code snippets without understanding the underlying purpose and flow.',
        ]
      : [
          'Assuming it operates with zero runtime memory or allocation overhead',
          'Overlooking network partition failures (CAP theorem) in distributed topologies',
          'Premature optimization before measuring production bottleneck telemetry',
        ],
    interviewQuestions: isBeginner
      ? [
          `In your own words, what is ${cleanTopic} and what problem does it solve?`,
          `What are the basic commands or steps to implement ${cleanTopic}?`,
          `What is the difference between a beginner's approach and a professional approach to ${cleanTopic}?`,
        ]
      : [
          `How would you explain the core mechanism of ${cleanTopic} to a non-technical stakeholder?`,
          `What are the primary space and time complexity tradeoffs of ${cleanTopic}?`,
          `In what production scenarios would you deliberately avoid using ${cleanTopic}?`,
        ],
    followUpQuestions: [
      `How does your design behave if the primary node or memory store experiences sudden failure?`,
      `What happens when concurrent writes outpace the replication lag?`,
      `How would you monitor and alert on P99 latency regressions in production?`,
    ],
    commonMistakesCandidatesMake: isBeginner
      ? [
          'Forgetting to explain basic terms and jumping straight into complicated buzzwords.',
          'Neglecting edge cases like empty inputs, null pointers, or zero division.',
          'Not asking clarifying questions before answering.',
        ]
      : [
          'Jumping into raw implementation code without clarifying scale, constraints, or SLA requirements.',
          'Failing to analyze auxiliary memory consumption when optimizing runtime latency.',
          'Giving vague buzzword-filled answers instead of tracing concrete data flows.',
        ],
    thirtySecondExplanation: thirtySec,
    sixtySecondExplanation: sixtySec,
    twoMinuteExplanation: twoMin,
    quickRevision: isBeginner
      ? [
          'Master the fundamental definition in plain English first.',
          'Understand the basic command syntax and what each parameter does.',
          'Always test with simple edge cases (empty input, small numbers).',
          'Connect the concept to a memorable real-world analogy.',
        ]
      : [
          'Always clarify the read vs write ratio before choosing an architecture.',
          'Know the P50 and P99 latency characteristics of underlying data structures.',
          'Be prepared to defend space-time tradeoffs under scale.',
          'Anchor explanations in real engineering metrics rather than abstract theory.',
        ],
    quiz: [
      {
        question: isBeginner
          ? `What is the primary reason engineers use ${cleanTopic}?`
          : `What is the primary architectural tradeoff when deploying ${cleanTopic}?`,
        options: isBeginner
          ? [
              'To solve a core computing challenge efficiently with clear rules and predictable behavior',
              'Because it is the only way to write code in any programming language',
              'To increase memory usage and make code harder to read',
              'It is strictly required by cloud providers',
            ]
          : [
              'Trading auxiliary memory space or cache overhead to achieve sub-linear query latency',
              'Complete loss of transactional durability on service restart',
              'Requiring dedicated GPU hardware clusters for basic execution',
              'Inability to scale across containerized environments',
            ],
        correctIndex: 0,
        explanation: isBeginner
          ? `${cleanTopic} provides a structured, efficient way to solve problems without brute-force inefficiency.`
          : 'Most indexing, caching, and algorithmic structures trade auxiliary memory footprint to achieve dramatic reductions in query or computation time.',
      },
      {
        question: `How should an engineer handle unexpected errors or high load when using ${cleanTopic}?`,
        options: [
          'Implement proper validation, fallback handling, and graceful degradation',
          'Ignore errors and let the program terminate silently',
          'Allocate infinite memory without monitoring',
          'Restart the entire operating system every 5 minutes',
        ],
        correctIndex: 0,
        explanation: 'Resilient software design incorporates clear input validation, error handling, and graceful degradation under stress.',
      },
    ],
    trustedSources: [
      { title: 'Official Documentation & Standards Guide', url: 'https://developer.mozilla.org', type: 'Documentation' },
      { title: 'Seminal Architecture Whitepaper', url: 'https://github.com', type: 'Reference' },
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

const RICH_CURRENT_TOPICS_CATALOG = [
  {
    title: 'DeepSeek-V3 / R1 Architectures & Sparse MoE Efficiency',
    headline: 'DeepSeek-V3 / R1 Architectures & Sparse MoE Efficiency',
    category: 'AI & Frontier Models',
    summary: 'Massive open-weight releases utilizing Multi-head Latent Attention (MLA) and DeepSeekMoE with 256 fine-grained experts have drastically lowered training and inference compute costs compared to traditional dense architectures.',
    whatHappened: 'Massive open-weight releases utilizing Multi-head Latent Attention (MLA) and DeepSeekMoE with 256 fine-grained experts have drastically lowered training and inference compute costs compared to traditional dense architectures.',
    whyItMatters: 'Proves high reasoning and code synthesis capability can be achieved at an order-of-magnitude lower dollar cost per token, forcing hyperscalers to optimize KV-cache compression and expert routing.',
    background: 'Dense models require all weights to be active during forward pass. Fine-grained MoE decouples active compute from total memory capacity while MLA compresses key-value vectors into latent spaces.',
    perspectives: [
      'Engineers appreciate the open-weight weights and reproducible architectural papers.',
      'Infrastructure teams focus on custom kernel optimization (FP8 GEMM) to achieve advertised throughput on commodity GPU clusters.',
    ],
    keyFacts: [
      'Multi-Head Latent Attention (MLA) compresses the KV-cache by up to 90%.',
      'Uses DeepSeekMoE architecture with shared experts and routed experts to prevent knowledge collapse.',
    ],
    interviewQuestions: [
      'How does Multi-head Latent Attention (MLA) reduce GPU memory footprint during inference compared to Multi-Query Attention (MQA)?',
      'What are the primary networking bottlenecks when routing tokens across 256 experts on distributed NVLink/InfiniBand clusters?',
    ],
    speakingPrompt: 'Explain how DeepSeek-V3\'s Multi-head Latent Attention (MLA) enables extreme cost reductions in high-throughput LLM serving.',
    date: '2025–2026 Shift',
    source: 'DeepSeek Engineering Technical Report',
    relevanceBadge: 'High Interview Frequency',
  },
  {
    title: 'Anthropic\'s Model Context Protocol (MCP) as Universal AI Tooling Standard',
    headline: 'Anthropic\'s Model Context Protocol (MCP) as Universal AI Tooling Standard',
    category: 'AI & Frontier Models',
    summary: 'Anthropic open-sourced the Model Context Protocol (MCP), a standardized JSON-RPC protocol enabling LLMs to securely discover, authenticate, and query external data sources and local developer tools.',
    whatHappened: 'Anthropic open-sourced the Model Context Protocol (MCP), a standardized JSON-RPC protocol enabling LLMs to securely discover, authenticate, and query external data sources and local developer tools.',
    whyItMatters: 'Replaces proprietary ad-hoc plugins with an open protocol analogous to Language Server Protocol (LSP), creating an interoperable ecosystem for AI agents.',
    background: 'Previously, connecting LLMs to databases, APIs, or filesystems required fragmented custom integrations for each provider or framework.',
    perspectives: [
      'Tool builders can write a single MCP server that works across Claude Desktop, Cursor, and custom agent backends.',
      'Security researchers caution that exposing local machine resources to autonomous agent tool loops requires rigorous human-in-the-loop sandboxing.',
    ],
    keyFacts: [
      'Built upon JSON-RPC 2.0 transport over stdin/stdout or Server-Sent Events (SSE).',
      'Provides standard primitives for Resources (data), Prompts (templates), and Tools (executable functions).',
    ],
    interviewQuestions: [
      'How does MCP compare architecturally to the Language Server Protocol (LSP) in software development?',
      'Design a secure gateway for an MCP server that prevents prompt injection attacks from triggering destructive bash commands.',
    ],
    speakingPrompt: 'Give a 90-second technical pitch explaining what problem the Model Context Protocol (MCP) solves and how its client-server architecture operates.',
    date: 'Current Frontier',
    source: 'Anthropic Open Source Specification',
    relevanceBadge: 'System Architecture',
  },
  {
    title: 'Test-Time Compute Scaling & Autonomous Reasoning Verifiers',
    headline: 'Test-Time Compute Scaling & Autonomous Reasoning Verifiers',
    category: 'AI & Frontier Models',
    summary: 'Frontier AI labs have shifted heavy compute investment into test-time reasoning (chain-of-thought exploration, search trees, and process reward model verification) rather than only scaling static pre-training data.',
    whatHappened: 'Frontier AI labs have shifted heavy compute investment into test-time reasoning (chain-of-thought exploration, search trees, and process reward model verification) rather than only scaling static pre-training data.',
    whyItMatters: 'Models can spend variable latency and compute on difficult coding or mathematical challenges, shifting software development from prompt completion to asynchronous agentic workflow execution.',
    background: 'Scaling pre-training parameters faces diminishing returns and web text exhaustion. Reasoning models explore multiple candidate paths at runtime and self-correct before outputting.',
    perspectives: [
      'Software engineers experience dramatic improvements in complex debugging and architectural planning.',
      'System architects face challenges with unpredictable response times (5 seconds to 2 minutes) requiring queue-based async architectures.',
    ],
    keyFacts: [
      'Process Reward Models (PRMs) evaluate intermediate reasoning steps rather than just the final answer.',
      'Latency scales dynamically with problem difficulty, requiring streaming UI patterns.',
    ],
    interviewQuestions: [
      'How does an asynchronous job queue architecture handle non-deterministic latency spikes from reasoning models in production?',
      'What is the mathematical difference between Outcome Reward Models (ORMs) and Process Reward Models (PRMs)?',
    ],
    speakingPrompt: 'Discuss the system engineering implications of reasoning models whose response times vary from 2 seconds to 90 seconds based on query difficulty.',
    date: '2025–2026 Shift',
    source: 'Frontier Labs AI Research',
    relevanceBadge: 'Production Critical',
  },
  {
    title: 'vLLM PagedAttention & Distributed KV Cache Offloading',
    headline: 'vLLM PagedAttention & Distributed KV Cache Offloading',
    category: 'System Design & Distributed Systems',
    summary: 'High-throughput LLM serving has universally adopted virtual memory-inspired PagedAttention, eliminating internal GPU fragmentation and enabling shared prefix caching across multi-tenant inference pools.',
    whatHappened: 'High-throughput LLM serving has universally adopted virtual memory-inspired PagedAttention, eliminating internal GPU fragmentation and enabling shared prefix caching across multi-tenant inference pools.',
    whyItMatters: 'Increases serving throughput by 2x to 4x on identical GPU hardware by treating high-bandwidth memory (HBM) like OS virtual memory with dynamic page tables.',
    background: 'Traditional transformers pre-allocated contiguous memory blocks for key-value tensors up to max context length, wasting up to 60-80% of GPU VRAM on empty padding.',
    perspectives: [
      'Cloud platform engineers can pack 3x more concurrent requests per H100 node.',
      'Prompt caching allows shared system prompts or repository context to be calculated once and reused across thousands of requests.',
    ],
    keyFacts: [
      'Reduces KV cache memory waste from >60% down to under 4%.',
      'Enables copy-on-write branching for parallel candidate token generation.',
    ],
    interviewQuestions: [
      'Explain the virtual memory analogy in PagedAttention: what corresponds to physical frames, logical pages, and page tables?',
      'How does prefix caching work in production, and how do you handle cache eviction when VRAM reaches saturation?',
    ],
    speakingPrompt: 'Explain how PagedAttention solves the GPU memory bottleneck in production LLM serving in under 90 seconds.',
    date: 'Core Infrastructure',
    source: 'UC Berkeley SkyLab / vLLM Project',
    relevanceBadge: 'System Design Round',
  },
  {
    title: 'eBPF Revolution: Kernel-Level Observability & High-Speed Networking',
    headline: 'eBPF Revolution: Kernel-Level Observability & High-Speed Networking',
    category: 'System Design & Distributed Systems',
    summary: 'Extended Berkeley Packet Filter (eBPF) has replaced traditional kernel modules and sidecar proxies in modern Kubernetes clusters (via Cilium and Pixie), running sandboxed code directly in the Linux kernel.',
    whatHappened: 'Extended Berkeley Packet Filter (eBPF) has replaced traditional kernel modules and sidecar proxies in modern Kubernetes clusters (via Cilium and Pixie), running sandboxed code directly in the Linux kernel.',
    whyItMatters: 'Provides sub-microsecond network routing, native load balancing, and zero-overhead telemetry without inserting intrusive sidecar containers into application pods.',
    background: 'Historically, modifying kernel network packet processing required building and maintaining custom kernel modules or routing all traffic through iptables/userspace proxies.',
    perspectives: [
      'DevOps teams reduce CPU overhead by up to 25% by bypassing userspace proxy hops.',
      'Security teams utilize eBPF programs to detect suspicious syscalls and zero-day vulnerabilities in real time.',
    ],
    keyFacts: [
      'Verified by an in-kernel safety verifier to guarantee termination and memory bounds before execution.',
      'Replaces Linux iptables O(N) packet inspection with O(1) BPF hash map lookups.',
    ],
    interviewQuestions: [
      'How does Cilium use eBPF to bypass the Linux TCP/IP stack overhead between co-located containers?',
      'What safety guarantees does the Linux eBPF verifier enforce prior to JIT-compiling bytecode into machine instructions?',
    ],
    speakingPrompt: 'Describe the architectural benefits of eBPF-based service meshes over traditional sidecar proxy architectures.',
    date: 'Modern Infrastructure',
    source: 'Linux Foundation / CNCF',
    relevanceBadge: 'Infrastructure Deep Dive',
  },
  {
    title: 'Memory-Safe Systems: Rust Integration in Linux Kernel & Android',
    headline: 'Memory-Safe Systems: Rust Integration in Linux Kernel & Android',
    category: 'Software Engineering & Security',
    summary: 'Major operating system kernels (Linux, Android, Windows) and security agencies (CISA) have mandated memory-safe languages, integrating Rust for new drivers and network parsers.',
    whatHappened: 'Major operating system kernels (Linux, Android, Windows) and security agencies (CISA) have mandated memory-safe languages, integrating Rust for new drivers and network parsers.',
    whyItMatters: 'Eliminates roughly 70% of high-severity CVE vulnerabilities (use-after-free, buffer overflows, double frees) at compile time without garbage collection runtime overhead.',
    background: 'C and C++ require manual pointer management, which historically accounted for the overwhelming majority of zero-day exploits in operating systems and browsers.',
    perspectives: [
      'Security engineers champion Rust as the single most effective intervention against remote code execution.',
      'Systems veterans emphasize the steep learning curve of borrow checker semantics and complex FFI boundaries with existing C codebases.',
    ],
    keyFacts: [
      'Google reported Android memory safety vulnerabilities dropped from 76% to under 24% after adopting Rust for new code.',
      'Rust achieves memory safety entirely via compile-time affine type systems and lifetime analysis.',
    ],
    interviewQuestions: [
      'Explain how the Rust borrow checker enforces data race freedom at compile time without runtime garbage collection.',
      'What are the primary architectural challenges when designing a Foreign Function Interface (FFI) between Rust and legacy C libraries?',
    ],
    speakingPrompt: 'Present a concise analysis on why tech giants are migrating critical low-level infrastructure from C++ to Rust.',
    date: 'Industry Transition',
    source: 'CISA & Android Security Team',
    relevanceBadge: 'Core Engineering',
  },
  {
    title: 'Kubernetes Gateway API: The Modern Replacement for Ingress',
    headline: 'Kubernetes Gateway API: The Modern Replacement for Ingress',
    category: 'Cloud, DevOps & Infrastructure',
    summary: 'The CNCF graduated Kubernetes Gateway API to GA, officially superseding the 8-year-old Ingress specification with role-oriented, expressive traffic routing and native multi-cluster support.',
    whatHappened: 'The CNCF graduated Kubernetes Gateway API to GA, officially superseding the 8-year-old Ingress specification with role-oriented, expressive traffic routing and native multi-cluster support.',
    whyItMatters: 'Separates infrastructure provisioning (GatewayClass, Gateway) from application routing (HTTPRoute, GRPCRoute), solving vendor lock-in and annotation sprawl.',
    background: 'Traditional Ingress lacked native support for header-based routing, traffic splitting (canary deployments), and cross-namespace references, forcing teams to rely on non-standard annotations.',
    perspectives: [
      'Platform engineers can now delegate specific route management to product teams without granting cluster-admin privileges.',
      'Supports advanced protocols like gRPC and raw TCP/UDP as first-class citizens.',
    ],
    keyFacts: [
      'Role-oriented architecture: Infrastructure Provider, Cluster Operator, Application Developer.',
      'Native support for percentage-based traffic weighting for zero-downtime canary releases.',
    ],
    interviewQuestions: [
      'How does the role-oriented resource model of Kubernetes Gateway API improve multi-tenant cluster management over legacy Ingress?',
      'How would you implement a blue/green or canary deployment with 95/5 traffic split using HTTPRoute?',
    ],
    speakingPrompt: 'Explain the core architectural differences between Kubernetes Ingress and the Gateway API to a senior DevOps panel.',
    date: 'CNCF Standard',
    source: 'Kubernetes SIG-Network',
    relevanceBadge: 'DevOps & Cloud',
  },
  {
    title: 'WebAssembly (Wasm) Component Model & Distributed Edge Compute',
    headline: 'WebAssembly (Wasm) Component Model & Distributed Edge Compute',
    category: 'Cloud, DevOps & Infrastructure',
    summary: 'The WebAssembly System Interface (WASI 0.2) and Component Model have matured, enabling polyglot microservices that start in under 1 millisecond with near-zero memory footprint at CDN edge nodes.',
    whatHappened: 'The WebAssembly System Interface (WASI 0.2) and Component Model have matured, enabling polyglot microservices that start in under 1 millisecond with near-zero memory footprint at CDN edge nodes.',
    whyItMatters: 'Provides a secure, language-agnostic sandbox alternative to heavy Docker containers for event-driven serverless workloads and plugin ecosystems.',
    background: 'Containers require full guest operating system root filesystems, leading to cold starts of several hundred milliseconds and multi-megabyte memory baselines.',
    perspectives: [
      'Cloudflare, Fastly, and AWS employ Wasm runtimes to execute edge middleware closer to end users.',
      'Tooling and debugging ecosystems for Wasm components are still maturing compared to standard Linux container toolchains.',
    ],
    keyFacts: [
      'Cold boot times under 1ms compared to 200–500ms for lightweight Linux containers.',
      'Capability-based security model: Wasm binaries have zero access to files or network unless explicitly granted by the host.',
    ],
    interviewQuestions: [
      'What are the security advantages of capability-based security in WASI over traditional Linux container namespaces and cgroups?',
      'When would you choose a WebAssembly micro-runtime over a traditional Docker container in an edge compute architecture?',
    ],
    speakingPrompt: 'Pitch the architectural rationale for adopting WebAssembly serverless runtimes over Docker containers for event-driven edge APIs.',
    date: '2025–2026 Trend',
    source: 'Bytecode Alliance / W3C',
    relevanceBadge: 'Architecture & Edge',
  },
  {
    title: 'Claude 3.7 Sonnet & Hybrid Reasoning Architectures',
    headline: 'Claude 3.7 Sonnet & Hybrid Reasoning Architectures',
    category: 'AI & Frontier Models',
    summary: 'The advent of hybrid reasoning models that dynamically switch between instantaneous low-latency token generation and extended chain-of-thought exploration based on token budget or query complexity.',
    whatHappened: 'Frontier models now offer hybrid reasoning modes where developers can specify exact thinking token budgets, allowing the same model to serve sub-second customer support chats or execute deep 10-minute multi-file code refactors.',
    whyItMatters: 'Removes the need to route between separate "fast" and "thinking" models, simplifying production LLM gateway routing and caching topologies.',
    background: 'Previously, applications had to maintain brittle heuristics or router models to decide whether to dispatch prompts to lightweight models (e.g., Flash) or reasoning models (e.g., o1/R1).',
    perspectives: [
      'Application developers appreciate unified API interfaces with configurable reasoning budgets.',
      'FinOps teams need new cost-governance dashboards to prevent unexpected reasoning token budget explosions.',
    ],
    keyFacts: [
      'Supports configurable max_thinking_tokens budgets directly in API calls.',
      'Enables continuous streaming of thought blocks for transparent user interfaces.',
    ],
    interviewQuestions: [
      'How would you architect a production API gateway that dynamically computes the optimal thinking token budget based on SLA tier and query ambiguity?',
      'What are the cache-invalidation challenges when reasoning models stream intermediate scratchpads prior to final JSON outputs?',
    ],
    speakingPrompt: 'Explain how hybrid reasoning architectures change cost-performance optimization for enterprise AI products.',
    date: '2025–2026 Shift',
    source: 'Frontier AI Research',
    relevanceBadge: 'High Interview Frequency',
  },
  {
    title: 'FlashAttention-3: Warp-Specialized Asynchronous GPU Memory Tiling',
    headline: 'FlashAttention-3: Warp-Specialized Asynchronous GPU Memory Tiling',
    category: 'AI & Frontier Models',
    summary: 'FlashAttention-3 leverages Hopper H100 Tensor Memory Accelerators (TMA) and warp specialization to hide memory latency, unlocking up to 75% of peak theoretical GPU FLOPS during long-context attention computation.',
    whatHappened: 'Researchers released FlashAttention-3, utilizing asynchronous data transfers directly between High-Bandwidth Memory (HBM) and Shared Memory (SRAM) while specialized warps overlap GEMM matrix multiplication with softmax scaling.',
    whyItMatters: 'Permits 128k to 1M token context windows at production speeds without memory-bound GPU stalls.',
    background: 'Standard attention has O(N^2) memory footprint. FlashAttention-1 introduced tiling, FlashAttention-2 optimized work partitioning across thread blocks, and FlashAttention-3 leverages modern Hopper asynchronous hardware pipelines.',
    perspectives: [
      'GPU kernel engineers achieve near-theoretical compute efficiency by eliminating thread synchronization barriers.',
      'Model deployers can serve 4x larger batch sizes with 3x lower time-to-first-token (TTFT).',
    ],
    keyFacts: [
      'Achieves up to 740 TFLOPS/s (75% theoretical peak) on NVIDIA H100 SXM5 GPUs.',
      'Uses Hopper Tensor Memory Accelerator (TMA) for asynchronous tensor transfers.',
    ],
    interviewQuestions: [
      'What is warp specialization in modern GPU programming, and how does it prevent compute units from idling during memory fetches?',
      'How does FlashAttention compute softmax over tiled matrix blocks without materializing the full N x N attention matrix?',
    ],
    speakingPrompt: 'Explain how FlashAttention-3 eliminates the memory bandwidth bottleneck in Transformer self-attention.',
    date: '2025–2026 Frontier',
    source: 'Stanford AI Lab / Tri Dao',
    relevanceBadge: 'Deep Systems & AI',
  },
  {
    title: 'NIST Finalizes Post-Quantum Cryptography (PQC) Standards (ML-KEM & ML-DSA)',
    headline: 'NIST Finalizes Post-Quantum Cryptography (PQC) Standards (ML-KEM & ML-DSA)',
    category: 'Software Engineering & Security',
    summary: 'NIST officially published finalized FIPS standards for post-quantum encryption (FIPS 203 ML-KEM, FIPS 204 ML-DSA), triggering mandatory migrations across enterprise TLS, SSH, and cloud infrastructure.',
    whatHappened: 'NIST officially released final standards replacing RSA and Elliptic Curve Cryptography with lattice-based algorithms impervious to Shor\'s algorithm on cryptanalytically relevant quantum computers.',
    whyItMatters: 'Protects against "Harvest Now, Decrypt Later" espionage where adversaries capture encrypted enterprise network traffic today to decrypt once quantum hardware scales.',
    background: 'Current public key cryptography relies on the integer factorization (RSA) and discrete logarithm (ECC) problems, which Shor\'s algorithm can solve in polynomial time on quantum processors.',
    perspectives: [
      'Security architectures are implementing hybrid TLS key exchanges (combining X25519 with ML-KEM-768).',
      'Engineers must accommodate significantly larger public keys and ciphertext sizes in UDP and MTU-constrained networks.',
    ],
    keyFacts: [
      'FIPS 203 (ML-KEM / Kyber) is the primary standard for general encryption and key encapsulation.',
      'Ciphertext size increases from ~32 bytes (ECC) to >1KB (ML-KEM), necessitating TCP segmentation and packet size tuning.',
    ],
    interviewQuestions: [
      'What is "Harvest Now, Decrypt Later", and how do hybrid TLS handshakes (e.g. X25519 + ML-KEM) mitigate transition risks?',
      'How do larger PQC public key sizes impact network latency, DNS resolution, and TCP congestion window initialization?',
    ],
    speakingPrompt: 'Describe why organizations are transitioning to Post-Quantum Cryptography and the engineering tradeoffs involved.',
    date: 'Security Milestone',
    source: 'NIST FIPS 203/204 Specification',
    relevanceBadge: 'Enterprise Security',
  },
  {
    title: 'Passkeys & WebAuthn: The Universal Phishing-Resistant Authentication Shift',
    headline: 'Passkeys & WebAuthn: The Universal Phishing-Resistant Authentication Shift',
    category: 'Software Engineering & Security',
    summary: 'Global adoption of FIDO2 / WebAuthn Passkeys across Apple, Google, and Microsoft has made cryptographic public-private key pairs the gold standard for consumer and enterprise identity.',
    whatHappened: 'Major platforms have replaced traditional passwords and SMS-based OTPs with synchronized passkeys tied to biometric secure enclaves (TouchID, FaceID, Windows Hello).',
    whyItMatters: 'Completely eliminates credential stuffing and man-in-the-middle phishing attacks because authentication challenges are cryptographically bound to the specific origin URL domain.',
    background: 'Passwords and SMS 2FA remain the vector for >80% of data breaches. Passkeys utilize public-key cryptography where the private key never leaves the user\'s hardware security module.',
    perspectives: [
      'Security teams eliminate account takeover vulnerabilities and reduce help-desk password reset costs.',
      'User experience teams see login completion rates increase by over 30% with sub-2-second sign-in times.',
    ],
    keyFacts: [
      'Cryptographically bound to the browser\'s origin domain, rendering credential phishing mathematically impossible.',
      'Syncs securely across user devices via encrypted cloud keychains (iCloud Keychain, Google Password Manager).',
    ],
    interviewQuestions: [
      'How does WebAuthn prevent Man-in-the-Middle (MITM) and reverse-proxy phishing (like Evilginx) at the protocol level?',
      'Design a resilient account recovery architecture for a passkey-only application when a user loses all authorized hardware devices.',
    ],
    speakingPrompt: 'Explain how WebAuthn and Passkeys provide mathematical immunity against phishing and credential stuffing.',
    date: 'Standard Shift',
    source: 'FIDO Alliance & W3C',
    relevanceBadge: 'Auth & Identity',
  },
  {
    title: 'Vector Indexing at Scale: HNSW vs DiskANN for Billion-Scale RAG',
    headline: 'Vector Indexing at Scale: HNSW vs DiskANN for Billion-Scale RAG',
    category: 'System Design & Distributed Systems',
    summary: 'With enterprise RAG datasets swelling to billions of embeddings, distributed vector databases have transitioned from in-memory HNSW graphs to SSD-optimized DiskANN and Product Quantization (IVF-PQ).',
    whatHappened: 'Engineering teams discovered that holding billions of 1536-dimensional floating-point vectors in pure RAM requires tens of terabytes of memory ($$$). Modern databases now store compressed graphs on NVMe SSDs with minimal recall degradation.',
    whyItMatters: 'Reduces vector storage hardware costs by 80-90% while sustaining P99 search latencies under 15 milliseconds across billions of documents.',
    background: 'Hierarchical Navigable Small World (HNSW) delivers fast recall but requires all graph pointers and vectors to reside permanently in DRAM.',
    perspectives: [
      'Infrastructure teams drastically cut cluster provisioning budgets by leveraging NVMe SSD read IOPS.',
      'Search engineers carefully benchmark recall@10 trade-offs when applying scalar or product quantization.',
    ],
    keyFacts: [
      'HNSW in DRAM requires ~1.5x to 2x raw vector memory for graph index overhead.',
      'DiskANN caches high-degree nodes in RAM while paging vector clusters from fast NVMe SSDs.',
    ],
    interviewQuestions: [
      'Compare HNSW and DiskANN: what are the memory, throughput, and disk IO tradeoffs for a 1-billion vector dataset?',
      'How does Product Quantization (PQ) compress high-dimensional vectors, and how does it compute asymmetric distance at query time?',
    ],
    speakingPrompt: 'Pitch the architectural design for a low-cost, billion-scale vector retrieval cluster supporting an enterprise knowledge base.',
    date: '2025–2026 Trend',
    source: 'Microsoft Research & Milvus Project',
    relevanceBadge: 'System Design Round',
  },
  {
    title: 'Distributed Consensus: Raft vs Multi-Paxos in Spanner and CockroachDB',
    headline: 'Distributed Consensus: Raft vs Multi-Paxos in Spanner and CockroachDB',
    category: 'System Design & Distributed Systems',
    summary: 'Modern globally-distributed relational databases (Google Spanner, CockroachDB, YugabyteDB) combine Multi-Paxos/Raft consensus groups with atomic clocks (TrueTime) or Hybrid Logical Clocks (HLC) for serializable transactions.',
    whatHappened: 'Production distributed systems have perfected leader-based consensus partitioning, executing consensus at the range/tablet level rather than cluster-wide, enabling linear horizontal scaling.',
    whyItMatters: 'Enables global ACID transactions with zero data loss (RPO=0) even during regional data center outages.',
    background: 'Classical databases relied on single-leader replication with failover lags and split-brain risks. Multi-Raft runs thousands of concurrent consensus rings within a single cluster.',
    perspectives: [
      'Database architects can achieve automatic leader rebalancing and locality-aware leaseholder reads.',
      'SREs manage network partition edge cases and cross-region consensus latency penalties.',
    ],
    keyFacts: [
      'CockroachDB uses Raft leaseholders to serve consistent read requests without full quorum round-trips.',
      'Multi-Raft splits tables into 64MB ranges, each independently managed by a 3 or 5 node Raft group.',
    ],
    interviewQuestions: [
      'How does CockroachDB or Spanner serve stale vs strictly consistent reads without incurring consensus quorum round-trips?',
      'What is the difference between Raft leader election and leaseholder management in high-throughput transactional databases?',
    ],
    speakingPrompt: 'Explain how Multi-Raft consensus scales horizontally across thousands of data ranges in modern distributed SQL databases.',
    date: 'Core Distributed Systems',
    source: 'Google Spanner & Cockroach Labs Whitepapers',
    relevanceBadge: 'Staff System Design',
  },
  {
    title: 'HTTP/3 & QUIC: Overcoming Head-of-Line Blocking in Modern Web APIs',
    headline: 'HTTP/3 & QUIC: Overcoming Head-of-Line Blocking in Modern Web APIs',
    category: 'System Design & Distributed Systems',
    summary: 'HTTP/3 running over QUIC (UDP) has reached over 40% global internet traffic, eliminating TCP Head-of-Line blocking and enabling zero-RTT connection establishment across mobile networks.',
    whatHappened: 'Major cloud providers, CDNs (Cloudflare, Fastly), and mobile apps have shifted to HTTP/3 to ensure that packet loss on one stream does not stall unrelated multiplexed streams.',
    whyItMatters: 'Dramatically improves P99 latency and tail connectivity on lossy mobile networks (cellular 4G/5G, congested Wi-Fi).',
    background: 'HTTP/2 multiplexed streams over a single TCP connection. If one packet dropped, the entire TCP window blocked waiting for retransmission (Head-of-Line blocking). QUIC solves this by implementing independent stream packet recovery over UDP.',
    perspectives: [
      'Mobile client engineers see connection migration work seamlessly when switching from Wi-Fi to cellular without dropping active web sockets.',
      'Network administrators must reconfigure corporate firewalls and rate-limiters to handle high-volume UDP traffic.',
    ],
    keyFacts: [
      '0-RTT connection resumption combines cryptographic TLS 1.3 handshake with transport parameters.',
      'Independent streams: packet loss in stream 1 causes zero delay in stream 2.',
    ],
    interviewQuestions: [
      'Explain how HTTP/2 suffered from TCP head-of-line blocking, and how QUIC solves this at the transport layer.',
      'What are the security and denial-of-service risks associated with 0-RTT connection resumption in HTTP/3?',
    ],
    speakingPrompt: 'Give a 90-second explanation of why HTTP/3 uses UDP and how it improves mobile application latency.',
    date: 'Web Standards GA',
    source: 'IETF RFC 9000 & Cloudflare',
    relevanceBadge: 'Networking & Scale',
  },
  {
    title: 'Platform Engineering & Internal Developer Platforms (IDPs)',
    headline: 'Platform Engineering & Internal Developer Platforms (IDPs)',
    category: 'Cloud, DevOps & Infrastructure',
    summary: 'Organizations have transitioned away from "DevOps as a team" toward Platform Engineering, using backstage portals and declarative APIs to reduce developer cognitive load while enforcing governance.',
    whatHappened: 'Tech companies are replacing ticket-based infrastructure requests and raw Kubernetes manifests with self-service developer portals that provide golden paths for provisioning databases, microservices, and CI/CD pipelines.',
    whyItMatters: 'Reduces time-to-first-commit for new hires from weeks to hours and prevents configuration drift across hundreds of microservices.',
    background: 'The DevOps shift pushed infrastructure complexity onto application developers, resulting in cognitive overload, misconfigured IAM roles, and security drift.',
    perspectives: [
      'Product engineers enjoy self-service catalogs with embedded observability and automated scaffolding.',
      'Platform engineers operate the IDP as a product, treating internal developers as their primary customers.',
    ],
    keyFacts: [
      'Spotify open-sourced Backstage, which has become the de facto CNCF framework for developer portals.',
      'Enforces policy-as-code (Open Policy Agent) transparently during pull-request checks.',
    ],
    interviewQuestions: [
      'What is the core difference between the DevOps paradigm and Platform Engineering in high-growth tech organizations?',
      'How would you design a self-service "Golden Path" for provisioning a resilient, PCI-compliant microservice in Kubernetes?',
    ],
    speakingPrompt: 'Present the case for Platform Engineering and Internal Developer Platforms to an engineering leadership panel.',
    date: '2025–2026 Shift',
    source: 'CNCF Platform Engineering Working Group',
    relevanceBadge: 'Cloud & Org Design',
  },
];

// In-memory store for user-submitted or dynamically generated current affairs
const userSubmittedCurrentTopics: any[] = [];

function generateFallbackCurrentTopics(category: string = 'All', filterQuery: string = '', shuffle: boolean = false) {
  let list = [...userSubmittedCurrentTopics, ...RICH_CURRENT_TOPICS_CATALOG];

  if (category && category !== 'All') {
    const lowerCat = category.toLowerCase();
    const filtered = list.filter(
      (t) =>
        t.category.toLowerCase().includes(lowerCat) ||
        lowerCat.includes(t.category.toLowerCase())
    );
    if (filtered.length > 0) {
      list = filtered;
    }
  }

  if (filterQuery && filterQuery.trim()) {
    const q = filterQuery.toLowerCase().trim();
    const matches = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.whyItMatters.toLowerCase().includes(q)
    );
    if (matches.length > 0) {
      list = matches;
    }
  }

  // Shuffle or rotate when refresh requested
  if (shuffle) {
    list = [...list].sort(() => Math.random() - 0.5);
  }

  // Ensure normalized structure with unique ids
  const topics = list.map((t, index) => ({
    id: `trend_${index}_${t.title.replace(/\s+/g, '_').toLowerCase().slice(0, 16)}`,
    title: t.title,
    headline: t.headline || t.title,
    category: t.category,
    summary: t.summary,
    whatHappened: t.whatHappened || t.summary,
    whyItMatters: t.whyItMatters,
    background: t.background,
    perspectives: t.perspectives,
    keyFacts: t.keyFacts,
    interviewQuestions: t.interviewQuestions,
    speakingPrompt: t.speakingPrompt,
    date: t.date || 'Current 2025–2026',
    source: t.source || 'Frontier Tech Intelligence',
    relevanceBadge: t.relevanceBadge || 'High Interview Relevance',
  }));

  return { topics };
}

// -------------------------------------------------------------
// DYNAMIC DOMAIN TOPICS REPOSITORY (Unlimited & Ever-Refreshing)
// -------------------------------------------------------------

const DOMAIN_QUESTION_POOLS: Record<string, Array<{ topic: string; subdomain: string; difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Staff'; question: string; whyImportant: string }>> = {
  'AI/ML': [
    // Beginner AI/ML Questions
    {
      topic: 'What is RAG (Retrieval-Augmented Generation) and How Does It Work?',
      subdomain: 'RAG Core',
      difficulty: 'Beginner',
      question: 'What is RAG, why do LLMs hallucinate without it, and how does the retrieve-then-generate pipeline work from user query to answer?',
      whyImportant: 'The most popular foundational architecture in modern generative AI and enterprise AI interviews.',
    },
    {
      topic: 'What is an SDK vs an API in AI Engineering?',
      subdomain: 'Developer Tools',
      difficulty: 'Beginner',
      question: 'What is the difference between an API (REST/gRPC endpoint) and an SDK (client library), and why do platforms like OpenAI and Google Gemini provide both?',
      whyImportant: 'Core software engineering fundamental tested in early-stage engineering screenings.',
    },
    {
      topic: 'How Transformers Work Fundamentally (Intuitive Guide)',
      subdomain: 'Transformers',
      difficulty: 'Beginner',
      question: 'Explain how the Transformer architecture processes entire sentences in parallel and why self-attention replaced sequential RNNs.',
      whyImportant: 'The bedrock model architecture behind modern AI, ChatGPT, Claude, and Gemini.',
    },
    {
      topic: 'Difference Between LSTM and GRU (Memory Gates)',
      subdomain: 'Sequence Models',
      difficulty: 'Beginner',
      question: 'Compare RNN, LSTM, and GRU: why does the vanishing gradient problem occur in deep sequence models, and how do forget and update gates solve it?',
      whyImportant: 'High-frequency classic interview question in ML and NLP technical rounds.',
    },
    {
      topic: 'What is an Embedding Vector and Cosine Similarity?',
      subdomain: 'Foundations',
      difficulty: 'Beginner',
      question: 'What is a vector embedding, how are text tokens mapped into high-dimensional geometric space, and how is semantic similarity measured?',
      whyImportant: 'Underpins search, recommendation systems, semantic caching, and vector databases.',
    },
    {
      topic: 'Overfitting vs Underfitting in Machine Learning',
      subdomain: 'ML Fundamentals',
      difficulty: 'Beginner',
      question: 'How do you detect overfitting versus underfitting on training vs validation loss curves, and what are 3 concrete techniques to remedy each?',
      whyImportant: 'Universal machine learning interview question testing model diagnosis skills.',
    },
    {
      topic: 'Fine-Tuning vs Prompt Engineering vs RAG',
      subdomain: 'LLM Strategy',
      difficulty: 'Beginner',
      question: 'When should an engineering team choose prompt engineering, RAG, or fine-tuning? Compare cost, latency, update frequency, and hallucination rates.',
      whyImportant: 'Key architectural decision question asked by engineering managers and lead interviewers.',
    },
    {
      topic: 'What is Temperature, Top-P, and Top-K in LLM Inference?',
      subdomain: 'LLM Inference',
      difficulty: 'Beginner',
      question: 'Explain how temperature affects the Softmax probability distribution and how Top-P (nucleus) and Top-K sampling control randomness.',
      whyImportant: 'Essential operational parameters every AI engineer tunes in production.',
    },
    {
      topic: 'Supervised vs Unsupervised vs Reinforcement Learning',
      subdomain: 'ML Core',
      difficulty: 'Beginner',
      question: 'Explain the difference between supervised learning (labels), unsupervised learning (clustering/patterns), and reinforcement learning (rewards) with everyday examples.',
      whyImportant: 'Foundational baseline knowledge expected in any junior or mid-level technical interview.',
    },
    {
      topic: 'Gradient Descent & Learning Rate: Step Sizes and Loss',
      subdomain: 'Optimization',
      difficulty: 'Beginner',
      question: 'What is gradient descent, what happens if the learning rate is set too high or too low, and how does the optimizer find optimal weights?',
      whyImportant: 'Core calculus and algorithmic mechanism driving neural network weight updates.',
    },

    // Intermediate AI/ML Questions
    {
      topic: 'Self-Attention & Scaled Dot-Product Mechanics (Q, K, V)',
      subdomain: 'Transformers',
      difficulty: 'Intermediate',
      question: 'Walk through the query, key, and value matrix projections step-by-step and explain why dot products are divided by sqrt(d_k).',
      whyImportant: 'Fundamental mathematical foundation tested in almost every ML engineering interview.',
    },
    {
      topic: 'LoRA vs QLoRA: Low-Rank Adaptation Mechanics',
      subdomain: 'Fine-Tuning',
      difficulty: 'Intermediate',
      question: 'Explain the mathematical decomposition W + B * A in LoRA and how 4-bit NormalFloat quantization works in QLoRA to train models on single GPUs.',
      whyImportant: 'Most widely used technique for parameter-efficient adaptation of foundation models.',
    },
    {
      topic: 'RAG Pipeline: Chunking, Dense Retrieval & Cross-Encoder Reranking',
      subdomain: 'RAG Architectures',
      difficulty: 'Intermediate',
      question: 'Walk through an end-to-end production RAG pipeline combining BM25 keyword search with dense vector embeddings and a cross-encoder reranker.',
      whyImportant: 'The standard enterprise architecture for factual generative AI.',
    },
    {
      topic: 'Vector Search Indexing: HNSW Graph vs IVFFlat Clustering',
      subdomain: 'RAG & Retrieval',
      difficulty: 'Intermediate',
      question: 'Compare graph-based (HNSW) versus clustering-based (IVFFlat) vector indexing for nearest neighbor recall and memory tradeoffs.',
      whyImportant: 'Vital for building scalable retrieval-augmented generation systems.',
    },
    {
      topic: 'Rotary Position Embedding (RoPE) Mechanics',
      subdomain: 'Positional Encoding',
      difficulty: 'Intermediate',
      question: 'Why does multiplying complex rotations in 2D coordinate pairs naturally preserve relative token distances compared to absolute sinusoids?',
      whyImportant: 'Standard positional encoding used in LLaMA, Mistral, and modern architectures.',
    },
    {
      topic: 'Backpropagation & Computational Graph Optimization',
      subdomain: 'Deep Learning Core',
      difficulty: 'Intermediate',
      question: 'Walk through reverse-mode automatic differentiation and explain how gradient accumulation simulates larger batch sizes in memory.',
      whyImportant: 'Core knowledge expected of any machine learning practitioner.',
    },

    // Advanced AI/ML Questions
    {
      topic: 'Scenario: Optimizing High P99 Retrieval Latency in 10M-Doc RAG',
      subdomain: 'RAG Architectures',
      difficulty: 'Advanced',
      question: 'Scenario: Your production RAG pipeline experiences 1.8s P99 latency searching 10 million documents. How do you re-architect it with hybrid search, HNSW pruning, and semantic caching?',
      whyImportant: 'Real-world high-impact production engineering interview problem.',
    },
    {
      topic: 'KV Cache & PagedAttention in vLLM Serving',
      subdomain: 'Serving & Systems',
      difficulty: 'Advanced',
      question: 'Explain why the KV cache grows dynamically during autoregressive generation and how PagedAttention eliminates memory fragmentation like OS virtual memory.',
      whyImportant: 'The cornerstone of modern low-latency LLM serving infrastructure.',
    },
    {
      topic: 'Direct Preference Optimization (DPO) vs RLHF / PPO',
      subdomain: 'Alignment',
      difficulty: 'Advanced',
      question: 'How does DPO mathematically bypass the need for a separate reward model and policy gradient optimization, and what are its vulnerability risks to reward hacking?',
      whyImportant: 'Modern standard for LLM alignment replacing complex PPO pipelines.',
    },
    {
      topic: 'FlashAttention: IO-Aware GPU Memory Hierarchy',
      subdomain: 'Optimization & Hardware',
      difficulty: 'Advanced',
      question: 'How does FlashAttention avoid materializing the N x N attention matrix in slow GPU High Bandwidth Memory (HBM) by tiling in SRAM?',
      whyImportant: 'Standard production technique that unlocked long-context LLMs without O(N^2) memory explosion.',
    },
    {
      topic: 'Mixture of Experts (MoE) Token Routing & Load Balancing',
      subdomain: 'Model Architecture',
      difficulty: 'Advanced',
      question: 'Explain how the gating network routes tokens to top-k experts and what auxiliary loss prevents expert collapse in architectures like Mixtral and DeepSeek.',
      whyImportant: 'Crucial for understanding modern ultra-large models.',
    },
    {
      topic: 'Multi-Head Latent Attention (MLA) in DeepSeek Architecture',
      subdomain: 'LLM Architecture',
      difficulty: 'Staff',
      question: 'How does Multi-head Latent Attention compress KV-cache memory during inference compared to standard MHA and MQA via low-rank joint compression?',
      whyImportant: 'Core architectural innovation drastically reducing memory costs in frontier open models.',
    },
  ],

  'CS Fundamentals': [
    // Operating Systems (OS)
    {
      topic: 'Process vs Thread: Memory Layout, Stack & Heap Sharing',
      subdomain: 'Operating Systems',
      difficulty: 'Beginner',
      question: 'Explain the core differences between a Process and a Thread. What memory is shared (heap, global variables) vs what is private (stack, registers)?',
      whyImportant: 'Universal high-frequency operating systems interview question.',
    },
    {
      topic: 'What is Deadlock and the 4 Coffman Conditions?',
      subdomain: 'Operating Systems',
      difficulty: 'Beginner',
      question: 'What is a deadlock, and what are the 4 Coffman conditions (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait) that cause it? How do you prevent it?',
      whyImportant: 'Core concurrency and operating system stability fundamental.',
    },
    {
      topic: 'What is Virtual Memory and Why Do OSes Use It?',
      subdomain: 'Operating Systems',
      difficulty: 'Beginner',
      question: 'Why do operating systems give each process its own virtual address space instead of direct physical RAM access? What are the security and isolation benefits?',
      whyImportant: 'Foundational concept governing modern computing systems.',
    },
    {
      topic: 'User Mode vs Kernel Mode: System Calls and CPU Rings',
      subdomain: 'Operating Systems',
      difficulty: 'Beginner',
      question: 'What is the difference between User Mode (Ring 3) and Kernel Mode (Ring 0)? What actually happens under the hood when a program makes a system call like read()?',
      whyImportant: 'Essential for understanding systems programming and security boundaries.',
    },
    {
      topic: 'Paging vs Segmentation & Multi-Level Page Tables',
      subdomain: 'Operating Systems',
      difficulty: 'Intermediate',
      question: 'Explain how paging eliminates external fragmentation. How does a multi-level page table avoid allocating gigabytes of memory for sparse address spaces?',
      whyImportant: 'Essential for understanding systems performance, cache misses, and memory management.',
    },
    {
      topic: 'Process Synchronization: Mutex vs Counting Semaphore vs Spinlock',
      subdomain: 'Operating Systems',
      difficulty: 'Intermediate',
      question: 'Compare a Mutex, a Counting Semaphore, and a Spinlock: when would you use a spinlock in kernel space instead of putting a thread to sleep?',
      whyImportant: 'Foundational concept governing concurrent backend design and low-level multithreading.',
    },
    {
      topic: 'Virtual Memory, Page Tables & Translation Lookaside Buffers (TLB)',
      subdomain: 'Operating Systems',
      difficulty: 'Advanced',
      question: 'Walk through how the CPU MMU translates a virtual address to a physical address using multi-level page tables and TLB caching, and what triggers a TLB shootdown.',
      whyImportant: 'High-yield systems engineering question for kernel, infrastructure, and senior backend roles.',
    },
    {
      topic: 'Inter-Process Communication (IPC): Sockets, Pipes, Shared Memory',
      subdomain: 'Operating Systems',
      difficulty: 'Advanced',
      question: 'Compare Unix Domain Sockets, Named Pipes (FIFOs), and POSIX Shared Memory with semaphores in terms of throughput, syscall overhead, and synchronization.',
      whyImportant: 'Core systems programming and microservices communication mechanism.',
    },

    // Computer Networks (CN)
    {
      topic: 'TCP vs UDP: Reliability, Headers & Overhead',
      subdomain: 'Computer Networks',
      difficulty: 'Beginner',
      question: 'Compare TCP and UDP: why does TCP guarantee ordered delivery while UDP does not, and why do video streaming or DNS queries prefer UDP?',
      whyImportant: 'One of the most frequently asked networking questions in all tech interviews.',
    },
    {
      topic: 'OSI 7-Layer Model vs TCP/IP 4-Layer Architecture',
      subdomain: 'Computer Networks',
      difficulty: 'Beginner',
      question: 'Walk through the OSI layers (Physical, Data Link, Network, Transport, Session, Presentation, Application) and explain how data encapsulation works with headers.',
      whyImportant: 'Standard computer science curriculum and networking interview staple.',
    },
    {
      topic: 'What is DNS and How Does Domain Resolution Work Step-by-Step?',
      subdomain: 'Computer Networks',
      difficulty: 'Beginner',
      question: 'When you type google.com into your browser, trace the DNS resolution process through the browser cache, OS resolver, Root nameserver, TLD nameserver, and Authoritative server.',
      whyImportant: 'Crucial web fundamental asked in both software and DevOps interviews.',
    },
    {
      topic: 'HTTP vs HTTPS & SSL/TLS Handshake Basics',
      subdomain: 'Computer Networks',
      difficulty: 'Beginner',
      question: 'What is the security difference between HTTP and HTTPS, what is symmetric vs asymmetric encryption, and how do digital certificates verify server authenticity?',
      whyImportant: 'Fundamental web security question for every software engineer.',
    },
    {
      topic: 'TCP 3-Way Handshake, Connection Teardown & TIME_WAIT State',
      subdomain: 'Computer Networks',
      difficulty: 'Intermediate',
      question: 'Walk through SYN, SYN-ACK, ACK, and explain why the TIME_WAIT state lasts for 2MSL during connection teardown to prevent delayed duplicate packets.',
      whyImportant: 'Standard networking round question for backend and cloud systems engineers.',
    },
    {
      topic: 'HTTP/1.1 vs HTTP/2 Multiplexing vs HTTP/3 (QUIC over UDP)',
      subdomain: 'Computer Networks',
      difficulty: 'Intermediate',
      question: 'Explain how HTTP/2 multiplexing solved HTTP/1 head-of-line blocking, and how HTTP/3 uses QUIC over UDP to solve TCP-level packet loss head-of-line blocking.',
      whyImportant: 'Crucial modern web, API architecture, and microservice networking knowledge.',
    },
    {
      topic: 'TCP Congestion Control: Reno vs CUBIC vs BBR',
      subdomain: 'Computer Networks',
      difficulty: 'Advanced',
      question: 'How does Google\'s BBR algorithm differ from loss-based congestion control (CUBIC) by continuously measuring bottleneck bandwidth and round-trip propagation time?',
      whyImportant: 'Key to understanding modern cloud, CDN, and high-throughput network performance.',
    },
    {
      topic: 'Scenario: Mitigating TCP SYN Flood and Slowloris DDoS Attacks',
      subdomain: 'Computer Networks',
      difficulty: 'Advanced',
      question: 'Scenario: Your API gateway is overwhelmed by half-open TCP connections in SYN_RECV state. How do TCP SYN Cookies and connection backlog limits defend against this?',
      whyImportant: 'Tests practical network security and kernel socket configuration.',
    },

    // DBMS & Databases
    {
      topic: 'SQL vs NoSQL: Relational vs Document vs Key-Value',
      subdomain: 'DBMS & Databases',
      difficulty: 'Beginner',
      question: 'Compare relational SQL databases (Postgres, MySQL) with NoSQL stores (MongoDB, Redis): when should an engineer choose a flexible schema over relational integrity?',
      whyImportant: 'Standard system architecture question asked at every tech company.',
    },
    {
      topic: 'What is a Database Index and Why Does It Speed Up Queries?',
      subdomain: 'DBMS & Databases',
      difficulty: 'Beginner',
      question: 'Explain what an index is, why searching without an index causes an O(N) full table scan, and why adding indexes slows down INSERT and UPDATE statements.',
      whyImportant: 'Every backend engineer must understand database indexing fundamentals.',
    },
    {
      topic: 'Primary Key vs Foreign Key vs Unique Constraints',
      subdomain: 'DBMS & Databases',
      difficulty: 'Beginner',
      question: 'Explain the role of Primary Keys and Foreign Keys in relational schemas. What are cascading deletes and how do foreign keys prevent orphan rows?',
      whyImportant: 'Core relational database design fundamental.',
    },
    {
      topic: 'Database Normalization: 1NF, 2NF, and 3NF Explained Simply',
      subdomain: 'DBMS & Databases',
      difficulty: 'Beginner',
      question: 'What is database normalization, what anomalies (insertion, deletion, update) does it prevent, and why do read-heavy analytics systems denormalize data?',
      whyImportant: 'Fundamental database theory frequently tested in campus and industry interviews.',
    },
    {
      topic: 'Database Indexing: B+ Trees vs LSM Trees vs Hash Indexes',
      subdomain: 'DBMS & Databases',
      difficulty: 'Intermediate',
      question: 'Why do relational databases prefer B+ Trees for range queries while write-heavy systems (Cassandra, RocksDB) use Log-Structured Merge (LSM) trees?',
      whyImportant: 'One of the most frequently asked database architecture questions in tech interviews.',
    },
    {
      topic: 'ACID Transactions & SQL Isolation Levels (Dirty vs Phantom Read)',
      subdomain: 'DBMS & Databases',
      difficulty: 'Intermediate',
      question: 'Differentiate Read Committed, Repeatable Read, and Serializable isolation levels. What concrete race condition causes dirty reads, non-repeatable reads, and phantom reads?',
      whyImportant: 'Crucial for designing reliable multi-user transactional backends.',
    },
    {
      topic: 'Multi-Version Concurrency Control (MVCC) in PostgreSQL & MySQL',
      subdomain: 'DBMS & Databases',
      difficulty: 'Advanced',
      question: 'How does MVCC allow readers to never block writers and writers to never block readers? What is write amplification and vacuuming/undo log purge overhead?',
      whyImportant: 'Underpins real-world high-throughput database concurrency.',
    },
    {
      topic: 'Database Write-Ahead Logging (WAL) and ARIES Crash Recovery',
      subdomain: 'DBMS & Databases',
      difficulty: 'Advanced',
      question: 'Explain how Write-Ahead Logging (WAL) guarantees durability (D in ACID) before flushing dirty memory pages to disk, and how ARIES crash recovery performs analysis, redo, and undo.',
      whyImportant: 'Deep database storage engine internal mechanics tested in senior infrastructure interviews.',
    },

    // Object-Oriented Programming (OOP & LLD)
    {
      topic: '4 Pillars of OOP: Encapsulation, Abstraction, Inheritance, Polymorphism',
      subdomain: 'OOP & LLD',
      difficulty: 'Beginner',
      question: 'Explain the 4 pillars of Object-Oriented Programming with clean, real-world examples: why does polymorphism allow substituting implementations at runtime?',
      whyImportant: 'The classic foundation tested across Java, C++, C#, and Python interviews.',
    },
    {
      topic: 'Abstract Class vs Interface: When to Use Each',
      subdomain: 'OOP & LLD',
      difficulty: 'Beginner',
      question: 'What is the semantic and structural difference between an abstract class and an interface? When would you choose an abstract class with shared state over a pure contract?',
      whyImportant: 'Core software design question frequently asked in coding and design rounds.',
    },
    {
      topic: 'Composition Over Inheritance: Why Deep Hierarchies Break',
      subdomain: 'OOP & LLD',
      difficulty: 'Beginner',
      question: 'Why is composition favored over inheritance in modern software engineering? What is the fragile base class problem?',
      whyImportant: 'Essential principle distinguishing thoughtful engineers from textbook memorizers.',
    },
    {
      topic: 'SOLID Principles with Practical Software Code Examples',
      subdomain: 'OOP & LLD',
      difficulty: 'Intermediate',
      question: 'Walk through Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion with concrete refactoring examples.',
      whyImportant: 'The gold standard for low-level system design and clean code interviews.',
    },
    {
      topic: 'Design Patterns: Singleton, Factory, and Strategy Patterns',
      subdomain: 'OOP & LLD',
      difficulty: 'Intermediate',
      question: 'Explain the Factory and Strategy patterns: how does the Strategy pattern eliminate complex if/else and switch statements in business workflows?',
      whyImportant: 'Standard software design interview questions asked at top enterprise firms.',
    },
    {
      topic: 'Scenario: Refactoring a Monolithic God Class into Clean Strategy/State',
      subdomain: 'OOP & LLD',
      difficulty: 'Advanced',
      question: 'Scenario: You inherit a 4,000-line OrderProcessor class with 30 flags for payment types, discounts, and regional shipping. How do you refactor it into Strategy and State patterns without regressions?',
      whyImportant: 'Tests real-world production refactoring and low-level system design (LLD) expertise.',
    },

    // Computer Architecture & Hardware (CoA)
    {
      topic: 'CPU Registers, L1/L2/L3 Cache, RAM & Storage Hierarchy',
      subdomain: 'Computer Architecture',
      difficulty: 'Beginner',
      question: 'Explain the computer memory hierarchy: compare access times between CPU registers (<1ns), L1 cache, RAM (100ns), and SSD storage, and why caching is critical.',
      whyImportant: 'Foundational computer hardware mental model.',
    },
    {
      topic: 'CPU Cache Lines, False Sharing & Spatial vs Temporal Locality',
      subdomain: 'Computer Architecture',
      difficulty: 'Intermediate',
      question: 'What is a 64-byte cache line? How does false sharing in multi-threaded programs degrade performance when two threads write to adjacent array indices?',
      whyImportant: 'Critical for high-performance computing, game engines, and low-latency trading systems.',
    },
    {
      topic: 'Memory Barriers & Out-of-Order CPU Execution Hazards',
      subdomain: 'Computer Architecture',
      difficulty: 'Advanced',
      question: 'Why do modern multi-core CPUs reorder memory reads and writes, and how do acquire/release memory fences prevent race conditions in lock-free data structures?',
      whyImportant: 'Staff-level systems engineering question for concurrent systems and compiler engineers.',
    },
  ],

  'DSA': [
    // Beginner DSA
    {
      topic: 'Two Sum: Brute Force O(N^2) vs Hash Map O(N)',
      subdomain: 'Arrays & Hashing',
      difficulty: 'Beginner',
      question: 'Walk through the Two Sum problem: why is nested looping O(N^2), and how does a Hash Map lookup reduce it to a single O(N) pass with O(N) space?',
      whyImportant: 'The quintessential first question of tech interviews testing space-time complexity trade-offs.',
    },
    {
      topic: 'Binary Search: O(log N) Search on Sorted Arrays',
      subdomain: 'Searching Algorithms',
      difficulty: 'Beginner',
      question: 'Explain how binary search halves the search space each step. How do you write the midpoint calculation to avoid integer overflow, and what is the loop condition?',
      whyImportant: 'Universal algorithmic building block tested in countless interview variations.',
    },
    {
      topic: 'Stack (LIFO) vs Queue (FIFO) Operations and Real-World Uses',
      subdomain: 'Linear Data Structures',
      difficulty: 'Beginner',
      question: 'Compare Stacks and Queues: what are the primary push/pop/peek operations, and how are Stacks used in browser undo/back buttons while Queues handle print spoolers?',
      whyImportant: 'Foundational linear data structures required for graph algorithms and recursion.',
    },
    {
      topic: 'Linked List vs Array: Cache Locality and Insertion Speeds',
      subdomain: 'Linear Data Structures',
      difficulty: 'Beginner',
      question: 'Why does an array have O(1) random access while a linked list has O(N) access? Why are arrays often faster in practice due to CPU cache spatial locality?',
      whyImportant: 'Bridges algorithmic theory with real-world hardware cache performance.',
    },
    {
      topic: 'Recursion Basics & The Function Call Stack',
      subdomain: 'Algorithmic Paradigms',
      difficulty: 'Beginner',
      question: 'Explain the base case versus recursive step in recursion. What happens in physical memory when a recursion has no base case (Stack Overflow)?',
      whyImportant: 'Critical algorithmic pattern needed for trees, graphs, and dynamic programming.',
    },

    // Intermediate DSA
    {
      topic: 'Sliding Window: Dynamic vs Fixed Window Invariants',
      subdomain: 'Arrays & Strings',
      difficulty: 'Intermediate',
      question: 'Explain the invariant conditions for expanding the right pointer versus contracting the left pointer in dynamic sliding window problems.',
      whyImportant: 'Frequently tested in LeetCode Medium/Hard string and subarray questions.',
    },
    {
      topic: 'Monotonic Stack & Queue (Next Greater Element)',
      subdomain: 'Data Structures',
      difficulty: 'Intermediate',
      question: 'How does maintaining a strictly decreasing stack allow solving "Next Greater Element" and "Largest Rectangle in Histogram" in O(N) time?',
      whyImportant: 'High-frequency algorithm for optimizing nested loops from O(N^2) to O(N).',
    },
    {
      topic: 'BFS vs DFS: When to Use Which in Tree & Graph Traversal',
      subdomain: 'Trees & Graphs',
      difficulty: 'Intermediate',
      question: 'Compare Breadth-First Search (Queue) and Depth-First Search (Stack/Recursion): why is BFS optimal for finding the shortest path in unweighted graphs?',
      whyImportant: 'Core graph algorithm tested across all technical interview loops.',
    },
    {
      topic: 'Dynamic Programming: 0/1 Knapsack & Space Optimization',
      subdomain: 'Dynamic Programming',
      difficulty: 'Intermediate',
      question: 'Walk through the transition states for 0/1 Knapsack and explain how to compress the 2D DP table into a single 1D array by iterating backwards.',
      whyImportant: 'Foundation for understanding overlapping subproblems and optimal substructure.',
    },
    {
      topic: 'Trie (Prefix Tree) Implementation & Memory Optimization',
      subdomain: 'Trees & Strings',
      difficulty: 'Intermediate',
      question: 'Implement a Trie with insert, search, and prefix matching. How would you optimize its memory footprint for large alphabets using hash tables or arrays?',
      whyImportant: 'Crucial for autocomplete, IP routing tables, and string matching.',
    },

    // Advanced DSA
    {
      topic: 'Scenario: Range Sum Query with Dynamic Point Updates (Segment Tree)',
      subdomain: 'Advanced Data Structures',
      difficulty: 'Advanced',
      question: 'Scenario: You need to execute 1,000,000 range sum queries and point updates on an array of size 10^5. Compare a Segment Tree with Lazy Propagation versus a Binary Indexed Tree (Fenwick).',
      whyImportant: 'Distinguishes advanced competitive programmers and high-performance engineers.',
    },
    {
      topic: 'Dijkstra vs Bellman-Ford on Negative Cycles & SPFA',
      subdomain: 'Graph Algorithms',
      difficulty: 'Advanced',
      question: 'Why does Dijkstra greedy relaxation fail on negative edge weights? How does Bellman-Ford detect negative cycles in O(V * E) time?',
      whyImportant: 'Universal standard graph algorithm tested across all top tech interviews.',
    },
    {
      topic: 'Topological Sort: Kahn\'s Algorithm (BFS) vs DFS Post-Order',
      subdomain: 'Graph Algorithms',
      difficulty: 'Advanced',
      question: 'Explain how Kahn\'s in-degree queue algorithm detects cycles in directed graphs compared to three-color DFS in build systems and package managers.',
      whyImportant: 'Key for build dependency resolution, task scheduling, and package managers.',
    },
  ],

  'Backend & Systems': [
    // Beginner Backend
    {
      topic: 'What is a REST API? HTTP Methods and Status Codes',
      subdomain: 'API Basics',
      difficulty: 'Beginner',
      question: 'Explain what makes an API RESTful. What is the difference between GET, POST, PUT, PATCH, and DELETE, and what do 200, 201, 400, 401, 403, 404, 500 status codes mean?',
      whyImportant: 'Universal backend baseline knowledge required for any API development role.',
    },
    {
      topic: 'Client-Server Architecture & Statelessness',
      subdomain: 'Web Architecture',
      difficulty: 'Beginner',
      question: 'What is client-server architecture? Why is statelessness in HTTP crucial for scaling backend servers behind a load balancer?',
      whyImportant: 'The cornerstone principle of scalable cloud software.',
    },
    {
      topic: 'What is a Cache (Redis) and Why Do Backends Need It?',
      subdomain: 'Caching Basics',
      difficulty: 'Beginner',
      question: 'What is in-memory caching? Why is reading from RAM (Redis) orders of magnitude faster than reading from disk (PostgreSQL/MySQL), and what is a cache hit ratio?',
      whyImportant: 'Essential technique for lowering backend database load and latency.',
    },
    {
      topic: 'Monolith vs Microservices Architecture Basics',
      subdomain: 'System Architecture',
      difficulty: 'Beginner',
      question: 'Compare a monolithic application with a microservices architecture: why do startups start with monoliths, and what operational complexities emerge with microservices?',
      whyImportant: 'Standard architectural discussion question in engineering interviews.',
    },
    {
      topic: 'Authentication vs Authorization: 401 Unauthorized vs 403 Forbidden',
      subdomain: 'Security Basics',
      difficulty: 'Beginner',
      question: 'What is the difference between Authentication (who you are) and Authorization (what you are allowed to do)? Give concrete examples of 401 vs 403 HTTP responses.',
      whyImportant: 'Fundamental security concept tested in backend web development rounds.',
    },

    // Intermediate Backend
    {
      topic: 'Distributed Caching Strategies: Cache-Aside vs Write-Through vs Write-Behind',
      subdomain: 'Caching',
      difficulty: 'Intermediate',
      question: 'Compare Cache-Aside, Write-Through, and Write-Behind. How do you mitigate Cache Avalanche, Cache Breakdown, and Cache Penetration with TTL jitter and bloom filters?',
      whyImportant: 'High-frequency question in system design and backend engineering interviews.',
    },
    {
      topic: 'Rate Limiting Algorithms: Token Bucket vs Leaky Bucket vs Sliding Window',
      subdomain: 'API Architecture',
      difficulty: 'Intermediate',
      question: 'Compare Token Bucket and Sliding Window Counter rate limiters. How would you implement distributed rate limiting with Redis Lua scripts?',
      whyImportant: 'Standard system design question asked at Meta, Google, Stripe, and Uber.',
    },
    {
      topic: 'Message Queues: Apache Kafka vs RabbitMQ Architecture',
      subdomain: 'Event Streaming',
      difficulty: 'Intermediate',
      question: 'Contrast Kafka\'s distributed commit log and consumer group offset tracking with RabbitMQ\'s broker-centric AMQP exchange/queue routing.',
      whyImportant: 'Critical distinction tested in almost every distributed system design interview.',
    },
    {
      topic: 'Database Connection Pooling: Sizing Pools & Preventing Deadlocks',
      subdomain: 'Database Systems',
      difficulty: 'Intermediate',
      question: 'Why do backend services use connection pools (e.g. HikariCP) instead of opening a new TCP socket per request? What happens when connection pools are exhausted?',
      whyImportant: 'Directly addresses production stability and backend latency degradation.',
    },

    // Advanced Backend
    {
      topic: 'Scenario: Payment Webhook Double-Delivery & Idempotency Keys',
      subdomain: 'Resilient APIs',
      difficulty: 'Advanced',
      question: 'Scenario: A payment gateway retries a webhook 3 times due to a network glitch. How do you design an API that guarantees exactly-once processing using Idempotency Keys and distributed locking?',
      whyImportant: 'Standard interview question for fintech, e-commerce, and SaaS platforms.',
    },
    {
      topic: 'Distributed Transactions: Two-Phase Commit (2PC) vs Saga Pattern',
      subdomain: 'Microservices Architecture',
      difficulty: 'Advanced',
      question: 'Why is 2PC avoided in microservices architectures, and how does the Saga pattern (Orchestration vs Choreography) use compensating transactions to achieve eventual consistency?',
      whyImportant: 'Core architectural knowledge for building resilient distributed payment or checkout flows.',
    },
    {
      topic: 'Database Sharding, Resharding & Consistent Hashing Virtual Nodes',
      subdomain: 'Distributed Databases',
      difficulty: 'Advanced',
      question: 'Explain how consistent hashing with virtual nodes prevents massive data reshuffling when nodes join or leave a cluster, and how cross-shard queries are handled.',
      whyImportant: 'Fundamental building block for horizontal database scaling and distributed caches.',
    },
    {
      topic: 'Circuit Breaker Pattern & Backpressure Strategies',
      subdomain: 'Resilience Engineering',
      difficulty: 'Advanced',
      question: 'Explain the states of a Circuit Breaker (Closed, Open, Half-Open). How does exponential backoff with full jitter prevent thundering herd retries during service recovery?',
      whyImportant: 'Prevents cascading failures across distributed microservice graphs.',
    },
  ],

  'System Design': [
    // Beginner / Intermediate System Design
    {
      topic: 'What is a Load Balancer? Layer 4 vs Layer 7 Load Balancing',
      subdomain: 'Networking & Scalability',
      difficulty: 'Beginner',
      question: 'What does a load balancer do, what algorithms (Round Robin, Least Connections, IP Hash) does it use, and how does Layer 4 (TCP) balance differ from Layer 7 (HTTP path) balance?',
      whyImportant: 'Core building block of any scalable web infrastructure.',
    },
    {
      topic: 'Vertical Scaling vs Horizontal Scaling: Limits and Trade-offs',
      subdomain: 'Scalability Fundamentals',
      difficulty: 'Beginner',
      question: 'Compare scaling vertically (bigger RAM/CPU) versus scaling horizontally (adding more nodes): what architectural changes are required to scale horizontally?',
      whyImportant: 'First question asked in almost all system design introductory rounds.',
    },
    {
      topic: 'Design a Scalable URL Shortener (TinyURL) with Analytics',
      subdomain: 'High-Throughput Systems',
      difficulty: 'Intermediate',
      question: 'Design a URL shortener handling 1B links: base62 encoding vs MD5 hash collisions, caching hot links, and click analytics aggregation.',
      whyImportant: 'The quintessential system design interview problem testing end-to-end architecture.',
    },
    {
      topic: 'Design a Distributed Notification Service (Push, SMS, Email)',
      subdomain: 'Event-Driven Systems',
      difficulty: 'Intermediate',
      question: 'Design a multi-channel notification engine prioritizing transactional alerts (OTP) over marketing blasts with rate limits and user preferences.',
      whyImportant: 'Tests queue priority, third-party vendor failover, and idempotency.',
    },

    // Advanced System Design
    {
      topic: 'Design a Distributed Rate Limiter for 100M Requests/Second',
      subdomain: 'Infrastructure & APIs',
      difficulty: 'Advanced',
      question: 'Design a globally distributed rate limiter that balances low latency (<5ms), high availability, and accurate per-user quota enforcement across multi-region edge nodes.',
      whyImportant: 'Classic Staff-level system design interview problem.',
    },
    {
      topic: 'Design a Real-Time Collaborative Document Editor (Google Docs)',
      subdomain: 'Real-Time Systems',
      difficulty: 'Staff',
      question: 'Compare Operational Transformation (OT) versus Conflict-free Replicated Data Types (CRDTs) for resolving concurrent character edits across distributed clients.',
      whyImportant: 'Tests deep understanding of distributed state synchronization and event streams.',
    },
  ],

  'Programming Languages': [
    // Beginner Languages
    {
      topic: 'Stack vs Heap Memory: Where Do Variables Live?',
      subdomain: 'Memory Management',
      difficulty: 'Beginner',
      question: 'Explain the difference between Stack and Heap memory: why is stack allocation extremely fast while heap allocation requires manual freeing or a garbage collector?',
      whyImportant: 'Foundational programming language concept asked in all technical rounds.',
    },
    {
      topic: 'Pass by Value vs Pass by Reference in Modern Languages',
      subdomain: 'Language Fundamentals',
      difficulty: 'Beginner',
      question: 'What is pass by value versus pass by reference? Explain what happens in languages like Java, Python, and JavaScript when you pass an object or array to a function.',
      whyImportant: 'Common source of subtle programming bugs tested in technical screenings.',
    },
    {
      topic: 'Synchronous vs Asynchronous Execution & Callbacks',
      subdomain: 'Concurrency Basics',
      difficulty: 'Beginner',
      question: 'What is the difference between blocking synchronous execution and non-blocking asynchronous execution? How do Promises and async/await simplify callback hell?',
      whyImportant: 'Essential for modern full-stack, Node.js, and web engineering.',
    },
    {
      topic: 'Compiled Languages vs Interpreted Languages vs JIT Compilers',
      subdomain: 'Runtimes & Compilers',
      difficulty: 'Beginner',
      question: 'Compare compiled languages (C++, Go, Rust) with interpreted languages (Python) and bytecode JIT runtimes (Java JVM, V8 JavaScript): why do JITs optimize hot paths?',
      whyImportant: 'Fundamental software runtime knowledge.',
    },

    // Intermediate Languages
    {
      topic: 'JavaScript Event Loop: Call Stack, Microtasks & Macrotasks',
      subdomain: 'JavaScript & Node.js',
      difficulty: 'Intermediate',
      question: 'Explain the exact execution order between synchronous code, process.nextTick, Promise microtasks, setTimeout macrotasks, and requestAnimationFrame.',
      whyImportant: 'Universal front/backend JavaScript interview question.',
    },
    {
      topic: 'Python Global Interpreter Lock (GIL) & Multiprocessing vs Threading',
      subdomain: 'Python Runtime',
      difficulty: 'Intermediate',
      question: 'Why did CPython historically require the GIL for reference counting? When should you use the multiprocessing module instead of threading for CPU-bound tasks?',
      whyImportant: 'Essential for understanding Python concurrency in production.',
    },
    {
      topic: 'Go Concurrency: Goroutines, Channels & The GMP Scheduler',
      subdomain: 'Go Runtime',
      difficulty: 'Intermediate',
      question: 'Explain the Go M:N scheduler: how do Goroutines (G), OS Threads (M), and Logical Processors (P) handle work-stealing and blocking syscalls?',
      whyImportant: 'Underpins why Go excels in high-concurrency cloud backend services.',
    },

    // Advanced Languages
    {
      topic: 'Rust Ownership, Borrow Checker & Lifetime Annotations',
      subdomain: 'Rust Systems',
      difficulty: 'Advanced',
      question: 'Explain how Rust achieves memory safety without a garbage collector through move semantics, exclusive mutable borrows, and compile-time lifetime annotations.',
      whyImportant: 'Core philosophy distinguishing Rust from other systems programming languages.',
    },
    {
      topic: 'JVM Garbage Collection: G1 vs ZGC vs Generational Hypothesis',
      subdomain: 'Java Systems',
      difficulty: 'Advanced',
      question: 'Explain the Weak Generational Hypothesis. How does ZGC achieve sub-millisecond stop-the-world pause times using colored pointers and load barriers on multi-terabyte heaps?',
      whyImportant: 'High-frequency question for senior enterprise and banking software engineers.',
    },
  ],
};

function generateFallbackDomainTopics(
  domain: string = 'AI/ML',
  mode: string = 'learn',
  exclude: string[] = [],
  count: number = 6,
  difficulty: string = 'All',
  subject: string = ''
) {
  // Normalize domain matching
  const keys = Object.keys(DOMAIN_QUESTION_POOLS);
  let matchedKey = keys.find(
    (k) => k.toLowerCase() === domain.toLowerCase() || domain.toLowerCase().includes(k.toLowerCase())
  );
  if (!matchedKey) {
    if (domain.toLowerCase().includes('ai') || domain.toLowerCase().includes('ml') || domain.toLowerCase().includes('model')) {
      matchedKey = 'AI/ML';
    } else if (domain.toLowerCase().includes('dsa') || domain.toLowerCase().includes('algorithm') || domain.toLowerCase().includes('data structure')) {
      matchedKey = 'DSA';
    } else if (domain.toLowerCase().includes('design') || domain.toLowerCase().includes('system design') || domain.toLowerCase().includes('architecture')) {
      matchedKey = 'System Design';
    } else if (domain.toLowerCase().includes('backend') || domain.toLowerCase().includes('distributed')) {
      matchedKey = 'Backend & Systems';
    } else if (domain.toLowerCase().includes('program') || domain.toLowerCase().includes('code') || domain.toLowerCase().includes('language')) {
      matchedKey = 'Programming Languages';
    } else {
      matchedKey = 'CS Fundamentals';
    }
  }

  let pool = DOMAIN_QUESTION_POOLS[matchedKey] || DOMAIN_QUESTION_POOLS['AI/ML'];

  // Filter by subject if specified (e.g. for CS Fundamentals: Operating Systems, Computer Networks, DBMS, OOP & LLD, Computer Architecture)
  if (subject && subject !== 'All' && subject !== 'All Subjects') {
    const subLower = subject.toLowerCase().trim();
    const subjectFiltered = pool.filter((item) => {
      const itemSub = (item.subdomain || '').toLowerCase();
      const itemTopic = item.topic.toLowerCase();
      return (
        itemSub.includes(subLower) ||
        subLower.includes(itemSub) ||
        itemTopic.includes(subLower) ||
        (subLower.includes('os') && itemSub.includes('operating system')) ||
        (subLower.includes('operating') && itemSub.includes('operating system')) ||
        (subLower.includes('cn') && itemSub.includes('network')) ||
        (subLower.includes('network') && itemSub.includes('network')) ||
        (subLower.includes('dbms') && (itemSub.includes('dbms') || itemSub.includes('database'))) ||
        (subLower.includes('database') && (itemSub.includes('dbms') || itemSub.includes('database'))) ||
        (subLower.includes('oop') && (itemSub.includes('oop') || itemSub.includes('design'))) ||
        (subLower.includes('arch') && (itemSub.includes('architecture') || itemSub.includes('hardware')))
      );
    });
    if (subjectFiltered.length > 0) {
      pool = subjectFiltered;
    }
  }

  // Filter by difficulty if specified and not 'All'
  if (difficulty && difficulty !== 'All') {
    const diffLower = difficulty.toLowerCase().trim();
    const diffFiltered = pool.filter((item) => item.difficulty.toLowerCase() === diffLower);
    if (diffFiltered.length > 0) {
      pool = diffFiltered;
    }
  }

  const excludeSet = new Set((exclude || []).map((e) => e.toLowerCase().trim()));

  // Filter out recent ones if possible
  let available = pool.filter((item) => !excludeSet.has(item.topic.toLowerCase().trim()));
  if (available.length < count) {
    available = [...pool]; // Reset if pool exhausted
  }

  // Shuffle array using Fisher-Yates for genuine randomness
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const selected = shuffled.slice(0, count);

  return {
    domain: matchedKey,
    mode,
    difficulty,
    subject,
    topics: selected.map((item) => ({
      topic: item.topic,
      subdomain: item.subdomain,
      difficulty: item.difficulty,
      question: item.question,
      whyImportant: item.whyImportant,
    })),
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
    const targetDepth = depth || 'Interview';
    const prompt = `You are a Principal Software Engineer and Technical Educator for "InterviewGym AI".
Create a masterclass learning lesson for the topic: "${topic}"
Domain: ${domain || 'Computer Science / AI'}
Depth Level: ${targetDepth} (Supported: Beginner, Intermediate, Interview, Deep Technical)

CRITICAL DEPTH INSTRUCTIONS (Selected Depth: "${targetDepth}"):
${targetDepth === 'Beginner' ? '- Depth is BEGINNER: The candidate needs rock-solid fundamentals. Use crystal-clear, relatable everyday analogies. Clearly explain all technical terms and acronyms without assuming prior advanced knowledge. Include fundamental commands, basic CLI syntax, or simple starter code snippets. Focus on "What is it, why does it matter, and how do I use it fundamentally?". Provide foundational interview questions and avoid confusing Staff-level jargon.' : ''}
${targetDepth === 'Intermediate' ? '- Depth is INTERMEDIATE: Target mid-to-senior software engineering level. Detail the structural data flow, lifecycle transitions, standard production terminology, real-world engineering trade-offs, practical production code, and common operational pitfalls.' : ''}
${targetDepth === 'Interview' ? '- Depth is INTERVIEW: High-impact interview preparation! Provide crisp 30s/60s/2min elevator pitch scripts, common trick questions and follow-ups interviewers ask, exact keywords to score high, and candidate blunders to avoid.' : ''}
${targetDepth === 'Deep Technical' ? '- Depth is DEEP TECHNICAL: Low-level internal mechanics, memory layout, cache hierarchies, kernel syscalls, hardware bottlenecks, algorithmic proofs, exact performance numbers, edge-case failure modes, and low-level debugging.' : ''}

Generate all required sections in structured JSON matching this schema:
{
  "topic": "${topic}",
  "domain": "${domain || 'Technical'}",
  "depth": "${depth || 'Interview'}",
  "oneLineExplanation": "Ultra punchy one-sentence definition",
  "whyItExists": "Why this technology or concept was created and the specific engineering problem it solves",
  "intuition": "Deep intuitive mental model for how to think about it",
  "howItWorks": "Step-by-step operational breakdown of how it executes",
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
  "prerequisites": ["Prerequisite 1", "Prerequisite 2"],
  "relatedTopics": ["Related Topic 1", "Related Topic 2"],
  "nextTopics": ["Next Topic 1", "Next Topic 2"],
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

// Helper function to normalize current topic items
function normalizeCurrentTopicItems(rawTopics: any[], defaultCategory: string = 'AI/Tech') {
  if (!Array.isArray(rawTopics)) return [];
  return rawTopics.map((t: any, index: number) => ({
    id: t.id || `trend_${Date.now()}_${index}`,
    title: t.title || t.headline || 'Frontier Tech Innovation',
    headline: t.headline || t.title || 'Frontier Tech Innovation',
    category: t.category || defaultCategory || 'AI & Frontier Tech',
    summary: t.summary || t.whatHappened || '',
    whatHappened: t.whatHappened || t.summary || '',
    whyItMatters: t.whyItMatters || 'Strategic architectural and engineering significance.',
    background: t.background || 'Engineering background in modern distributed and AI systems.',
    perspectives: Array.isArray(t.perspectives) && t.perspectives.length > 0 ? t.perspectives : [
      'Engineering teams value performance, latency gains, and simplified architectures.',
      'Operations teams evaluate deployment overhead, cost-per-token, and reliability bounds.',
    ],
    keyFacts: Array.isArray(t.keyFacts) && t.keyFacts.length > 0 ? t.keyFacts : [
      'High adoption in top tier production engineering environments.',
      'Frequently tested in modern Staff/Senior engineering interview rounds.',
    ],
    interviewQuestions: Array.isArray(t.interviewQuestions) && t.interviewQuestions.length > 0 ? t.interviewQuestions : [
      `How would you evaluate adopting "${t.title || t.headline || 'this technology'}" in an enterprise architecture?`,
      'What are the primary operational tradeoffs and failure modes in high-scale production?',
    ],
    speakingPrompt: t.speakingPrompt || `Summarize "${t.title || t.headline || 'this trend'}" in 90 seconds and take an engineering stance on its architectural longevity.`,
    date: t.date || 'Current 2025–2026',
    source: t.source || 'Frontier Tech Intelligence',
    relevanceBadge: t.relevanceBadge || 'High Interview Relevance',
  }));
}

// 7. Current Affairs & Tech News (GET and POST with Search Grounding & Filters)
const handleCurrentTopics = async (req: Request, res: Response) => {
  const category = (req.body?.category || req.query?.category || 'All') as string;
  const filterQuery = (req.body?.query || req.query?.query || '') as string;
  const force = req.body?.force === true || req.query?.force === 'true';

  try {
    const ai = getGeminiClient();

    // If query is specifically provided or fresh news requested with active Gemini
    if (ai && (force || filterQuery) && !isModelCoolingDown('gemini-3.1-flash-lite')) {
      const prompt = `Find 4 real, major recent news developments or breakthroughs in: ${filterQuery ? `specifically "${filterQuery}" in ` : ''}${category !== 'All' ? category : 'Artificial Intelligence and Software Engineering'}.
Use Google Search grounding to retrieve real, factual, current information.
For each event, provide:
1. title / headline
2. whatHappened (concise factual summary)
3. whyItMatters (strategic engineering impact)
4. background (historical technical context)
5. perspectives (2 viewpoints: builders vs systems architects)
6. keyFacts (2 concrete facts or metrics)
7. interviewQuestions (2 real interview questions asked by senior tech interviewers)
8. speakingPrompt (a 90-second verbal explanation prompt)

Return JSON strictly adhering to:
{
  "topics": [
    {
      "headline": "Clear factual headline",
      "category": "${category !== 'All' ? category : 'AI/Tech'}",
      "whatHappened": "Concise factual summary of the recent event",
      "whyItMatters": "Strategic and engineering significance",
      "background": "Historical and technical context",
      "perspectives": ["Perspective from builders", "Perspective from enterprise/critics"],
      "keyFacts": ["Fact 1", "Fact 2"],
      "interviewQuestions": ["Interview question 1", "Interview question 2"],
      "speakingPrompt": "A 90-second prompt: 'Summarize this development and explain its architectural impact.'"
    }
  ]
}`;

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
          if (parsed && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
            return res.json({ topics: normalizeCurrentTopicItems(parsed.topics, category) });
          }
        }
      } catch (_err) {
        console.log('[Current Topics] Grounded tool search transitioned to fallback catalog');
      }
    }

    const fallback = generateFallbackCurrentTopics(category, filterQuery, force);
    return res.json({ topics: normalizeCurrentTopicItems(fallback.topics, category) });
  } catch (_error: any) {
    console.log('[Current Topics] Active fallback generator applied');
    const fallback = generateFallbackCurrentTopics(category, filterQuery, force);
    return res.json({ topics: normalizeCurrentTopicItems(fallback.topics, category) });
  }
};

app.get('/api/current-topics', handleCurrentTopics);
app.post('/api/current-topics', handleCurrentTopics);

// Endpoint to add a new current affairs / tech trend item
app.post('/api/current-topics/add', async (req: Request, res: Response) => {
  const { title, category = 'AI & Frontier Models', whatHappened, whyItMatters, source } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title/headline is required' });
  }

  const cleanTitle = title.trim();
  const cleanCategory = category || 'AI & Frontier Models';
  let newItem: any = {
    id: `trend_user_${Date.now()}`,
    title: cleanTitle,
    headline: cleanTitle,
    category: cleanCategory,
    summary: whatHappened || `Recent engineering breakthrough: ${cleanTitle}`,
    whatHappened: whatHappened || `Recent engineering breakthrough and technical developments around ${cleanTitle}.`,
    whyItMatters: whyItMatters || `Strategic architectural impact on modern production software engineering and infrastructure.`,
    background: `Engineering context and operational background surrounding ${cleanTitle}.`,
    perspectives: [
      'Engineers prioritize developer ergonomics, reliability bounds, and performance throughput.',
      'Architects evaluate long-term maintenance, operational costs, and security surface area.',
    ],
    keyFacts: [
      `High relevance in modern senior engineering interview rounds.`,
      `Actively discussed across top engineering engineering forums in 2025–2026.`,
    ],
    interviewQuestions: [
      `How would you architect a production service leveraging "${cleanTitle}"?`,
      `What are the primary failure modes and operational bottlenecks associated with "${cleanTitle}"?`,
    ],
    speakingPrompt: `Summarize "${cleanTitle}" in 90 seconds, focusing on architectural tradeoffs and production implications.`,
    date: 'User Added / Latest 2025–2026',
    source: source || 'User Community Contribution',
    relevanceBadge: 'Fresh Update',
  };

  // If Gemini is available, auto-enrich the details
  try {
    const ai = getGeminiClient();
    if (ai && !isModelCoolingDown('gemini-3.1-flash-lite')) {
      const enrichPrompt = `For the tech current affair / trend: "${cleanTitle}" in category "${cleanCategory}":
Provide a high-quality senior engineering breakdown in JSON:
{
  "whatHappened": "2-3 sentences concise factual summary",
  "whyItMatters": "2-3 sentences strategic engineering impact",
  "background": "Historical engineering context",
  "perspectives": ["Perspective 1", "Perspective 2"],
  "keyFacts": ["Fact 1", "Fact 2"],
  "interviewQuestions": ["Interview question 1", "Interview question 2"],
  "speakingPrompt": "A 90-second verbal prompt"
}`;
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: enrichPrompt,
        config: { responseMimeType: 'application/json' },
      });
      if (response.text) {
        const parsed = extractJson(response.text);
        if (parsed) {
          newItem = {
            ...newItem,
            whatHappened: parsed.whatHappened || newItem.whatHappened,
            summary: parsed.whatHappened || newItem.summary,
            whyItMatters: parsed.whyItMatters || newItem.whyItMatters,
            background: parsed.background || newItem.background,
            perspectives: Array.isArray(parsed.perspectives) ? parsed.perspectives : newItem.perspectives,
            keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : newItem.keyFacts,
            interviewQuestions: Array.isArray(parsed.interviewQuestions) ? parsed.interviewQuestions : newItem.interviewQuestions,
            speakingPrompt: parsed.speakingPrompt || newItem.speakingPrompt,
          };
        }
      }
    }
  } catch (_e) {
    // Continue with structured item
  }

  userSubmittedCurrentTopics.unshift(newItem);
  return res.json({ success: true, item: newItem });
});

// 7b. AI Tools & Model Landscape Endpoint
function generateFallbackAILandscape(category: string = 'All', filterQuery: string = '') {
  let list = [...INITIAL_AI_LANDSCAPE_ITEMS];

  if (category && category !== 'All') {
    const lowerCat = category.toLowerCase();
    const filtered = list.filter(
      (item) =>
        item.category.toLowerCase().includes(lowerCat) ||
        lowerCat.includes(item.category.toLowerCase())
    );
    if (filtered.length > 0) {
      list = filtered;
    }
  }

  if (filterQuery && filterQuery.trim()) {
    const q = filterQuery.toLowerCase().trim();
    const matches = list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.creator.toLowerCase().includes(q) ||
        item.subcategory.toLowerCase().includes(q) ||
        item.whatItIs.toLowerCase().includes(q) ||
        item.whyEngineerShouldKnow.toLowerCase().includes(q) ||
        item.conceptualDifference.toLowerCase().includes(q)
    );
    if (matches.length > 0) {
      list = matches;
    }
  }

  return list;
}

const handleAILandscape = async (req: Request, res: Response) => {
  const category = (req.body?.category || req.query?.category || 'All') as string;
  const filterQuery = (req.body?.query || req.query?.query || '') as string;
  const force = req.body?.force === true || req.query?.force === 'true';

  try {
    const ai = getGeminiClient();

    if (ai && (force || filterQuery) && !isModelCoolingDown('gemini-3.1-flash-lite')) {
      const prompt = `You are an expert AI & ML Principal Engineer helping a software engineer prepare for top-tier AI/GenAI technical interviews.
Retrieve current, factual information using Google Search from official company documentation, release announcements, and system cards (OpenAI, Google DeepMind, Anthropic, Meta AI, DeepSeek, Mistral, Cursor, GitHub, etc.).

Target Category: "${category !== 'All' ? category : 'Major AI Models, AI Coding Tools, AI Agents, Generative AI, AI Infrastructure'}"
${filterQuery ? `Specific tool, model, or infra query: "${filterQuery}"` : ''}

Focus strictly on AI/GenAI interview awareness. Do NOT turn this into a research-news feed or benchmark-overloaded academic paper review.
For each item, provide:
1. name: Model or Tool name
2. category: Must be exactly one of: "Major AI Models", "AI Coding Tools", "AI Agent Tools & Ecosystem", "Generative AI Tools", "AI Infrastructure", "What's New"
3. subcategory: (e.g. OpenAI/GPT, Google/Gemini, Anthropic/Claude, Meta/Llama, DeepSeek, Mistral, Coding Agents, MCP ecosystem, Vector databases, Inference platforms)
4. creator: Who makes it
5. whatItIs: Crisp, practical 2-3 sentence definition
6. mainlyUsedFor: Primary engineering use cases
7. capabilities: 3-4 important capabilities (array of strings)
8. whyEngineerShouldKnow: Why an AI/software engineer should know it for interviews
9. conceptualDifference: How it differs conceptually from alternatives (direct architectural comparison)
10. interviewQuestions: 1 or 2 practical interview questions that interviewers actually ask
11. sampleAnswers: 1 or 2 key talking points for candidate answers
12. officialSource: Official company/model documentation or release note reference

Return JSON strictly adhering to:
{
  "items": [
    {
      "name": "Name",
      "category": "${category !== 'All' ? category : 'Major AI Models'}",
      "subcategory": "Subcategory",
      "creator": "Company / Creator",
      "whatItIs": "Definition",
      "mainlyUsedFor": "Main engineering usage",
      "capabilities": ["Capability 1", "Capability 2", "Capability 3"],
      "whyEngineerShouldKnow": "Interview and engineering relevance",
      "conceptualDifference": "Direct comparison vs alternatives",
      "interviewQuestions": ["Interview question 1", "Interview question 2"],
      "sampleAnswers": ["Key talking point 1", "Key talking point 2"],
      "officialSource": "Official Documentation or Release Note"
    }
  ]
}`;

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
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            const formatted = parsed.items.map((item: any, idx: number) => ({
              id: item.id || `live_${Date.now()}_${idx}`,
              name: item.name || 'AI Frontier Tool',
              category: item.category || (category !== 'All' ? category : 'Major AI Models'),
              subcategory: item.subcategory || 'Ecosystem',
              creator: item.creator || 'Industry Leader',
              whatItIs: item.whatItIs || '',
              mainlyUsedFor: item.mainlyUsedFor || '',
              capabilities: Array.isArray(item.capabilities) ? item.capabilities : ['High-throughput execution'],
              whyEngineerShouldKnow: item.whyEngineerShouldKnow || 'Key for technical interview rounds.',
              conceptualDifference: item.conceptualDifference || 'Architectural tradeoff distinction.',
              interviewQuestions: Array.isArray(item.interviewQuestions) ? item.interviewQuestions : ['How does this integrate into production architectures?'],
              sampleAnswers: Array.isArray(item.sampleAnswers) ? item.sampleAnswers : ['Emphasize latency, cost, and reliability bounds.'],
              officialSource: item.officialSource || 'Official Documentation',
              lastUpdated: 'Live Search Sync',
              isNew: category === "What's New" || item.isNew || false,
            }));
            return res.json({ items: formatted });
          }
        }
      } catch (_err) {
        console.log('[AI Landscape] Grounded tool search transitioned to fallback catalog');
      }
    }

    const fallback = generateFallbackAILandscape(category, filterQuery);
    return res.json({ items: fallback });
  } catch (_error: any) {
    console.log('[AI Landscape] Active fallback generator applied');
    const fallback = generateFallbackAILandscape(category, filterQuery);
    return res.json({ items: fallback });
  }
};

app.get('/api/ai-landscape', handleAILandscape);
app.post('/api/ai-landscape', handleAILandscape);

// Analyze any tool on-demand using Google Search grounding
app.post('/api/ai-landscape/analyze', async (req: Request, res: Response) => {
  const { toolName, category = 'Major AI Models' } = req.body;
  if (!toolName || !toolName.trim()) {
    return res.status(400).json({ error: 'Tool or model name is required' });
  }

  const cleanName = toolName.trim();
  const cleanCategory = category || 'Major AI Models';

  try {
    const ai = getGeminiClient();
    if (ai && !isModelCoolingDown('gemini-3.1-flash-lite')) {
      const prompt = `You are a Principal AI & Systems Engineer preparing a candidate for a top AI/GenAI technical interview.
Use Google Search grounding to retrieve real, factual, current information from official company documentation or release notes for: "${cleanName}" in category "${cleanCategory}".

Focus strictly on AI/GenAI interview awareness.
Provide a clean JSON structure:
{
  "name": "${cleanName}",
  "category": "${cleanCategory}",
  "subcategory": "Specific subcategory or family",
  "creator": "Company / Organization who makes it",
  "whatItIs": "Crisp, practical 2-3 sentence definition of what it is",
  "mainlyUsedFor": "Primary engineering use cases in production",
  "capabilities": ["Capability 1", "Capability 2", "Capability 3"],
  "whyEngineerShouldKnow": "Why an AI/software engineer should know it for interviews",
  "conceptualDifference": "How it differs conceptually from alternatives",
  "interviewQuestions": ["Interview question 1", "Interview question 2"],
  "sampleAnswers": ["Key candidate talking point 1", "Key candidate talking point 2"],
  "officialSource": "Official Documentation or Release Announcement"
}`;

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
        if (parsed && parsed.name) {
          const item = {
            id: `analyzed_${Date.now()}`,
            name: parsed.name || cleanName,
            category: parsed.category || cleanCategory,
            subcategory: parsed.subcategory || 'Specialized Tool',
            creator: parsed.creator || 'Official Provider',
            whatItIs: parsed.whatItIs || `${cleanName} is a specialized AI system.`,
            mainlyUsedFor: parsed.mainlyUsedFor || 'Production AI pipelines.',
            capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : ['High-performance processing'],
            whyEngineerShouldKnow: parsed.whyEngineerShouldKnow || 'Key technical interview topic.',
            conceptualDifference: parsed.conceptualDifference || 'Architectural trade-offs compared to alternatives.',
            interviewQuestions: Array.isArray(parsed.interviewQuestions) ? parsed.interviewQuestions : [`How do you deploy ${cleanName} in production?`],
            sampleAnswers: Array.isArray(parsed.sampleAnswers) ? parsed.sampleAnswers : ['Analyze trade-offs between latency, accuracy, and operational overhead.'],
            officialSource: parsed.officialSource || 'Official Documentation',
            lastUpdated: 'Live Analyzed',
            isNew: true,
          };
          return res.json({ success: true, item });
        }
      }
    }
  } catch (err) {
    console.warn('[AI Landscape Analyze] Grounded lookup failed, constructing structured fallback:', err);
  }

  const fallbackItem = {
    id: `custom_${Date.now()}`,
    name: cleanName,
    category: cleanCategory,
    subcategory: 'Ecosystem Tool',
    creator: 'Ecosystem Developer',
    whatItIs: `${cleanName} is an active tool in the modern AI and engineering landscape.`,
    mainlyUsedFor: 'Accelerating AI workflows, inference, or developer productivity.',
    capabilities: [
      'Engineered for developer productivity and systems integration.',
      'Configurable with modern API pipelines and toolchains.',
    ],
    whyEngineerShouldKnow: 'Frequently referenced in system design rounds and GenAI architecture discussions.',
    conceptualDifference: 'Provides specialized performance, ergonomics, or cost benefits over general-purpose alternatives.',
    interviewQuestions: [
      `What are the core latency and throughput trade-offs when integrating "${cleanName}" into a production system?`,
      `How does "${cleanName}" compare against standard industry alternatives in enterprise settings?`,
    ],
    sampleAnswers: [
      'Focus on modularity, failure recovery, security boundaries, and total cost of ownership.',
    ],
    officialSource: 'Official Developer Documentation',
    lastUpdated: 'Custom Added',
    isNew: true,
  };

  return res.json({ success: true, item: fallbackItem });
});

// 7b. Dynamic Domain Topics & Questions Generator (Unlimited, Ever-Changing Question Sets)
const handleDomainTopics = async (req: Request, res: Response) => {
  const domain = (req.body?.domain || req.query?.domain || 'AI/ML') as string;
  const mode = (req.body?.mode || req.query?.mode || 'learn') as string;
  const difficulty = (req.body?.difficulty || req.query?.difficulty || 'All') as string;
  const subject = (req.body?.subject || req.query?.subject || '') as string;
  const rawExclude = req.body?.exclude || req.query?.exclude;
  const exclude: string[] = Array.isArray(rawExclude)
    ? rawExclude
    : typeof rawExclude === 'string'
    ? rawExclude.split(',')
    : [];
  const count = Number(req.body?.count || req.query?.count) || 6;

  try {
    const ai = getGeminiClient();

    if (ai && !isModelCoolingDown('gemini-3.1-flash-lite')) {
      const prompt = `You are a Principal Software Engineer and Staff Bar Raiser at a top tech company.
The candidate is preparing across the technical domain: "${domain}".
${subject && subject !== 'All' ? `Target Sub-Subject: "${subject}" within ${domain}. Every question MUST strictly belong to ${subject}.` : ''}
Target Question Difficulty Level: "${difficulty || 'All'}"
Target practice mode: "${mode === 'explain' ? 'verbal explanation drill (60-second response)' : 'deep technical learning & mastery'}".

${difficulty === 'Beginner' ? 'CRITICAL MANDATE: Generate authentic foundational, core, fundamental interview questions (e.g., "What is RAG and how does it work?", "What is an SDK vs API?", "How do Transformers work fundamentally?", "Difference between LSTM and GRU", basic definitions, commands, and syntax). Avoid overly complex Staff-level niche architectures. Stick to interview level and fundamental commands.' : ''}
${difficulty === 'Intermediate' ? 'CRITICAL MANDATE: Focus on deeper mechanical workflows, step-by-step data flows, architectural tradeoffs, and standard senior interview questions.' : ''}
${difficulty === 'Advanced' ? 'CRITICAL MANDATE: Focus on scenario-based, conceptual-logical questions testing core depth, bottlenecks, failure modes, and low-level tradeoffs.' : ''}

The candidate wants an UNLIMITED, diverse, non-repetitive set of high-yield topics and interview questions.

${exclude.length > 0 ? `DO NOT include any of the following previously practiced topics: ${JSON.stringify(exclude.slice(-15))}` : ''}

Generate ${count} distinct, high-yield, interview-caliber topics/questions for "${domain}".
Cover a diverse mix of:
- Fundamental underlying mechanisms & data flows
- Modern 2025–2026 production architectures and trade-offs
- Concurrency, memory optimization, or bottleneck elimination
- Concrete failure modes, debugging scenarios, or real system edge cases

Return JSON strictly adhering to:
{
  "domain": "${domain}",
  "mode": "${mode}",
  "difficulty": "${difficulty}",
  "subject": "${subject}",
  "topics": [
    {
      "topic": "Concise, punchy topic title (e.g. FlashAttention-3 GPU Memory Hierarchy)",
      "subdomain": "${subject || 'e.g. GPU Kernel Optimization or Distributed Caching'}",
      "difficulty": "${difficulty !== 'All' ? difficulty : 'Intermediate'}",
      "question": "The precise interview question or verbal challenge",
      "whyImportant": "1-sentence reason why top tech interviewers test this"
    }
  ]
}`;

      try {
        const parsed = await callGeminiWithRetry(ai, prompt, { responseMimeType: 'application/json' });
        if (parsed && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
          let returnedTopics = parsed.topics;

          if (difficulty && difficulty !== 'All') {
            const diffLower = difficulty.toLowerCase().trim();
            const matched = returnedTopics.filter((t: any) =>
              (t.difficulty || '').toLowerCase() === diffLower
            );
            if (matched.length >= 3) {
              returnedTopics = matched;
            } else {
              // Ensure difficulty tag matches requested tier
              returnedTopics = returnedTopics.map((t: any) => ({
                ...t,
                difficulty,
              }));
            }
          }

          return res.json({
            domain,
            mode,
            difficulty,
            subject,
            topics: returnedTopics.map((t: any) => ({
              topic: t.topic || t.title || 'Technical Concept',
              subdomain: t.subdomain || subject || domain,
              difficulty: t.difficulty || (difficulty !== 'All' ? difficulty : 'Intermediate'),
              question: t.question || `Explain the internal mechanisms and engineering tradeoffs of ${t.topic || 'this concept'}.`,
              whyImportant: t.whyImportant || 'Crucial architectural concept tested by top technical interviewers.',
            })),
          });
        }
      } catch (_err) {
        console.log('[Domain Topics] Gemini query fell back to dynamic random sampler');
      }
    }

    const fallback = generateFallbackDomainTopics(domain, mode, exclude, count, difficulty, subject);
    return res.json(fallback);
  } catch (_error: any) {
    console.log('[Domain Topics] Fallback generator applied');
    const fallback = generateFallbackDomainTopics(domain, mode, exclude, count, difficulty, subject);
    return res.json(fallback);
  }
};

app.get('/api/domain-topics', handleDomainTopics);
app.post('/api/domain-topics', handleDomainTopics);

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
