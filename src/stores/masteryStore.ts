import { create } from 'zustand';

/**
 * MasteryStore — Zustand store for mastery data
 *
 * Manages:
 * - mastery_history (topic mastery with posteriors)
 * - study_attempts (recent practice attempts)
 * - UI state (selected topic, filters, sort order)
 * - Loading state for async queries
 */

export interface MasteryLevel {
  topic: string;
  masteryLevel: number;
  lower95: number;
  upper95: number;
  attemptCount: number;
  lastStudied?: string;
  noteId?: string;
  batchId?: string;
}

export interface StudyAttempt {
  id: string;
  noteId: string;
  topic: string;
  question: string;
  studentResponse: string;
  score: number;
  isCorrect: boolean;
  timeToSolutionMs: number;
  misconceptionsDetected?: string[];
  createdAt: string;
  aiFeedback?: string;
  confidence?: number;
}

export interface MasteryState {
  // Data
  masteryHistory: MasteryLevel[];
  recentAttempts: StudyAttempt[];
  allTopics: Map<string, MasteryLevel>;

  // UI State
  selectedTopicId: string | null;
  filterByStatus: 'all' | 'mastered' | 'review' | 'struggle';
  sortBy: 'mastery' | 'recent' | 'name';
  viewMode: 'grid' | 'list';
  isLoading: boolean;
  error: string | null;

  // Actions
  setMasteryHistory: (data: MasteryLevel[]) => void;
  setRecentAttempts: (data: StudyAttempt[]) => void;
  selectTopic: (id: string | null) => void;
  setFilterByStatus: (status: 'all' | 'mastered' | 'review' | 'struggle') => void;
  setSortBy: (sort: 'mastery' | 'recent' | 'name') => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getFilteredTopics: () => MasteryLevel[];
  getSortedTopics: (topics: MasteryLevel[]) => MasteryLevel[];
  getTopicStats: () => {
    total: number;
    mastered: number;
    review: number;
    struggle: number;
    averageMastery: number;
  };
}

export const useMasteryStore = create<MasteryState>((set, get) => ({
  // Data
  masteryHistory: [],
  recentAttempts: [],
  allTopics: new Map(),

  // UI State
  selectedTopicId: null,
  filterByStatus: 'all',
  sortBy: 'mastery',
  viewMode: 'grid',
  isLoading: false,
  error: null,

  // Actions
  setMasteryHistory: (data) =>
    set((state) => {
      const topicsMap = new Map(data.map((m) => [m.topic, m]));
      return {
        masteryHistory: data,
        allTopics: topicsMap,
      };
    }),

  setRecentAttempts: (data) => set({ recentAttempts: data }),

  selectTopic: (id) => set({ selectedTopicId: id }),

  setFilterByStatus: (status) => set({ filterByStatus: status }),

  setSortBy: (sort) => set({ sortBy: sort }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  // Computed
  getFilteredTopics: () => {
    const state = get();
    const { filterByStatus, masteryHistory } = state;

    return masteryHistory.filter((topic) => {
      if (filterByStatus === 'all') return true;
      if (filterByStatus === 'mastered') return topic.masteryLevel >= 0.7;
      if (filterByStatus === 'review') return topic.masteryLevel >= 0.5 && topic.masteryLevel < 0.7;
      if (filterByStatus === 'struggle') return topic.masteryLevel < 0.5;
      return true;
    });
  },

  getSortedTopics: (topics) => {
    const { sortBy } = get();
    const sorted = [...topics];

    if (sortBy === 'mastery') {
      sorted.sort((a, b) => b.masteryLevel - a.masteryLevel);
    } else if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const aDate = new Date(a.lastStudied || 0).getTime();
        const bDate = new Date(b.lastStudied || 0).getTime();
        return bDate - aDate;
      });
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.topic.localeCompare(b.topic));
    }

    return sorted;
  },

  getTopicStats: () => {
    const state = get();
    const { masteryHistory } = state;

    const total = masteryHistory.length;
    const mastered = masteryHistory.filter((t) => t.masteryLevel >= 0.7).length;
    const review = masteryHistory.filter((t) => t.masteryLevel >= 0.5 && t.masteryLevel < 0.7).length;
    const struggle = masteryHistory.filter((t) => t.masteryLevel < 0.5).length;
    const averageMastery =
      total > 0 ? masteryHistory.reduce((sum, t) => sum + t.masteryLevel, 0) / total : 0;

    return {
      total,
      mastered,
      review,
      struggle,
      averageMastery,
    };
  },
}));
