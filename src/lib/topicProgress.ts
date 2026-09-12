import { getProfile, getExplainSessions, getInterviewSessions, saveProfile } from './storage';
import { TopicStatus, CurriculumTopic, AI_CURRICULUM_SECTIONS } from '../data/aiCurriculum';
import { auth } from './firebase';

function getProgressKey(): string {
  const uid = auth.currentUser?.uid;
  return uid ? `interviewgym_${uid}_topic_progress_v1` : 'interviewgym_topic_progress_v1';
}

export interface TopicProgressMap {
  [topicTitle: string]: {
    status: TopicStatus;
    lastViewedAt?: number;
    completedQuiz?: boolean;
  };
}

export function getLocalProgressMap(): TopicProgressMap {
  try {
    const key = getProgressKey();
    let raw = localStorage.getItem(key);

    // Fallback for previous local cache migration
    if (!raw) {
      const legacy = localStorage.getItem('interviewgym_topic_progress_v1');
      if (legacy) {
        raw = legacy;
        try {
          localStorage.setItem(key, legacy);
        } catch {}
      }
    }

    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalProgressMap(map: TopicProgressMap): void {
  try {
    const key = getProgressKey();
    localStorage.setItem(key, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save topic progress map', err);
  }
}

/**
 * Derives comprehensive topic status considering:
 * 1. Explicit progress entries in localStorage
 * 2. Explain session history (Explained)
 * 3. Interview session history (Interviewed)
 * 4. User profile learnedTopics array (Learned)
 */
export function getTopicStatus(topicTitle: string): TopicStatus {
  if (!topicTitle) return 'not_started';

  const cleanTitle = topicTitle.trim().toLowerCase();

  // 1. Check if interviewed
  const interviewSessions = getInterviewSessions();
  const hasInterviewed = interviewSessions.some(
    (s) =>
      s.projectContext?.toLowerCase().includes(cleanTitle) ||
      s.messages?.some((m) => m.text?.toLowerCase().includes(cleanTitle))
  );
  if (hasInterviewed) return 'interviewed';

  // 2. Check if explained
  const explainSessions = getExplainSessions();
  const hasExplained = explainSessions.some(
    (e) => e.topic?.trim().toLowerCase() === cleanTitle
  );
  if (hasExplained) return 'explained';

  // 3. Check profile learnedTopics
  const profile = getProfile();
  if (profile.learnedTopics?.some((t) => t.topic?.trim().toLowerCase() === cleanTitle)) {
    return 'learned';
  }

  // 4. Check local progress map
  const localMap = getLocalProgressMap();
  const entry = localMap[topicTitle] || localMap[cleanTitle];
  if (entry?.status) {
    return entry.status;
  }

  return 'not_started';
}

/**
 * Mark a topic as In Progress when the user opens or views its lesson
 */
export function markTopicInProgress(topicTitle: string): void {
  if (!topicTitle) return;
  const currentStatus = getTopicStatus(topicTitle);
  if (currentStatus === 'not_started') {
    const map = getLocalProgressMap();
    map[topicTitle] = {
      ...(map[topicTitle] || {}),
      status: 'in_progress',
      lastViewedAt: Date.now(),
    };
    saveLocalProgressMap(map);
  }
}

/**
 * Mark a topic as Learned
 */
export function markTopicLearned(topicTitle: string): void {
  if (!topicTitle) return;
  const map = getLocalProgressMap();
  map[topicTitle] = {
    ...(map[topicTitle] || {}),
    status: 'learned',
    lastViewedAt: Date.now(),
  };
  saveLocalProgressMap(map);

  // Also update user profile
  try {
    const profile = getProfile();
    const clean = topicTitle.trim();
    if (!profile.learnedTopics.some((t) => t.topic?.toLowerCase() === clean.toLowerCase())) {
      profile.learnedTopics.push({
        topic: clean,
        domain: 'AI/ML/GenAI',
        learnedAt: Date.now(),
        masteryScore: 90,
      });
      saveProfile(profile);
    }
  } catch (err) {
    console.warn('Profile sync warning for topic', err);
  }
}

/**
 * Calculate progress percentage for a specific curriculum section
 */
export function getSectionProgress(sectionId: string): {
  total: number;
  completed: number;
  percentage: number;
} {
  const section = AI_CURRICULUM_SECTIONS.find((s) => s.id === sectionId);
  if (!section || section.topics.length === 0) {
    return { total: 0, completed: 0, percentage: 0 };
  }

  let completed = 0;
  for (const topic of section.topics) {
    const status = getTopicStatus(topic.title);
    if (status === 'learned' || status === 'explained' || status === 'interviewed') {
      completed++;
    }
  }

  return {
    total: section.topics.length,
    completed,
    percentage: Math.round((completed / section.topics.length) * 100),
  };
}

/**
 * Intelligent Surprise Me algorithm that:
 * 1. Checks what the user has not learned yet
 * 2. Considers prerequisites (prefers topics whose prerequisites are satisfied or beginner topics)
 * 3. Prioritizes higher interview relevance topics (4-5 stars)
 * 4. Considers weak areas in user profile
 */
export function pickIntelligentSurpriseTopic(preferredSectionId?: string): CurriculumTopic {
  const allSections = preferredSectionId
    ? AI_CURRICULUM_SECTIONS.filter((s) => s.id === preferredSectionId)
    : AI_CURRICULUM_SECTIONS;

  const profile = getProfile();
  const learnedTopicNames = new Set(
    (profile.learnedTopics || []).map((t) => (t.topic || '').toLowerCase().trim())
  );

  // Collect all "nextTopics" from topics that the user has already learned or completed
  const nextTargetTopics = new Set<string>();
  for (const section of AI_CURRICULUM_SECTIONS) {
    for (const topic of section.topics) {
      const status = getTopicStatus(topic.title);
      if (status === 'learned' || status === 'explained' || status === 'interviewed' || learnedTopicNames.has(topic.title.toLowerCase())) {
        for (const nextT of topic.nextTopics || []) {
          nextTargetTopics.add(nextT.toLowerCase().trim());
        }
      }
    }
  }

  const candidatePool: Array<{ topic: CurriculumTopic; weight: number }> = [];

  for (const section of allSections) {
    for (const topic of section.topics) {
      const status = getTopicStatus(topic.title);
      const isCompleted = status === 'learned' || status === 'explained' || status === 'interviewed';
      const cleanTitle = topic.title.toLowerCase().trim();

      let weight = 10;

      // Unlearned topics get major priority
      if (status === 'not_started') weight += 40;
      else if (status === 'in_progress') weight += 25;
      else if (status === 'learned') weight += 3;
      else weight += 1; // already explained or interviewed

      // Higher interview relevance gets significant boost
      weight += (topic.interviewRelevance || 3) * 8;

      // Beginner topics favored if user has very few learned topics (< 4)
      if (learnedTopicNames.size < 4 && topic.level === 'Beginner') {
        weight += 25;
      }

      // If this topic is directly the next progression step for an already learned topic
      if (nextTargetTopics.has(cleanTitle) && !isCompleted) {
        weight += 60; // Strong progression alignment!
      }

      // Check prerequisites: are all prerequisites met?
      if (topic.prerequisites && topic.prerequisites.length > 0) {
        const metCount = topic.prerequisites.filter((p) => {
          const pStatus = getTopicStatus(p);
          return pStatus !== 'not_started' || learnedTopicNames.has(p.toLowerCase().trim());
        }).length;

        if (metCount === topic.prerequisites.length) {
          // All prerequisites satisfied!
          weight += 40;
        } else if (metCount === 0 && topic.level !== 'Beginner') {
          // No prerequisites satisfied yet for intermediate/interview topic, reduce weight
          weight = Math.max(5, weight - 20);
        }
      }

      candidatePool.push({ topic, weight });
    }
  }

  // Weighted selection
  const totalWeight = candidatePool.reduce((acc, c) => acc + c.weight, 0);
  let randomVal = Math.random() * totalWeight;

  for (const item of candidatePool) {
    randomVal -= item.weight;
    if (randomVal <= 0) {
      return item.topic;
    }
  }

  return candidatePool[0]?.topic || AI_CURRICULUM_SECTIONS[0].topics[0];
}
