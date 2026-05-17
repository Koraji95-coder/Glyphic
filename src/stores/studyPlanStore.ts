import { create } from 'zustand';

import { commands } from '../lib/tauri/commands';
import type {
  CompleteStudyPlanSessionInput,
  StudyPlanOverview,
  StudyPlanSession,
  UpsertStudyPlanInput,
} from '../types/studyPlan';

const emptyOverview: StudyPlanOverview = {
  plan: null,
  today_session: null,
  upcoming_sessions: [],
  completed_this_week: 0,
  planned_minutes_this_week: 0,
  completed_minutes_this_week: 0,
};

interface StudyPlanState {
  overview: StudyPlanOverview;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  loadOverview: () => Promise<void>;
  createPlan: (input: UpsertStudyPlanInput) => Promise<void>;
  generateTodaySession: () => Promise<StudyPlanSession>;
  startSession: (sessionId: number) => Promise<StudyPlanSession>;
  completeSession: (input: CompleteStudyPlanSessionInput) => Promise<StudyPlanSession>;
  skipSession: (sessionId: number) => Promise<StudyPlanSession>;
  reset: () => void;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Study plan action failed.';
}

export const useStudyPlanStore = create<StudyPlanState>((set) => ({
  overview: emptyOverview,
  isLoading: false,
  isSaving: false,
  error: null,

  loadOverview: async () => {
    set({ isLoading: true, error: null });
    try {
      const overview = await commands.getStudyPlanOverview();
      set({ overview, isLoading: false });
    } catch (error) {
      set({ error: toErrorMessage(error), isLoading: false });
    }
  },

  createPlan: async (input) => {
    set({ isSaving: true, error: null });
    try {
      const plan = await commands.upsertStudyPlan(input);
      let session: StudyPlanSession | null = null;
      try {
        session = await commands.generateTodayStudySession();
      } catch {
        session = null;
      }
      const overview = await commands.getStudyPlanOverview();
      set({
        overview: {
          ...overview,
          plan: overview.plan ?? plan,
          today_session: overview.today_session ?? session,
        },
        isSaving: false,
      });
    } catch (error) {
      set({ error: toErrorMessage(error), isSaving: false });
    }
  },

  generateTodaySession: async () => {
    set({ isSaving: true, error: null });
    try {
      const session = await commands.generateTodayStudySession();
      const overview = await commands.getStudyPlanOverview();
      set({
        overview: {
          ...overview,
          today_session: overview.today_session ?? session,
        },
        isSaving: false,
      });
      return session;
    } catch (error) {
      set({ error: toErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  startSession: async (sessionId) => {
    set({ isSaving: true, error: null });
    try {
      const session = await commands.startStudyPlanSession(sessionId);
      const overview = await commands.getStudyPlanOverview();
      set({
        overview: {
          ...overview,
          today_session: session,
        },
        isSaving: false,
      });
      return session;
    } catch (error) {
      set({ error: toErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  completeSession: async (input) => {
    set({ isSaving: true, error: null });
    try {
      const session = await commands.completeStudyPlanSession(input);
      const overview = await commands.getStudyPlanOverview();
      set({
        overview: {
          ...overview,
          today_session: session,
        },
        isSaving: false,
      });
      return session;
    } catch (error) {
      set({ error: toErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  skipSession: async (sessionId) => {
    set({ isSaving: true, error: null });
    try {
      const session = await commands.skipStudyPlanSession(sessionId);
      const overview = await commands.getStudyPlanOverview();
      set({
        overview: {
          ...overview,
          today_session: overview.today_session ?? session,
        },
        isSaving: false,
      });
      return session;
    } catch (error) {
      set({ error: toErrorMessage(error), isSaving: false });
      throw error;
    }
  },

  reset: () => set({ overview: emptyOverview, isLoading: false, isSaving: false, error: null }),
}));
