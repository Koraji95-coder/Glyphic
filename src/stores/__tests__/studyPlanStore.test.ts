import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCommands = vi.hoisted(() => ({
  getStudyPlanOverview: vi.fn(),
  upsertStudyPlan: vi.fn(),
  generateTodayStudySession: vi.fn(),
  startStudyPlanSession: vi.fn(),
  completeStudyPlanSession: vi.fn(),
  skipStudyPlanSession: vi.fn(),
}));

vi.mock('../../lib/tauri/commands', () => ({
  commands: mockCommands,
}));

const plan = {
  id: 1,
  exam_name: 'FE Electrical and Computer',
  target_exam_date: null,
  daily_minutes: 45,
  weekly_minutes: 240,
  created_at: '2026-05-17T00:00:00Z',
  updated_at: '2026-05-17T00:00:00Z',
};

const session = {
  id: 7,
  plan_id: 1,
  planned_date: '2026-05-17',
  topic_id: 2,
  topic_name: 'AC Circuits',
  duration_minutes: 45,
  question_target: 15,
  status: 'planned' as const,
  started_at: null,
  completed_at: null,
  total_questions: 0,
  correct: 0,
  reflection: '',
  created_at: '2026-05-17T00:00:00Z',
  updated_at: '2026-05-17T00:00:00Z',
};

const overview = {
  plan,
  today_session: session,
  upcoming_sessions: [session],
  completed_this_week: 0,
  planned_minutes_this_week: 45,
  completed_minutes_this_week: 0,
};

describe('studyPlanStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useStudyPlanStore } = await import('../studyPlanStore');
    useStudyPlanStore.getState().reset();
  });

  it('loads the active study plan overview', async () => {
    mockCommands.getStudyPlanOverview.mockResolvedValue(overview);
    const { useStudyPlanStore } = await import('../studyPlanStore');

    await useStudyPlanStore.getState().loadOverview();

    expect(useStudyPlanStore.getState().overview.today_session?.topic_name).toBe('AC Circuits');
    expect(useStudyPlanStore.getState().isLoading).toBe(false);
  });

  it('creates a plan and generates the first daily session', async () => {
    mockCommands.upsertStudyPlan.mockResolvedValue(plan);
    mockCommands.generateTodayStudySession.mockResolvedValue(session);
    mockCommands.getStudyPlanOverview.mockResolvedValue(overview);
    const { useStudyPlanStore } = await import('../studyPlanStore');

    await useStudyPlanStore.getState().createPlan({
      target_exam_date: null,
      daily_minutes: 45,
      weekly_minutes: 240,
    });

    expect(mockCommands.upsertStudyPlan).toHaveBeenCalledWith({
      target_exam_date: null,
      daily_minutes: 45,
      weekly_minutes: 240,
    });
    expect(mockCommands.generateTodayStudySession).toHaveBeenCalled();
    expect(useStudyPlanStore.getState().overview.today_session?.id).toBe(7);
  });
});
