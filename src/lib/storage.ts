import {
  UserPerformanceProfile,
  SpeakingSessionRecord,
  ExplainSessionRecord,
  InterviewSession,
  DailyPlan,
} from '../types';
import {
  fetchUserProfile,
  fetchSpeakingSessions,
  fetchExplainSessions,
  fetchInterviewSessions,
  persistUserProfile,
  persistSpeakingSession,
  persistExplainSession,
  persistInterviewSession,
  EMPTY_USER_PROFILE,
} from './firestoreStorage';
import { auth } from './firebase';

const LEGACY_KEYS = {
  profile: 'interviewgym_user_profile_v1',
  speaking: 'interviewgym_speaking_sessions_v1',
  explain: 'interviewgym_explain_sessions_v1',
  interview: 'interviewgym_interview_sessions_v1',
  dailyPlan: 'interviewgym_daily_plan_v1',
};

/**
 * Returns a user-scoped localStorage key based on authenticated Firebase UID
 */
export function getUserKey(suffix: string, customUid?: string): string | null {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return null;
  return `interviewgym_${uid}_${suffix}`;
}

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
 * Sync all user data from Firestore into user-isolated local cache
 */
export async function syncUserDataWithFirestore(userId: string): Promise<UserPerformanceProfile> {
  if (!userId) return DEFAULT_PROFILE;

  try {
    const cloudProfile = await fetchUserProfile(userId);
    const cloudSpeaking = await fetchSpeakingSessions(userId);
    const cloudExplain = await fetchExplainSessions(userId);
    const cloudInterview = await fetchInterviewSessions(userId);

    const profileKey = getUserKey('profile_v1', userId);
    const speakingKey = getUserKey('speaking_sessions_v1', userId);
    const explainKey = getUserKey('explain_sessions_v1', userId);
    const interviewKey = getUserKey('interview_sessions_v1', userId);

    if (profileKey) localStorage.setItem(profileKey, JSON.stringify(cloudProfile));
    if (speakingKey) localStorage.setItem(speakingKey, JSON.stringify(cloudSpeaking));
    if (explainKey) localStorage.setItem(explainKey, JSON.stringify(cloudExplain));
    if (interviewKey) localStorage.setItem(interviewKey, JSON.stringify(cloudInterview));

    return cloudProfile;
  } catch (err) {
    console.warn('Error synchronizing with Firestore:', err);
    return getProfile(userId);
  }
}

export function getProfile(customUid?: string): UserPerformanceProfile {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) {
    return DEFAULT_PROFILE;
  }

  try {
    const key = getUserKey('profile_v1', uid);
    let raw = key ? localStorage.getItem(key) : null;

    // Check if intermediate firestore key exists
    if (!raw) {
      const intermediateKey = `interviewgym_${uid}_profile`;
      raw = localStorage.getItem(intermediateKey);
    }

    // Backward compatibility: If local cache hasn't migrated yet, check legacy un-scoped key
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEYS.profile);
      if (legacy) {
        raw = legacy;
        if (key) {
          try {
            localStorage.setItem(key, legacy);
          } catch {}
        }
      }
    }

    if (!raw) {
      return DEFAULT_PROFILE;
    }
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserPerformanceProfile, customUid?: string): void {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return;

  try {
    const key = getUserKey('profile_v1', uid);
    if (key) {
      localStorage.setItem(key, JSON.stringify(profile));
    }
    persistUserProfile(uid, profile).catch((err) =>
      console.warn('Cloud profile sync warning:', err)
    );
  } catch (err) {
    console.error('Failed to save profile', err);
  }
}

export function updateStreak(customUid?: string): UserPerformanceProfile {
  const uid = customUid || auth.currentUser?.uid;
  const profile = getProfile(uid);
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
  saveProfile(updated, uid);
  return updated;
}

export function recordSpeakingSession(record: SpeakingSessionRecord, customUid?: string): void {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return;

  try {
    const sessions = getSpeakingSessions(uid);
    sessions.unshift(record);
    const key = getUserKey('speaking_sessions_v1', uid);
    if (key) {
      localStorage.setItem(key, JSON.stringify(sessions.slice(0, 100)));
    }

    // update profile stats
    const profile = getProfile(uid);
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

    saveProfile(updatedProfile, uid);

    // Cloud persistence
    persistSpeakingSession(uid, record, profile).catch((err) =>
      console.warn('Cloud speaking session sync warning:', err)
    );
  } catch (err) {
    console.error('Failed to record speaking session', err);
  }
}

export function recordExplainSession(record: ExplainSessionRecord, customUid?: string): void {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return;

  try {
    const sessions = getExplainSessions(uid);
    sessions.unshift(record);
    const key = getUserKey('explain_sessions_v1', uid);
    if (key) {
      localStorage.setItem(key, JSON.stringify(sessions.slice(0, 100)));
    }

    const profile = getProfile(uid);
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

    saveProfile(updatedProfile, uid);

    // Cloud persistence
    persistExplainSession(uid, record, profile).catch((err) =>
      console.warn('Cloud explain session sync warning:', err)
    );
  } catch (err) {
    console.error('Failed to record explain session', err);
  }
}

export function recordInterviewSession(session: InterviewSession, customUid?: string): void {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return;

  try {
    const sessions = getInterviewSessions(uid);
    const existingIdx = sessions.findIndex((s) => s.id === session.id);
    if (existingIdx >= 0) {
      sessions[existingIdx] = session;
    } else {
      sessions.unshift(session);
    }
    const key = getUserKey('interview_sessions_v1', uid);
    if (key) {
      localStorage.setItem(key, JSON.stringify(sessions.slice(0, 100)));
    }

    if (session.scorecard) {
      const profile = getProfile(uid);
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
      saveProfile(updatedProfile, uid);

      // Cloud persistence
      persistInterviewSession(uid, session, profile).catch((err) =>
        console.warn('Cloud interview session sync warning:', err)
      );
    }
  } catch (err) {
    console.error('Failed to record interview session', err);
  }
}

export function getSpeakingSessions(customUid?: string): SpeakingSessionRecord[] {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return [];

  try {
    const key = getUserKey('speaking_sessions_v1', uid);
    let raw = key ? localStorage.getItem(key) : null;

    if (!raw) {
      const intermediateKey = `interviewgym_${uid}_speaking_sessions`;
      raw = localStorage.getItem(intermediateKey);
    }

    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEYS.speaking);
      if (legacy) {
        raw = legacy;
        if (key) {
          try {
            localStorage.setItem(key, legacy);
          } catch {}
        }
      }
    }

    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getExplainSessions(customUid?: string): ExplainSessionRecord[] {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return [];

  try {
    const key = getUserKey('explain_sessions_v1', uid);
    let raw = key ? localStorage.getItem(key) : null;

    if (!raw) {
      const intermediateKey = `interviewgym_${uid}_explain_sessions`;
      raw = localStorage.getItem(intermediateKey);
    }

    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEYS.explain);
      if (legacy) {
        raw = legacy;
        if (key) {
          try {
            localStorage.setItem(key, legacy);
          } catch {}
        }
      }
    }

    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getInterviewSessions(customUid?: string): InterviewSession[] {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return [];

  try {
    const key = getUserKey('interview_sessions_v1', uid);
    let raw = key ? localStorage.getItem(key) : null;

    if (!raw) {
      const intermediateKey = `interviewgym_${uid}_interview_sessions`;
      raw = localStorage.getItem(intermediateKey);
    }

    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEYS.interview);
      if (legacy) {
        raw = legacy;
        if (key) {
          try {
            localStorage.setItem(key, legacy);
          } catch {}
        }
      }
    }

    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getSavedDailyPlan(customUid?: string): DailyPlan | null {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return null;

  try {
    const key = getUserKey('daily_plan_v1', uid);
    let raw = key ? localStorage.getItem(key) : null;

    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEYS.dailyPlan);
      if (legacy) {
        raw = legacy;
      }
    }

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

export function saveDailyPlan(plan: DailyPlan, customUid?: string): void {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return;

  try {
    const key = getUserKey('daily_plan_v1', uid);
    if (key) {
      localStorage.setItem(key, JSON.stringify(plan));
    }
  } catch (err) {
    console.error('Failed to save daily plan', err);
  }
}

export function exportAllData(customUid?: string): string {
  const uid = customUid || auth.currentUser?.uid;
  const data = {
    profile: getProfile(uid),
    speakingSessions: getSpeakingSessions(uid),
    explainSessions: getExplainSessions(uid),
    interviewSessions: getInterviewSessions(uid),
    dailyPlan: getSavedDailyPlan(uid),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonString: string, customUid?: string): boolean {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return false;

  try {
    const data = JSON.parse(jsonString);
    const profileKey = getUserKey('profile_v1', uid);
    const speakingKey = getUserKey('speaking_sessions_v1', uid);
    const explainKey = getUserKey('explain_sessions_v1', uid);
    const interviewKey = getUserKey('interview_sessions_v1', uid);
    const dailyPlanKey = getUserKey('daily_plan_v1', uid);

    if (data.profile && profileKey) localStorage.setItem(profileKey, JSON.stringify(data.profile));
    if (data.speakingSessions && speakingKey) localStorage.setItem(speakingKey, JSON.stringify(data.speakingSessions));
    if (data.explainSessions && explainKey) localStorage.setItem(explainKey, JSON.stringify(data.explainSessions));
    if (data.interviewSessions && interviewKey) localStorage.setItem(interviewKey, JSON.stringify(data.interviewSessions));
    if (data.dailyPlan && dailyPlanKey) localStorage.setItem(dailyPlanKey, JSON.stringify(data.dailyPlan));

    if (data.profile) {
      saveProfile(data.profile, uid);
    }
    return true;
  } catch (err) {
    console.error('Import failed', err);
    return false;
  }
}

export function clearAllData(customUid?: string): void {
  const uid = customUid || auth.currentUser?.uid;
  if (!uid) return;

  const profileKey = getUserKey('profile_v1', uid);
  const speakingKey = getUserKey('speaking_sessions_v1', uid);
  const explainKey = getUserKey('explain_sessions_v1', uid);
  const interviewKey = getUserKey('interview_sessions_v1', uid);
  const dailyPlanKey = getUserKey('daily_plan_v1', uid);

  if (profileKey) localStorage.removeItem(profileKey);
  if (speakingKey) localStorage.removeItem(speakingKey);
  if (explainKey) localStorage.removeItem(explainKey);
  if (interviewKey) localStorage.removeItem(interviewKey);
  if (dailyPlanKey) localStorage.removeItem(dailyPlanKey);

  // Also clear any unversioned fallback cache for this user
  localStorage.removeItem(`interviewgym_${uid}_profile`);
  localStorage.removeItem(`interviewgym_${uid}_speaking_sessions`);
  localStorage.removeItem(`interviewgym_${uid}_explain_sessions`);
  localStorage.removeItem(`interviewgym_${uid}_interview_sessions`);

  saveProfile(DEFAULT_PROFILE, uid);
}
