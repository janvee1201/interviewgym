export type NavigationTab =
  | 'dashboard'
  | 'speaking'
  | 'learn'
  | 'explain'
  | 'interview'
  | 'quick'
  | 'debate'
  | 'current'
  | 'progress'
  | 'history';

export interface SpecificCorrection {
  whatYouSaid: string;
  whatsWrong: string;
  betterVersion: string;
  whyItsBetter: string;
}

export interface FillerWordOccurrence {
  word: string;
  count: number;
  examples: string[];
}

export interface SpeechEvaluation {
  overallScore: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  structure: number;
  confidence: number;
  contentRelevance: number;
  technicalDepth?: number;
  
  // Specific English Feedback
  corrections: SpecificCorrection[];
  recurringIssues?: string[];
  
  // Filler Analysis
  fillerWordsCount: number;
  fillerBreakdown: FillerWordOccurrence[];
  
  // Speed & Pacing
  wordCount: number;
  durationSeconds: number;
  wpm: number;
  pacingFeedback: string;
  
  // Pressure Analysis
  pressureScore: number;
  pressureSignals: string[];
  pressureFeedback: string;
  
  // Communication
  strengths: string[];
  weaknesses: string[];
  improvedSummary: string;
  recommendedPractice: string;
  distinctionNote?: string; // e.g. "Knew concept, explained poorly"
}

export interface ConceptClassification {
  concept: string;
  status: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT' | 'MISSING' | 'MISLEADING';
  comment: string;
}

export interface ExplainEvaluation {
  overallScore: number;
  technicalCorrectness: number;
  conceptualDepth: number;
  logicalStructure: number;
  useOfExamples: number;
  englishAndCommunication: number;
  confidence: number;
  
  classifications: ConceptClassification[];
  whatExplainedCorrectly: string[];
  whatMissed: string[];
  whatMisunderstood: string[];
  whatToInclude: string[];
  
  idealAnswer: string;
  distinctionDiagnosis: 'KNEW_AND_EXPLAINED_WELL' | 'KNEW_BUT_EXPLAINED_POORLY' | 'CONCEPTUAL_GAPS_PRESENT' | 'DID_NOT_KNOW';
  diagnosisExplanation: string;
  recommendedFollowup: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TechnicalLesson {
  topic: string;
  domain: string;
  depth: 'Beginner' | 'Intermediate' | 'Interview' | 'Deep Technical';
  oneLineExplanation: string;
  whyItExists?: string;
  intuition?: string;
  howItWorks?: string;
  laymanExplanation: string;
  technicalExplanation: string;
  coreConcepts: string[];
  architectureOrFlow: string;
  importantTerminology: { term: string; definition: string }[];
  practicalExample: string;
  realWorldUseCases: string[];
  commonMisconceptions: string[];
  relatedTopics?: string[];
  prerequisites?: string[];
  nextTopics?: string[];
  interviewRelevance?: number;
  interviewQuestions: string[];
  followUpQuestions: string[];
  commonMistakesCandidatesMake: string[];
  thirtySecondExplanation: string;
  sixtySecondExplanation: string;
  twoMinuteExplanation: string;
  quickRevision: string[];
  quiz: QuizQuestion[];
  trustedSources: { title: string; url: string; type: string }[];
}

export interface InterviewMessage {
  id: string;
  sender: 'interviewer' | 'candidate';
  text: string;
  timestamp: number;
  score?: number;
  feedbackSnippet?: string;
  followUpTrigger?: string;
  isPressureTactic?: boolean;
}

export interface InterviewScorecard {
  overallScore: number;
  technicalKnowledge: number;
  problemSolving: number;
  communication: number;
  english: number;
  confidence: number;
  pressureHandling: number;
  projectKnowledge: number;
  hrBehavioral: number;
  
  strongestAreas: string[];
  weakestAreas: string[];
  questionsAnsweredPoorly: { question: string; reason: string }[];
  questionsHesitated: string[];
  conceptsToRevise: string[];
  communicationMistakes: string[];
  recommendedNextSession: string;
}

export interface InterviewSession {
  id: string;
  createdAt: number;
  role: string;
  type: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  durationMinutes: number;
  pressureMode: boolean;
  messages: InterviewMessage[];
  scorecard?: InterviewScorecard;
  projectContext?: string;
}

export interface SpeakingSessionRecord {
  id: string;
  createdAt: number;
  topic: string;
  topicType: string;
  timeLimitSeconds: number;
  actualDurationSeconds: number;
  transcript: string;
  evaluation: SpeechEvaluation;
  pressureMode: boolean;
}

export interface ExplainSessionRecord {
  id: string;
  createdAt: number;
  topic: string;
  domain: string;
  transcript: string;
  evaluation: ExplainEvaluation;
}

export type AILandscapeCategory =
  | 'Major AI Models'
  | 'AI Coding Tools'
  | 'AI Agent Tools & Ecosystem'
  | 'Generative AI Tools'
  | 'AI Infrastructure'
  | "What's New";

export interface AILandscapeItem {
  id: string;
  name: string;
  category: AILandscapeCategory;
  subcategory: string;
  creator: string; // Who makes it
  whatItIs: string; // What it is
  mainlyUsedFor: string; // What it is mainly used for
  capabilities: string[]; // Important capabilities
  whyEngineerShouldKnow: string; // Why an AI/software engineer should know it
  conceptualDifference: string; // How it differs conceptually from alternatives
  interviewQuestions: string[]; // One or two interview questions
  sampleAnswers?: string[]; // Recommended interview points
  officialSource?: string; // Official company / model documentation or announcement
  lastUpdated?: string;
  isNew?: boolean;
}

export interface CurrentTopicItem {
  id?: string;
  title: string;
  headline?: string;
  category: string;
  summary: string;
  whatHappened?: string;
  whyItMatters: string;
  background?: string;
  perspectives?: string[];
  keyFacts?: string[];
  interviewQuestions: string[];
  speakingPrompt?: string;
  date?: string;
  source?: string;
  relevanceBadge?: string;
}

export interface DomainTopicItem {
  topic: string;
  subdomain?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Staff';
  question?: string;
  whyImportant?: string;
}

export interface UserPerformanceProfile {
  targetRole?: string;
  experienceLevel?: string;
  targetCompanies?: string[];

  speakingFluency: number;
  englishGrammar: number;
  vocabulary: number;
  pronunciationClarity: number;
  answerStructure: number;
  technicalKnowledge: number;
  technicalExplanation: number;
  interviewPerformance: number;
  confidenceUnderPressure: number;
  hrBehavioral: number;
  
  streakDays: number;
  lastActiveDate: string;
  totalSessionsCompleted: number;
  totalSpeakingMinutes: number;
  
  weakestSkill: string;
  strongestSkill: string;
  recommendedPractice: string;
  
  fillerWordsHistory: { sessionDate: string; count: number }[];
  scoresHistory: { sessionDate: string; overall: number; type: string }[];
  
  learnedTopics: { topic: string; domain: string; learnedAt: number; masteryScore: number }[];
  weakTopics: string[];
}

export interface DailyPlanItem {
  durationMinutes: number;
  title: string;
  mode: NavigationTab;
  description: string;
  params?: Record<string, any>;
  completed?: boolean;
}

export interface DailyPlan {
  date: string;
  totalMinutes: number;
  focusArea: string;
  items: DailyPlanItem[];
}
