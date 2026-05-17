import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import ClipboardCheck from 'lucide-react/dist/esm/icons/clipboard-check';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3';
import Play from 'lucide-react/dist/esm/icons/play';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import SkipForward from 'lucide-react/dist/esm/icons/skip-forward';
import Target from 'lucide-react/dist/esm/icons/target';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

import { useLayoutStore } from '../../stores/layoutStore';
import { useStudyPlanStore } from '../../stores/studyPlanStore';
import type { StudyPlanSession } from '../../types/studyPlan';

export function StudyPlanCard() {
  const openFePrep = useLayoutStore((state) => state.openFePrep);
  const {
    overview,
    isLoading,
    isSaving,
    error,
    loadOverview,
    createPlan,
    generateTodaySession,
    startSession,
    completeSession,
    skipSession,
  } = useStudyPlanStore();

  const [targetExamDate, setTargetExamDate] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(45);
  const [weeklyMinutes, setWeeklyMinutes] = useState(240);
  const [totalQuestions, setTotalQuestions] = useState(12);
  const [correct, setCorrect] = useState(0);
  const [reflection, setReflection] = useState('');

  const session = overview.today_session;
  const weeklyProgress = useMemo(() => {
    if (!overview.plan || overview.plan.weekly_minutes <= 0) return 0;
    return Math.min(100, Math.round((overview.completed_minutes_this_week / overview.plan.weekly_minutes) * 100));
  }, [overview.completed_minutes_this_week, overview.plan]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!session) return;
    setTotalQuestions(Math.max(1, session.total_questions || session.question_target || 12));
    setCorrect(Math.max(0, session.correct || 0));
    setReflection(session.reflection ?? '');
  }, [session]);

  const handleCreatePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createPlan({
      target_exam_date: targetExamDate || null,
      daily_minutes: dailyMinutes,
      weekly_minutes: weeklyMinutes,
    });
  };

  const handleStart = async (studySession: StudyPlanSession) => {
    try {
      await startSession(studySession.id);
      openFePrep();
    } catch {
      return;
    }
  };

  const handleComplete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    try {
      await completeSession({
        session_id: session.id,
        total_questions: totalQuestions,
        correct,
        reflection,
      });
    } catch {
      return;
    }
  };

  const handleGenerateToday = async () => {
    try {
      await generateTodaySession();
    } catch {
      return;
    }
  };

  const handleSkip = async (studySession: StudyPlanSession) => {
    try {
      await skipSession(studySession.id);
    } catch {
      return;
    }
  };

  return (
    <section style={panelStyle} aria-labelledby="study-plan-heading">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p style={eyebrowStyle}>Plan, study, review</p>
          <h2 id="study-plan-heading" style={headingStyle}>
            Today's plan
          </h2>
          <p style={bodyStyle}>
            Keep FE Electrical practice grounded in one planned session, then record the review outcome before moving
            on.
          </p>
        </div>
        <div style={progressSummaryStyle}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>This week</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: 18 }}>
            {overview.completed_minutes_this_week}/{overview.plan?.weekly_minutes ?? 0} min
          </strong>
          <div style={progressTrackStyle}>
            <div style={{ ...progressFillStyle, width: `${weeklyProgress}%` }} />
          </div>
        </div>
      </div>

      {isLoading && !overview.plan ? (
        <div style={emptyStateStyle}>Loading study plan...</div>
      ) : overview.plan ? (
        <div className="grid gap-4" style={{ marginTop: 18 }}>
          <PlanMeta session={session} dailyMinutes={overview.plan.daily_minutes} />
          {session ? (
            <SessionWorkflow
              session={session}
              isSaving={isSaving}
              totalQuestions={totalQuestions}
              correct={correct}
              reflection={reflection}
              setTotalQuestions={setTotalQuestions}
              setCorrect={setCorrect}
              setReflection={setReflection}
              onStart={() => handleStart(session)}
              onOpenFePrep={openFePrep}
              onComplete={handleComplete}
              onSkip={() => handleSkip(session)}
              onGenerateToday={handleGenerateToday}
            />
          ) : (
            <div style={emptyStateStyle}>
              <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>No session planned for today</p>
              <p style={smallTextStyle}>Generate one local FE review session from weak-topic and practice history.</p>
              <button type="button" onClick={handleGenerateToday} disabled={isSaving} style={primaryButtonStyle}>
                <CalendarDays size={16} />
                Plan today's session
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleCreatePlan} style={{ ...setupFormStyle, marginTop: 18 }}>
          <div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>Create an FE study plan</h3>
            <p style={smallTextStyle}>
              Start with daily minutes and a weekly target. Glyphic will generate today's first review session locally.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label style={fieldStyle} htmlFor="study-plan-target-date">
              <span style={labelStyle}>Exam date</span>
              <input
                id="study-plan-target-date"
                name="target_exam_date"
                type="date"
                value={targetExamDate}
                onChange={(event) => setTargetExamDate(event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle} htmlFor="study-plan-daily-minutes">
              <span style={labelStyle}>Daily minutes</span>
              <input
                id="study-plan-daily-minutes"
                name="daily_minutes"
                type="number"
                min={15}
                max={240}
                value={dailyMinutes}
                onChange={(event) => setDailyMinutes(Number(event.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle} htmlFor="study-plan-weekly-minutes">
              <span style={labelStyle}>Weekly minutes</span>
              <input
                id="study-plan-weekly-minutes"
                name="weekly_minutes"
                type="number"
                min={60}
                max={2400}
                value={weeklyMinutes}
                onChange={(event) => setWeeklyMinutes(Number(event.target.value))}
                style={inputStyle}
              />
            </label>
          </div>
          <button type="submit" disabled={isSaving} style={primaryButtonStyle}>
            <Target size={16} />
            Create study plan
          </button>
        </form>
      )}

      {error && (
        <p role="alert" style={errorStyle}>
          {error}
        </p>
      )}
    </section>
  );
}

function PlanMeta({ session, dailyMinutes }: { session: StudyPlanSession | null; dailyMinutes: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <MetaItem
        icon={<Clock3 size={16} />}
        label="Target time"
        value={`${session?.duration_minutes ?? dailyMinutes} min`}
      />
      <MetaItem
        icon={<ClipboardCheck size={16} />}
        label="Questions"
        value={`${session?.question_target ?? Math.max(5, Math.floor(dailyMinutes / 3))} target`}
      />
      <MetaItem icon={<Target size={16} />} label="Focus" value={session?.topic_name ?? 'Weak-topic review'} />
    </div>
  );
}

function SessionWorkflow({
  session,
  isSaving,
  totalQuestions,
  correct,
  reflection,
  setTotalQuestions,
  setCorrect,
  setReflection,
  onStart,
  onOpenFePrep,
  onComplete,
  onSkip,
  onGenerateToday,
}: {
  session: StudyPlanSession;
  isSaving: boolean;
  totalQuestions: number;
  correct: number;
  reflection: string;
  setTotalQuestions: (value: number) => void;
  setCorrect: (value: number) => void;
  setReflection: (value: string) => void;
  onStart: () => void;
  onOpenFePrep: () => void;
  onComplete: (event: FormEvent<HTMLFormElement>) => void;
  onSkip: () => void;
  onGenerateToday: () => void;
}) {
  if (session.status === 'completed') {
    const accuracy = session.total_questions > 0 ? Math.round((session.correct / session.total_questions) * 100) : 0;
    return (
      <div style={sessionPanelStyle}>
        <div className="flex items-center gap-3">
          <span style={successIconStyle}>
            <CheckCircle2 size={18} />
          </span>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Session complete</p>
            <p style={smallTextStyle}>
              {session.total_questions > 0
                ? `${accuracy}% accuracy on ${session.topic_name}`
                : `Review logged for ${session.topic_name}`}
            </p>
          </div>
        </div>
        {session.reflection && <p style={reflectionStyle}>{session.reflection}</p>}
        <p style={smallTextStyle}>Next recommendation: use FE Prep to add another short drill for this topic.</p>
        <button type="button" onClick={onOpenFePrep} style={secondaryButtonStyle}>
          <Play size={16} />
          Open FE Prep
        </button>
      </div>
    );
  }

  if (session.status === 'in_progress') {
    return (
      <form onSubmit={onComplete} style={sessionPanelStyle}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Session in progress</p>
            <p style={smallTextStyle}>{session.topic_name}</p>
          </div>
          <button type="button" onClick={onOpenFePrep} style={secondaryButtonStyle}>
            <Play size={16} />
            Continue FE Prep
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label style={fieldStyle} htmlFor="study-plan-total-questions">
            <span style={labelStyle}>Questions completed</span>
            <input
              id="study-plan-total-questions"
              name="total_questions"
              type="number"
              min={0}
              value={totalQuestions}
              onChange={(event) => setTotalQuestions(Number(event.target.value))}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle} htmlFor="study-plan-correct-count">
            <span style={labelStyle}>Correct answers</span>
            <input
              id="study-plan-correct-count"
              name="correct"
              type="number"
              min={0}
              max={totalQuestions}
              value={correct}
              onChange={(event) => setCorrect(Number(event.target.value))}
              style={inputStyle}
            />
          </label>
        </div>
        <label style={fieldStyle} htmlFor="study-plan-reflection">
          <span style={labelStyle}>Review note</span>
          <textarea
            id="study-plan-reflection"
            name="reflection"
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="What should you review before the next session?"
            style={{ ...inputStyle, minHeight: 86, resize: 'vertical' }}
          />
        </label>
        <button type="submit" disabled={isSaving} style={primaryButtonStyle}>
          <CheckCircle2 size={16} />
          Complete session
        </button>
      </form>
    );
  }

  if (session.status === 'skipped') {
    return (
      <div style={sessionPanelStyle}>
        <div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Today's session was skipped</p>
          <p style={smallTextStyle}>Replan when you have a clear block of time, or open FE Prep for free practice.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onGenerateToday} disabled={isSaving} style={primaryButtonStyle}>
            <RotateCcw size={16} />
            Replan today
          </button>
          <button type="button" onClick={onOpenFePrep} style={secondaryButtonStyle}>
            <Play size={16} />
            Open FE Prep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={sessionPanelStyle}>
      <div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{session.topic_name}</p>
        <p style={smallTextStyle}>
          {session.duration_minutes} minutes · {session.question_target} questions · planned for {session.planned_date}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onStart} disabled={isSaving} style={primaryButtonStyle}>
          <Play size={16} />
          Start planned session
        </button>
        <button type="button" onClick={onSkip} disabled={isSaving} style={secondaryButtonStyle}>
          <SkipForward size={16} />
          Skip
        </button>
      </div>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={metaItemStyle}>
      <span style={mutedIconStyle}>{icon}</span>
      <div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</p>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 2 }}>{value}</p>
      </div>
    </div>
  );
}

const panelStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 20,
  marginBottom: 20,
};

const eyebrowStyle = {
  color: 'var(--accent)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  marginBottom: 8,
  textTransform: 'uppercase' as const,
};

const headingStyle = {
  color: 'var(--text-primary)',
  fontSize: 20,
  lineHeight: 1.2,
  fontWeight: 700,
};

const bodyStyle = {
  color: 'var(--text-secondary)',
  maxWidth: 680,
  marginTop: 8,
  lineHeight: 1.55,
};

const smallTextStyle = {
  color: 'var(--text-secondary)',
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 4,
};

const setupFormStyle = {
  display: 'grid',
  gap: 14,
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 16,
  background: 'var(--bg-hover)',
};

const sessionPanelStyle = {
  display: 'grid',
  gap: 14,
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 16,
  background: 'var(--bg-hover)',
};

const progressSummaryStyle = {
  display: 'grid',
  gap: 6,
  minWidth: 180,
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  padding: 12,
  background: 'var(--bg-hover)',
};

const progressTrackStyle = {
  height: 8,
  borderRadius: '999px',
  background: 'var(--bg-app)',
  overflow: 'hidden',
};

const progressFillStyle = {
  height: '100%',
  borderRadius: '999px',
  background: 'var(--accent)',
};

const metaItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  padding: 12,
  background: 'rgba(255,255,255,0.025)',
};

const mutedIconStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 34,
  height: 34,
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent-dim)',
  color: 'var(--accent)',
  flex: '0 0 auto',
};

const successIconStyle = {
  ...mutedIconStyle,
  background: 'var(--accent-mastery-dim)',
  color: 'var(--accent-mastery)',
};

const fieldStyle = {
  display: 'grid',
  gap: 6,
};

const labelStyle = {
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
};

const inputStyle = {
  width: '100%',
  minHeight: 40,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  padding: '0 12px',
};

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 40,
  width: 'fit-content',
  padding: '0 14px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--accent)',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 38,
  width: 'fit-content',
  padding: '0 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontWeight: 700,
  cursor: 'pointer',
};

const emptyStateStyle = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: 16,
  background: 'var(--bg-hover)',
  color: 'var(--text-secondary)',
};

const reflectionStyle = {
  color: 'var(--text-primary)',
  borderLeft: '3px solid var(--accent)',
  paddingLeft: 12,
  lineHeight: 1.5,
};

const errorStyle = {
  color: 'var(--accent-review)',
  fontSize: 13,
  marginTop: 12,
};
