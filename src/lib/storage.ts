import {
  UserPerformanceProfile,
  SpeakingSessionRecord,
  ExplainSessionRecord,
  InterviewSession,
  DailyPlan,
} from '../types';
import { auth } from './firebase';
import {
  persistUserProfile,
  persistSpeakingSession,
  persistExplainSession,
  persistInterviewSession,
  fetchUserProfile,
  fetchSpeakingSessions,
  fetchExplainSessions,
  fetchInterviewSessions,
  EMPTY_USER_PROFILE,
} from './firestoreStorage';

const PROFILE_KEY = 'interviewgym_user_profile_v1';
const SPEAKING_SESSIONS_KEY = 'interviewgym_speaking_sessions_v1';
const EXPLAIN_SESSIONS_KEY = 'interviewgym_explain_sessions_v1';
const INTERVIEW_SESSIONS_KEY = 'interviewgym_interview_sessions_v1';
const DAILY_PLAN_KEY = 'interviewgym_daily_plan_v1';

export const DEFAULT_PROFILE: UserPerformanceProfile = {
  speakingFluency: 0,
  englishGrammar: 0,
  vocabulary: 0,
  pronunciationClarity: 0,
  answerStructure: 0,
  technicalKnowledge: 0,
  technicalExplanation: 0,
  interviewPerformance: 0,
  confidenceUnderPressure: 0,
  hrBehavioral: 0,

  streakDays: 0,
  lastActiveDate: '',
  totalSessionsCompleted: 0,
  totalSpeakingMinutes: 0,

  weakestSkill: 'Not enough data yet',
  strongestSkill: 'Not enough data yet',
  recommendedPractice: 'Start your first session to build your progress.',

  fillerWordsHistory: [],
  scoresHistory: [],
  learnedTopics: [],
  weakTopics: [],
};

/**
 * Sync all user data from Firestore into local cache
 */
export async function syncUserDataWithFirestore(userId: string): Promise<UserPerformanceProfile> {
  if (!userId) return getProfile();

  try {
    const cloudProfile = await fetchUserProfile(userId);
    const cloudSpeaking = await fetchSpeakingSessions(userId);
    const cloudExplain = await fetchExplainSessions(userId);
    const cloudInterview = await fetchInterviewSessions(userId);

    localStorage.setItem(PROFILE_KEY, JSON.stringify(cloudProfile));
    localStorage.setItem(SPEAKING_SESSIONS_KEY, JSON.stringify(cloudSpeaking));
    localStorage.setItem(EXPLAIN_SESSIONS_KEY, JSON.stringify(cloudExplain));
    localStorage.setItem(INTERVIEW_SESSIONS_KEY, JSON.stringify(cloudInterview));

    return cloudProfile;
  } catch (err) {
    console.warn('Error synchronizing with Firestore:', err);
    return getProfile();
  }
}

export function getProfile(): UserPerformanceProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return DEFAULT_PROFILE;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserPerformanceProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    if (auth.currentUser?.uid) {
      persistUserProfile(auth.currentUser.uid, profile).catch((err) =>
        console.warn('Cloud profile sync warning:', err)
      );
    }
  } catch (err) {
    console.error('Failed to save profile', err);
  }
}

export function updateStreak(): UserPerformanceProfile {
  const profile = getProfile();
  const today = new Date().toISOString().slice(0, 10);

  if (profile.lastActiveDate === today) {
    return profile;
  }

  let newStreak = profile.streakDays;
  if (!profile.lastActiveDate) {
    newStreak = 1;
  } else {
    const lastDate = new Date(profile.lastActiveDate);
    const currentDate = new Date(today);
    const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  }

  const updated: UserPerformanceProfile = {
    ...profile,
    streakDays: newStreak,
    lastActiveDate: today,
  };
  saveProfile(updated);
  return updated;
}

export function recordSpeakingSession(record: SpeakingSessionRecord): void {
  try {
    const sessions = getSpeakingSessions();
    sessions.unshift(record);
    localStorage.setItem(SPEAKING_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 100)));

    // update profile stats
    const profile = getProfile();
    const newTotal = profile.totalSessionsCompleted + 1;
    const newSpeakingMins = profile.totalSpeakingMinutes + Math.ceil(record.actualDurationSeconds / 60);

    const isFirst = profile.totalSessionsCompleted === 0;
    const alpha = 0.25;

    const newFluency = isFirst
      ? record.evaluation.fluency
      : Math.round(profile.speakingFluency * (1 - alpha) + record.evaluation.fluency * alpha);
    const newGrammar = isFirst
      ? record.evaluation.grammar
      : Math.round(profile.englishGrammar * (1 - alpha) + record.evaluation.grammar * alpha);
    const newVocab = isFirst
      ? record.evaluation.vocabulary
      : Math.round(profile.vocabulary * (1 - alpha) + record.evaluation.vocabulary * alpha);
    const newStructure = isFirst
      ? record.evaluation.structure
      : Math.round(profile.answerStructure * (1 - alpha) + record.evaluation.structure * alpha);
    const newConfidence = isFirst
      ? (record.evaluation.confidence || 70)
      : Math.round(profile.confidenceUnderPressure * (1 - alpha) + (record.evaluation.confidence || 70) * alpha);

    const fillerHistory = [
      ...(profile.fillerWordsHistory || []),
      {
        sessionDate: `Session ${newTotal}`,
        count: record.evaluation.fillerWordsCount,
      },
    ].slice(-12);

    const scoresHistory = [
      ...(profile.scoresHistory || []),
      {
        sessionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        overall: record.evaluation.overallScore,
        type: 'Speaking',
      },
    ].slice(-15);

    // Compute weakest and strongest
    const skillsMap: Record<string, number> = {
      'Speaking Fluency': newFluency,
      'English Grammar': newGrammar,
      'Vocabulary': newVocab,
      'Answer Structure': newStructure,
      'Confidence Under Pressure': newConfidence,
    };

    let weakestSkill = 'Speaking Fluency';
    let weakestScore = 100;
    let strongestSkill = 'Speaking Fluency';
    let strongestScore = 0;

    Object.entries(skillsMap).forEach(([name, val]) => {
      if (val < weakestScore) {
        weakestScore = val;
        weakestSkill = name;
      }
      if (val > strongestScore) {
        strongestScore = val;
        strongestSkill = name;
      }
    });

    const updatedProfile: UserPerformanceProfile = {
      ...profile,
      totalSessionsCompleted: newTotal,
      totalSpeakingMinutes: newSpeakingMins,
      speakingFluency: newFluency,
      englishGrammar: newGrammar,
      vocabulary: newVocab,
      answerStructure: newStructure,
      confidenceUnderPressure: newConfidence,
      weakestSkill,
      strongestSkill,
      fillerWordsHistory: fillerHistory,
      scoresHistory,
      lastActiveDate: new Date().toISOString().slice(0, 10),
    };

    saveProfile(updatedProfile);

    // Cloud persistence
    if (auth.currentUser?.uid) {
      persistSpeakingSession(auth.currentUser.uid, record, profile).catch((err) =>
        console.warn('Cloud speaking session sync warning:', err)
      );
    }
  } catch (err) {
    console.error('Failed to record speaking session', err);
  }
}

export function recordExplainSession(record: ExplainSessionRecord): void {
  try {
    const sessions = getExplainSessions();
    sessions.unshift(record);
    localStorage.setItem(EXPLAIN_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 100)));

    const profile = getProfile();
    const isFirst = profile.totalSessionsCompleted === 0;
    const alpha = 0.25;
    const newTechExpl = isFirst
      ? record.evaluation.technicalCorrectness
      : Math.round(profile.technicalExplanation * (1 - alpha) + record.evaluation.technicalCorrectness * alpha);
    const newStructure = isFirst
      ? record.evaluation.logicalStructure
      : Math.round(profile.answerStructure * (1 - alpha) + record.evaluation.logicalStructure * alpha);

    // Update learned topic mastery
    const learnedTopics = [...(profile.learnedTopics || [])];
    const existingIdx = learnedTopics.findIndex((t) => t.topic.toLowerCase() === record.topic.toLowerCase());
    if (existingIdx >= 0) {
      learnedTopics[existingIdx].masteryScore = record.evaluation.overallScore;
    } else {
      learnedTopics.unshift({
        topic: record.topic,
        domain: record.domain,
        learnedAt: Date.now(),
        masteryScore: record.evaluation.overallScore,
      });
    }

    // If score was below 70, add to weak topics, else remove
    let weakTopics = [...(profile.weakTopics || [])];
    if (record.evaluation.overallScore < 70) {
      if (!weakTopics.includes(record.topic)) weakTopics.push(record.topic);
    } else {
      weakTopics = weakTopics.filter((t) => t.toLowerCase() !== record.topic.toLowerCase());
    }

    const updatedProfile: UserPerformanceProfile = {
      ...profile,
      totalSessionsCompleted: profile.totalSessionsCompleted + 1,
      totalSpeakingMinutes: profile.totalSpeakingMinutes + 2,
      technicalExplanation: newTechExpl,
      answerStructure: newStructure,
      learnedTopics,
      weakTopics,
      scoresHistory: [
        ...(profile.scoresHistory || []),
        {
          sessionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          overall: record.evaluation.overallScore,
          type: 'Explain',
        },
      ].slice(-15),
      lastActiveDate: new Date().toISOString().slice(0, 10),
    };

    saveProfile(updatedProfile);

    // Cloud persistence
    if (auth.currentUser?.uid) {
      persistExplainSession(auth.currentUser.uid, record, profile).catch((err) =>
        console.warn('Cloud explain session sync warning:', err)
      );
    }
  } catch (err) {
    console.error('Failed to record explain session', err);
  }
}

export function recordInterviewSession(session: InterviewSession): void {
  try {
    const sessions = getInterviewSessions();
    const existingIdx = sessions.findIndex((s) => s.id === session.id);
    if (existingIdx >= 0) {
      sessions[existingIdx] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(INTERVIEW_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 100)));

    if (session.scorecard) {
      const profile = getProfile();
      const isFirst = profile.totalSessionsCompleted === 0;
      const alpha = 0.25;
      const card = session.scorecard;
      const updatedProfile: UserPerformanceProfile = {
        ...profile,
        totalSessionsCompleted: profile.totalSessionsCompleted + 1,
        totalSpeakingMinutes: profile.totalSpeakingMinutes + session.durationMinutes,
        technicalKnowledge: isFirst
          ? card.technicalKnowledge
          : Math.round(profile.technicalKnowledge * (1 - alpha) + card.technicalKnowledge * alpha),
        interviewPerformance: isFirst
          ? card.overallScore
          : Math.round(profile.interviewPerformance * (1 - alpha) + card.overallScore * alpha),
        confidenceUnderPressure: isFirst
          ? card.pressureHandling
          : Math.round(profile.confidenceUnderPressure * (1 - alpha) + card.pressureHandling * alpha),
        hrBehavioral: isFirst
          ? card.hrBehavioral
          : Math.round(profile.hrBehavioral * (1 - alpha) + card.hrBehavioral * alpha),
        speakingFluency: isFirst
          ? card.communication
          : Math.round(profile.speakingFluency * (1 - alpha) + card.communication * alpha),
        scoresHistory: [
          ...(profile.scoresHistory || []),
          {
            sessionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            overall: card.overallScore,
            type: 'Interview',
          },
        ].slice(-15),
        lastActiveDate: new Date().toISOString().slice(0, 10),
      };
      saveProfile(updatedProfile);

      // Cloud persistence
      if (auth.currentUser?.uid) {
        persistInterviewSession(auth.currentUser.uid, session, profile).catch((err) =>
          console.warn('Cloud interview session sync warning:', err)
        );
      }
    }
  } catch (err) {
    console.error('Failed to record interview session', err);
  }
}

export function getSpeakingSessions(): SpeakingSessionRecord[] {
  try {
    const raw = localStorage.getItem(SPEAKING_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getExplainSessions(): ExplainSessionRecord[] {
  try {
    const raw = localStorage.getItem(EXPLAIN_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getInterviewSessions(): InterviewSession[] {
  try {
    const raw = localStorage.getItem(INTERVIEW_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getSavedDailyPlan(): DailyPlan | null {
  try {
    const raw = localStorage.getItem(DAILY_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date === today) return parsed;
    return null;
  } catch {
    return null;
  }
}

export const getDailyPlan = getSavedDailyPlan;

export function saveDailyPlan(plan: DailyPlan): void {
  try {
    localStorage.setItem(DAILY_PLAN_KEY, JSON.stringify(plan));
  } catch (err) {
    console.error('Failed to save daily plan', err);
  }
}

export function exportAllData(): string {
  const data = {
    profile: getProfile(),
    speakingSessions: getSpeakingSessions(),
    explainSessions: getExplainSessions(),
    interviewSessions: getInterviewSessions(),
    dailyPlan: getSavedDailyPlan(),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
    if (data.speakingSessions) localStorage.setItem(SPEAKING_SESSIONS_KEY, JSON.stringify(data.speakingSessions));
    if (data.explainSessions) localStorage.setItem(EXPLAIN_SESSIONS_KEY, JSON.stringify(data.explainSessions));
    if (data.interviewSessions) localStorage.setItem(INTERVIEW_SESSIONS_KEY, JSON.stringify(data.interviewSessions));
    if (data.dailyPlan) localStorage.setItem(DAILY_PLAN_KEY, JSON.stringify(data.dailyPlan));
    return true;
  } catch (err) {
    console.error('Import failed', err);
    return false;
  }
}

export function clearAllData(): void {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(SPEAKING_SESSIONS_KEY);
  localStorage.removeItem(EXPLAIN_SESSIONS_KEY);
  localStorage.removeItem(INTERVIEW_SESSIONS_KEY);
  localStorage.removeItem(DAILY_PLAN_KEY);
  saveProfile(DEFAULT_PROFILE);
}
