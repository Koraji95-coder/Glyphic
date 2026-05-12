export interface MasteryLevelDto {
  id: string;
  topic: string;
  mastery_level: number;
  lower_95: number;
  upper_95: number;
  attempt_count: number;
  last_studied: string;
  note_id?: string;
  batch_id?: string;
}

export interface StudyAttemptDto {
  id: string;
  note_id: string;
  topic: string;
  question: string;
  student_response?: string;
  score?: number;
  is_correct?: boolean;
  time_to_solution_ms?: number;
  misconceptions_detected: string[];
  created_at: string;
  ai_feedback?: string;
  confidence?: number;
}

export interface TopicRelationshipCountsDto {
  topic: string;
  prerequisite_count: number;
  dependent_count: number;
}
