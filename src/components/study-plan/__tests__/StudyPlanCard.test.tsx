import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutStore } from '../../../stores/layoutStore';
import { useStudyPlanStore } from '../../../stores/studyPlanStore';
import type { StudyPlanOverview, StudyPlanSession } from '../../../types/studyPlan';
import { StudyPlanCard } from '../StudyPlanCard';

const mockCommands = vi.hoisted(() => ({
  getStudyPlanOverview: vi.fn(),
  upsertStudyPlan: vi.fn(),
  generateTodayStudySession: vi.fn(),
  startStudyPlanSession: vi.fn(),
  completeStudyPlanSession: vi.fn(),
  skipStudyPlanSession: vi.fn(),
}));

vi.mock('../../../lib/tauri/commands', () => ({
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

const plannedSession: StudyPlanSession = {
  id: 9,
  plan_id: 1,
  planned_date: '2026-05-17',
  topic_id: 2,
  topic_name: 'AC Circuits',
  duration_minutes: 45,
  question_target: 15,
  status: 'planned',
  started_at: null,
  completed_at: null,
  total_questions: 0,
  correct: 0,
  reflection: '',
  created_at: '2026-05-17T00:00:00Z',
  updated_at: '2026-05-17T00:00:00Z',
};

const emptyOverview: StudyPlanOverview = {
  plan: null,
  today_session: null,
  upcoming_sessions: [],
  completed_this_week: 0,
  planned_minutes_this_week: 0,
  completed_minutes_this_week: 0,
};

function overviewWith(session: StudyPlanSession | null): StudyPlanOverview {
  return {
    plan,
    today_session: session,
    upcoming_sessions: session ? [session] : [],
    completed_this_week: 0,
    planned_minutes_this_week: session?.duration_minutes ?? 0,
    completed_minutes_this_week: 0,
  };
}

describe('StudyPlanCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStudyPlanStore.getState().reset();
    useLayoutStore.setState({
      activeMode: 'editor',
      isFePrepMode: false,
      isVaultMode: false,
      isDiagramMode: false,
      isMasteryMode: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows setup state when no active plan exists', async () => {
    mockCommands.getStudyPlanOverview.mockResolvedValue(emptyOverview);

    render(<StudyPlanCard />);

    expect(await screen.findByText(/create an fe study plan/i)).toBeTruthy();
    expect(screen.getByLabelText(/daily minutes/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create study plan/i })).toBeTruthy();
  });

  it('starts today planned session and opens FE Prep', async () => {
    const inProgress = { ...plannedSession, status: 'in_progress' as const, started_at: '2026-05-17T12:00:00Z' };
    mockCommands.getStudyPlanOverview.mockResolvedValue(overviewWith(plannedSession));
    mockCommands.startStudyPlanSession.mockResolvedValue(inProgress);

    render(<StudyPlanCard />);

    fireEvent.click(await screen.findByRole('button', { name: /start planned session/i }));

    await waitFor(() => expect(mockCommands.startStudyPlanSession).toHaveBeenCalledWith(9));
    expect(useLayoutStore.getState().isFePrepMode).toBe(true);
  });

  it('records completion counts and reloads the overview', async () => {
    const inProgress = { ...plannedSession, status: 'in_progress' as const, started_at: '2026-05-17T12:00:00Z' };
    const completed = {
      ...inProgress,
      status: 'completed' as const,
      completed_at: '2026-05-17T13:00:00Z',
      total_questions: 12,
      correct: 9,
      reflection: 'Review impedance.',
    };
    mockCommands.getStudyPlanOverview.mockResolvedValue(overviewWith(inProgress));
    mockCommands.completeStudyPlanSession.mockResolvedValue(completed);

    render(<StudyPlanCard />);

    fireEvent.change(await screen.findByLabelText(/questions completed/i), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText(/correct answers/i), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText(/review note/i), { target: { value: 'Review impedance.' } });
    fireEvent.click(screen.getByRole('button', { name: /complete session/i }));

    await waitFor(() =>
      expect(mockCommands.completeStudyPlanSession).toHaveBeenCalledWith({
        session_id: 9,
        total_questions: 12,
        correct: 9,
        reflection: 'Review impedance.',
      }),
    );
    expect(mockCommands.getStudyPlanOverview).toHaveBeenCalledTimes(2);
  });
});
