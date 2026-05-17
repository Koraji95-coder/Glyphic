export type StudyPlanSessionStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export interface StudyPlan {
  id: number;
  exam_name: string;
  target_exam_date: string | null;
  daily_minutes: number;
  weekly_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface StudyPlanSession {
  id: number;
  plan_id: number;
  planned_date: string;
  topic_id: number;
  topic_name: string;
  duration_minutes: number;
  question_target: number;
  status: StudyPlanSessionStatus;
  started_at: string | null;
  completed_at: string | null;
  total_questions: number;
  correct: number;
  reflection: string;
  created_at: string;
  updated_at: string;
}

export interface StudyPlanOverview {
  plan: StudyPlan | null;
  today_session: StudyPlanSession | null;
  upcoming_sessions: StudyPlanSession[];
  completed_this_week: number;
  planned_minutes_this_week: number;
  completed_minutes_this_week: number;
}

export interface UpsertStudyPlanInput {
  target_exam_date?: string | null;
  daily_minutes: number;
  weekly_minutes: number;
}

export interface CompleteStudyPlanSessionInput {
  session_id: number;
  total_questions: number;
  correct: number;
  reflection?: string | null;
}
