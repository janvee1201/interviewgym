import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  UserPerformanceProfile,
  SpeakingSessionRecord,
  ExplainSessionRecord,
  InterviewSession,
  DailyPlan,
} from '../types';

export const EMPTY_USER_PROFILE: UserPerformanceProfile = {
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

// Helper: localStorage fallback cache key per user
const getLocalKey = (userId: string, key: string) => `interviewgym_${userId}_${key}`;

/**
 * Fetch the user's performance profile from Firestore (with local cache fallback)
 */
export async function fetchUserProfile(userId: string): Promise<UserPerformanceProfile> {
  if (!userId) return EMPTY_USER_PROFILE;

  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data() as UserPerformanceProfile;
      const merged: UserPerformanceProfile = {
        ...EMPTY_USER_PROFILE,
        ...data,
      };
      try {
        localStorage.setItem(getLocalKey(userId, 'profile'), JSON.stringify(merged));
      } catch {}
      return merged;
    }

    // Check local cache if cloud doc doesn't exist yet
    const localCached = localStorage.getItem(getLocalKey(userId, 'profile'));
    if (localCached) {
      try {
        return JSON.parse(localCached);
      } catch {}
    }

    // New user with zero sessions
    return EMPTY_USER_PROFILE;
  } catch (err) {
    console.warn('Error fetching user profile from Firestore, using local cache:', err);
    const localCached = localStorage.getItem(getLocalKey(userId, 'profile'));
    if (localCached) {
      try {
        return JSON.parse(localCached);
      } catch {}
    }
    return EMPTY_USER_PROFILE;
  }
}

/**
 * Save user profile to Firestore & local cache
 */
export async function persistUserProfile(userId: string, profile: UserPerformanceProfile): Promise<void> {
  if (!userId) return;

  try {
    localStorage.setItem(getLocalKey(userId, 'profile'), JSON.stringify(profile));
  } catch {}

  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, {
      ...profile,
      userId,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Failed to persist user profile to Firestore:', err);
  }
}

/**
 * Save a speaking session to Firestore and update aggregate metrics
 */
export async function persistSpeakingSession(
  userId: string,
  session: SpeakingSessionRecord,
  currentProfile: UserPerformanceProfile
): Promise<UserPerformanceProfile> {
  // 1. Save session to subcollection
  try {
    const sessionDocRef = doc(db, 'users', userId, 'speaking_sessions', session.id);
    await setDoc(sessionDocRef, { ...session, userId });
  } catch (err) {
    console.error('Failed to persist speaking session to Firestore:', err);
  }

  // 2. Update local cache
  try {
    const local = localStorage.getItem(getLocalKey(userId, 'speaking_sessions'));
    const list: SpeakingSessionRecord[] = local ? JSON.parse(local) : [];
    list.unshift(session);
    localStorage.setItem(getLocalKey(userId, 'speaking_sessions'), JSON.stringify(list.slice(0, 100)));
  } catch {}

  // 3. Compute updated streak & metrics
  const today = new Date().toISOString().slice(0, 10);
  let streak = currentProfile.streakDays;
  if (!currentProfile.lastActiveDate) {
    streak = 1;
  } else if (currentProfile.lastActiveDate !== today) {
    const lastDate = new Date(currentProfile.lastActiveDate);
    const currentDate = new Date(today);
    const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) streak += 1;
    else if (diffDays > 1) streak = 1;
  }

  const newTotal = currentProfile.totalSessionsCompleted + 1;
  const newSpeakingMins = currentProfile.totalSpeakingMinutes + Math.ceil(session.actualDurationSeconds / 60);

  // If first session ever, initialize scores directly; otherwise EMA
  const isFirst = currentProfile.totalSessionsCompleted === 0;
  const alpha = 0.3;

  const newFluency = isFirst
    ? session.evaluation.fluency
    : Math.round(currentProfile.speakingFluency * (1 - alpha) + session.evaluation.fluency * alpha);
  const newGrammar = isFirst
    ? session.evaluation.grammar
    : Math.round(currentProfile.englishGrammar * (1 - alpha) + session.evaluation.grammar * alpha);
  const newVocab = isFirst
    ? session.evaluation.vocabulary
    : Math.round(currentProfile.vocabulary * (1 - alpha) + session.evaluation.vocabulary * alpha);
  const newStructure = isFirst
    ? session.evaluation.structure
    : Math.round(currentProfile.answerStructure * (1 - alpha) + session.evaluation.structure * alpha);
  const newConfidence = isFirst
    ? (session.evaluation.confidence || 70)
    : Math.round(currentProfile.confidenceUnderPressure * (1 - alpha) + (session.evaluation.confidence || 70) * alpha);

  const fillerHistory = [
    ...(currentProfile.fillerWordsHistory || []),
    {
      sessionDate: `Session ${newTotal}`,
      count: session.evaluation.fillerWordsCount,
    },
  ].slice(-12);

  const scoresHistory = [
    ...(currentProfile.scoresHistory || []),
    {
      sessionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      overall: session.evaluation.overallScore,
      type: 'Speaking',
    },
  ].slice(-15);

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
    ...currentProfile,
    totalSessionsCompleted: newTotal,
    totalSpeakingMinutes: newSpeakingMins,
    streakDays: streak,
    lastActiveDate: today,
    speakingFluency: newFluency,
    englishGrammar: newGrammar,
    vocabulary: newVocab,
    answerStructure: newStructure,
    confidenceUnderPressure: newConfidence,
    weakestSkill,
    strongestSkill,
    recommendedPractice: session.evaluation.recommendedPractice || `Focus on ${weakestSkill} in your next drill.`,
    fillerWordsHistory: fillerHistory,
    scoresHistory,
  };

  await persistUserProfile(userId, updatedProfile);
  return updatedProfile;
}

/**
 * Save an explain session to Firestore and update aggregate metrics
 */
export async function persistExplainSession(
  userId: string,
  session: ExplainSessionRecord,
  currentProfile: UserPerformanceProfile
): Promise<UserPerformanceProfile> {
  try {
    const sessionDocRef = doc(db, 'users', userId, 'explain_sessions', session.id);
    await setDoc(sessionDocRef, { ...session, userId });
  } catch (err) {
    console.error('Failed to persist explain session to Firestore:', err);
  }

  try {
    const local = localStorage.getItem(getLocalKey(userId, 'explain_sessions'));
    const list: ExplainSessionRecord[] = local ? JSON.parse(local) : [];
    list.unshift(session);
    localStorage.setItem(getLocalKey(userId, 'explain_sessions'), JSON.stringify(list.slice(0, 100)));
  } catch {}

  const today = new Date().toISOString().slice(0, 10);
  let streak = currentProfile.streakDays;
  if (!currentProfile.lastActiveDate) {
    streak = 1;
  } else if (currentProfile.lastActiveDate !== today) {
    const lastDate = new Date(currentProfile.lastActiveDate);
    const currentDate = new Date(today);
    const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) streak += 1;
    else if (diffDays > 1) streak = 1;
  }

  const isFirst = currentProfile.totalSessionsCompleted === 0;
  const alpha = 0.3;

  const newTechExpl = isFirst
    ? session.evaluation.technicalCorrectness
    : Math.round(currentProfile.technicalExplanation * (1 - alpha) + session.evaluation.technicalCorrectness * alpha);
  const newStructure = isFirst
    ? session.evaluation.logicalStructure
    : Math.round(currentProfile.answerStructure * (1 - alpha) + session.evaluation.logicalStructure * alpha);

  // Update learned topics
  const learnedTopics = [...(currentProfile.learnedTopics || [])];
  const existingIdx = learnedTopics.findIndex(t => t.topic.toLowerCase() === session.topic.toLowerCase());
  if (existingIdx >= 0) {
    learnedTopics[existingIdx].masteryScore = session.evaluation.overallScore;
  } else {
    learnedTopics.unshift({
      topic: session.topic,
      domain: session.domain,
      learnedAt: Date.now(),
      masteryScore: session.evaluation.overallScore,
    });
  }

  // Weak topics tracking
  let weakTopics = [...(currentProfile.weakTopics || [])];
  if (session.evaluation.overallScore < 70) {
    if (!weakTopics.includes(session.topic)) weakTopics.push(session.topic);
  } else {
    weakTopics = weakTopics.filter(t => t.toLowerCase() !== session.topic.toLowerCase());
  }

  const updatedProfile: UserPerformanceProfile = {
    ...currentProfile,
    totalSessionsCompleted: currentProfile.totalSessionsCompleted + 1,
    totalSpeakingMinutes: currentProfile.totalSpeakingMinutes + 2,
    streakDays: streak,
    lastActiveDate: today,
    technicalExplanation: newTechExpl,
    answerStructure: newStructure,
    learnedTopics,
    weakTopics,
    scoresHistory: [
      ...(currentProfile.scoresHistory || []),
      {
        sessionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        overall: session.evaluation.overallScore,
        type: 'Explain',
      },
    ].slice(-15),
  };

  await persistUserProfile(userId, updatedProfile);
  return updatedProfile;
}

/**
 * Save an interview session to Firestore and update aggregate metrics
 */
export async function persistInterviewSession(
  userId: string,
  session: InterviewSession,
  currentProfile: UserPerformanceProfile
): Promise<UserPerformanceProfile> {
  try {
    const sessionDocRef = doc(db, 'users', userId, 'interview_sessions', session.id);
    await setDoc(sessionDocRef, { ...session, userId });
  } catch (err) {
    console.error('Failed to persist interview session to Firestore:', err);
  }

  try {
    const local = localStorage.getItem(getLocalKey(userId, 'interview_sessions'));
    const list: InterviewSession[] = local ? JSON.parse(local) : [];
    const existingIdx = list.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) list[existingIdx] = session;
    else list.unshift(session);
    localStorage.setItem(getLocalKey(userId, 'interview_sessions'), JSON.stringify(list.slice(0, 100)));
  } catch {}

  if (!session.scorecard) return currentProfile;

  const today = new Date().toISOString().slice(0, 10);
  let streak = currentProfile.streakDays;
  if (!currentProfile.lastActiveDate) {
    streak = 1;
  } else if (currentProfile.lastActiveDate !== today) {
    const lastDate = new Date(currentProfile.lastActiveDate);
    const currentDate = new Date(today);
    const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) streak += 1;
    else if (diffDays > 1) streak = 1;
  }

  const isFirst = currentProfile.totalSessionsCompleted === 0;
  const alpha = 0.3;
  const card = session.scorecard;

  const newTechKnowledge = isFirst
    ? card.technicalKnowledge
    : Math.round(currentProfile.technicalKnowledge * (1 - alpha) + card.technicalKnowledge * alpha);
  const newInterviewPerf = isFirst
    ? card.overallScore
    : Math.round(currentProfile.interviewPerformance * (1 - alpha) + card.overallScore * alpha);
  const newPressureHandling = isFirst
    ? card.pressureHandling
    : Math.round(currentProfile.confidenceUnderPressure * (1 - alpha) + card.pressureHandling * alpha);
  const newHR = isFirst
    ? card.hrBehavioral
    : Math.round(currentProfile.hrBehavioral * (1 - alpha) + card.hrBehavioral * alpha);
  const newFluency = isFirst
    ? card.communication
    : Math.round(currentProfile.speakingFluency * (1 - alpha) + card.communication * alpha);

  // Derive weak topics from questions answered poorly
  const weakTopics = [...(currentProfile.weakTopics || [])];
  if (card.conceptsToRevise && card.conceptsToRevise.length > 0) {
    card.conceptsToRevise.forEach(concept => {
      if (!weakTopics.includes(concept)) weakTopics.push(concept);
    });
  }

  const updatedProfile: UserPerformanceProfile = {
    ...currentProfile,
    totalSessionsCompleted: currentProfile.totalSessionsCompleted + 1,
    totalSpeakingMinutes: currentProfile.totalSpeakingMinutes + session.durationMinutes,
    streakDays: streak,
    lastActiveDate: today,
    technicalKnowledge: newTechKnowledge,
    interviewPerformance: newInterviewPerf,
    confidenceUnderPressure: newPressureHandling,
    hrBehavioral: newHR,
    speakingFluency: newFluency,
    weakTopics: weakTopics.slice(0, 10),
    recommendedPractice: card.recommendedNextSession || currentProfile.recommendedPractice,
    scoresHistory: [
      ...(currentProfile.scoresHistory || []),
      {
        sessionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        overall: card.overallScore,
        type: 'Interview',
      },
    ].slice(-15),
  };

  await persistUserProfile(userId, updatedProfile);
  return updatedProfile;
}

/**
 * Fetch speaking sessions from Firestore
 */
export async function fetchSpeakingSessions(userId: string): Promise<SpeakingSessionRecord[]> {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'users', userId, 'speaking_sessions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const items: SpeakingSessionRecord[] = [];
    snap.forEach((docSnap) => items.push(docSnap.data() as SpeakingSessionRecord));
    if (items.length > 0) {
      try {
        localStorage.setItem(getLocalKey(userId, 'speaking_sessions'), JSON.stringify(items));
      } catch {}
      return items;
    }
  } catch (err) {
    console.warn('Error fetching speaking sessions from Firestore:', err);
  }

  // Fallback to local cache
  try {
    const local = localStorage.getItem(getLocalKey(userId, 'speaking_sessions'));
    return local ? JSON.parse(local) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch explain sessions from Firestore
 */
export async function fetchExplainSessions(userId: string): Promise<ExplainSessionRecord[]> {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'users', userId, 'explain_sessions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const items: ExplainSessionRecord[] = [];
    snap.forEach((docSnap) => items.push(docSnap.data() as ExplainSessionRecord));
    if (items.length > 0) {
      try {
        localStorage.setItem(getLocalKey(userId, 'explain_sessions'), JSON.stringify(items));
      } catch {}
      return items;
    }
  } catch (err) {
    console.warn('Error fetching explain sessions from Firestore:', err);
  }

  try {
    const local = localStorage.getItem(getLocalKey(userId, 'explain_sessions'));
    return local ? JSON.parse(local) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch interview sessions from Firestore
 */
export async function fetchInterviewSessions(userId: string): Promise<InterviewSession[]> {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'users', userId, 'interview_sessions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const items: InterviewSession[] = [];
    snap.forEach((docSnap) => items.push(docSnap.data() as InterviewSession));
    if (items.length > 0) {
      try {
        localStorage.setItem(getLocalKey(userId, 'interview_sessions'), JSON.stringify(items));
      } catch {}
      return items;
    }
  } catch (err) {
    console.warn('Error fetching interview sessions from Firestore:', err);
  }

  try {
    const local = localStorage.getItem(getLocalKey(userId, 'interview_sessions'));
    return local ? JSON.parse(local) : [];
  } catch {
    return [];
  }
}
