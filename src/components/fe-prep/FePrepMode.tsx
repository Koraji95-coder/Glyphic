import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  BookOpen,
  CheckCircle,
  ChevronRight,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { reportError } from '../../lib/errorReporter';
import type { FeTopic, FeTopicStats, FeWeakTopic, MathGradeResult } from '../../lib/tauri/commands';
import { commands } from '../../lib/tauri/commands';
import { useLayoutStore } from '../../stores/layoutStore';
import { MathBlock } from '../common/Math';
import { QuestionBankPanel } from './QuestionBankPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

type View = 'browser' | 'session' | 'dashboard';
type SessionMode = 'practice' | 'exam' | 'question-bank';

interface SessionState {
  sessionId: number;
  topicId: number;
  topicName: string;
  mode: SessionMode;
  durationSeconds: number | null;
  remainingSeconds: number | null;
  breakTaken: boolean;
  finalized: boolean;
  questionId: number | null;
  seenQuestionIds: number[];
  question: string;
  answer: string;
  userAnswer: string;
  revealed: boolean;
  questionCount: number;
  correctCount: number;
  startedAt: number; // timestamp ms
}

const EXAM_PRESET_MINUTES = [60, 180, 360] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function accuracyColor(pct: number) {
  if (pct >= 0.7) return 'var(--green, #4ade80)';
  if (pct >= 0.5) return '#facc15';
  return 'var(--red, #f87171)';
}

function groupByCategory(topics: FeTopic[]): Record<string, FeTopic[]> {
  return topics.reduce<Record<string, FeTopic[]>>((acc, t) => {
    const cat = t.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});
}

function formatDuration(seconds: number) {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getCountdownColor(remainingSeconds: number, totalSeconds: number) {
  const ratio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  if (ratio <= 0.05) return 'var(--red, #f87171)';
  if (ratio <= 0.1) return '#f59e0b';
  return 'var(--text-primary)';
}

function evaluateExamResult(userAnswer: string, correctAnswer: string): 'correct' | 'incorrect' | 'skipped' {
  if (!userAnswer.trim()) return 'skipped';
  const normalizedUser = userAnswer.trim().toLowerCase();
  const normalizedCorrect = correctAnswer.trim().toLowerCase();
  return normalizedUser === normalizedCorrect ? 'correct' : 'incorrect';
}

// ── Main component ────────────────────────────────────────────────────────────

export function FePrepMode() {
  const closeFePrep = useLayoutStore((s) => s.closeFePrep);
  const [view, setView] = useState<View>('browser');
  const [sessionMode, setSessionMode] = useState<SessionMode>('practice');
  const [examPresetMinutes, setExamPresetMinutes] = useState<string>('60');
  const [customExamMinutes, setCustomExamMinutes] = useState('60');
  const [topics, setTopics] = useState<FeTopic[]>([]);
  const [stats, setStats] = useState<FeTopicStats[]>([]);
  const [weakTopics, setWeakTopics] = useState<FeWeakTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionState | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const finalizingRef = useRef(false);
  const tickingRef = useRef(false);

  // Load topics + stats on mount
  useEffect(() => {
    const load = async () => {
      try {
        await commands.seedQuestionBank().catch((e) => {
          reportError({
            context: 'FE prep seed',
            message: 'Question bank seed skipped; continuing with existing data',
            error: e,
          });
        });
        const [t, s, w] = await Promise.all([
          commands.listFeTopics(),
          commands.getFeStatistics(),
          commands.getWeakFeTopics(),
        ]);
        setTopics(t);
        setStats(s);
        setWeakTopics(w);
      } catch (e) {
        reportError({ context: 'FE Prep initialization', message: 'Failed to load FE Prep data', error: e });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const statsMap = new Map(stats.map((s) => [s.topic_id, s]));

  const selectedExamDurationSeconds = useCallback(() => {
    const parsedCustom = Number.parseInt(customExamMinutes, 10);
    const minutes =
      examPresetMinutes === 'custom'
        ? Number.isFinite(parsedCustom) && parsedCustom > 0
          ? parsedCustom
          : 60
        : Number.parseInt(examPresetMinutes, 10);
    return Math.max(60, minutes * 60);
  }, [customExamMinutes, examPresetMinutes]);

  const startSession = useCallback(
    async (topic: FeTopic) => {
      try {
        const isExam = sessionMode === 'exam';
        const durationSeconds = isExam ? selectedExamDurationSeconds() : undefined;
        const sessionId = await commands.startFeSession(isExam ? 'exam' : 'practice', [topic.name], durationSeconds);
        setSession({
          sessionId,
          topicId: topic.id,
          topicName: topic.name,
          mode: isExam ? 'exam' : 'practice',
          durationSeconds: isExam ? (durationSeconds ?? null) : null,
          remainingSeconds: isExam ? (durationSeconds ?? null) : null,
          breakTaken: false,
          finalized: false,
          questionId: null,
          seenQuestionIds: [],
          question: '',
          answer: '',
          userAnswer: '',
          revealed: false,
          questionCount: 0,
          correctCount: 0,
          startedAt: Date.now(),
        });
        setView('session');
      } catch (e) {
        reportError({ context: 'FE Prep session start', message: 'Failed to start session', error: e });
      }
    },
    [selectedExamDurationSeconds, sessionMode],
  );

  const endSession = useCallback(async () => {
    if (!session) return;
    try {
      await commands.completeFeSession(session.sessionId, session.questionCount, session.correctCount);
    } catch (e) {
      reportError({ context: 'FE Prep session completion', message: 'Failed to complete session', error: e });
    }
    setSession(null);
    // Refresh stats
    const [s, w] = await Promise.all([commands.getFeStatistics(), commands.getWeakFeTopics()]);
    setStats(s);
    setWeakTopics(w);
    setView('browser');
  }, [session]);

  const finalizeExamNow = useCallback(async () => {
    if (!session || session.mode !== 'exam' || session.finalized || finalizingRef.current) return;
    finalizingRef.current = true;

    let totalQuestions = session.questionCount;
    let totalCorrect = session.correctCount;

    const hasActiveQuestion = Boolean(session.question.trim()) && session.questionId !== null;
    if (hasActiveQuestion) {
      const elapsed = Math.round((Date.now() - session.startedAt) / 1000);
      const result = evaluateExamResult(session.userAnswer, session.answer);
      try {
        await commands.recordFeAttempt(
          session.topicId,
          result,
          elapsed,
          session.questionId,
          undefined,
          session.question,
          session.userAnswer,
          session.answer,
        );
        totalQuestions += 1;
        if (result === 'correct') totalCorrect += 1;
      } catch (e) {
        reportError({ context: 'FE Prep exam auto-submit', message: 'Failed to auto-submit exam question', error: e });
      }
    }

    try {
      await commands.completeFeSession(session.sessionId, totalQuestions, totalCorrect);
    } catch (e) {
      reportError({ context: 'FE Prep exam finalize', message: 'Failed to finalize exam', error: e });
    }

    setSession((prev) =>
      prev
        ? {
            ...prev,
            questionCount: totalQuestions,
            correctCount: totalCorrect,
            remainingSeconds: 0,
            finalized: true,
            revealed: true,
          }
        : null,
    );
    finalizingRef.current = false;
  }, [session]);

  const recordAttempt = useCallback(
    async (result: 'correct' | 'incorrect' | 'skipped') => {
      if (!session || session.finalized) return;
      const elapsed = Math.round((Date.now() - session.startedAt) / 1000);
      try {
        await commands.recordFeAttempt(
          session.topicId,
          result,
          elapsed,
          session.questionId,
          undefined,
          session.question,
          session.userAnswer,
          session.answer,
        );
      } catch (e) {
        reportError({ context: 'FE Prep attempt recording', message: 'Failed to record attempt', error: e });
      }
      setSession((prev) =>
        prev
          ? {
              ...prev,
              questionId: null,
              question: '',
              answer: '',
              questionCount: prev.questionCount + 1,
              correctCount: prev.correctCount + (result === 'correct' ? 1 : 0),
              userAnswer: '',
              revealed: false,
              startedAt: Date.now(),
            }
          : null,
      );
    },
    [session],
  );

  const submitExamAnswer = useCallback(async () => {
    if (!session || session.mode !== 'exam' || session.finalized) return;
    const result = evaluateExamResult(session.userAnswer, session.answer);
    await recordAttempt(result);
  }, [recordAttempt, session]);

  const consumeBreak = useCallback(async () => {
    if (!session || session.mode !== 'exam' || session.breakTaken || session.finalized) return;
    try {
      const tick = await commands.takeBreak(session.sessionId);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              breakTaken: true,
              remainingSeconds: tick.remaining_seconds,
            }
          : null,
      );
    } catch (e) {
      reportError({ context: 'FE Prep break', message: 'Failed to take break', error: e });
    }
  }, [session]);

  useEffect(() => {
    if (!session || session.mode !== 'exam' || session.finalized) return;
    const interval = window.setInterval(async () => {
      if (tickingRef.current || finalizingRef.current) return;
      tickingRef.current = true;
      try {
        const tick = await commands.tickSession(session.sessionId);
        setSession((prev) =>
          prev
            ? {
                ...prev,
                remainingSeconds: tick.remaining_seconds,
              }
            : null,
        );
        if (tick.expired || tick.remaining_seconds <= 0) {
          await finalizeExamNow();
        }
      } catch (e) {
        reportError({ context: 'FE Prep exam timer', message: 'Failed to tick exam session', error: e });
      } finally {
        tickingRef.current = false;
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [finalizeExamNow, session]);

  if (loading) return <LoadingSpinner />;

  if (sessionMode === 'question-bank') {
    return <QuestionBankPanel onExit={() => setSessionMode('practice')} />;
  }

  if (view === 'session' && session) {
    return (
      <PracticeSession
        session={session}
        answerRef={answerRef}
        onReveal={(answer) => setSession((s) => (s ? { ...s, answer, revealed: true } : null))}
        onStoreAnswer={(answer) => setSession((s) => (s ? { ...s, answer } : null))}
        onQuestionGenerated={(question) => setSession((s) => (s ? { ...s, question, questionId: null } : null))}
        onBankQuestionLoaded={(questionId) =>
          setSession((s) =>
            s
              ? {
                  ...s,
                  questionId,
                  seenQuestionIds: Array.from(new Set([...s.seenQuestionIds, questionId])),
                }
              : null,
          )
        }
        onUserAnswerChange={(val) => setSession((s) => (s ? { ...s, userAnswer: val } : null))}
        onExamSubmit={submitExamAnswer}
        onExamExhausted={finalizeExamNow}
        onTakeBreak={consumeBreak}
        onRecord={recordAttempt}
        onEnd={endSession}
        onExit={closeFePrep}
      />
    );
  }

  if (view === 'dashboard') {
    return <ProgressDashboard stats={stats} topics={topics} onBack={() => setView('browser')} onExit={closeFePrep} />;
  }

  // Default: Topic Browser
  return (
    <TopicBrowser
      topics={topics}
      statsMap={statsMap}
      weakTopics={weakTopics}
      sessionMode={sessionMode}
      examPresetMinutes={examPresetMinutes}
      customExamMinutes={customExamMinutes}
      onSessionModeChange={setSessionMode}
      onExamPresetMinutesChange={setExamPresetMinutes}
      onCustomExamMinutesChange={setCustomExamMinutes}
      onStartSession={startSession}
      onViewDashboard={() => setView('dashboard')}
      onExit={closeFePrep}
    />
  );
}

// ── Topic Browser ─────────────────────────────────────────────────────────────

function TopicBrowser({
  topics,
  statsMap,
  weakTopics,
  sessionMode,
  examPresetMinutes,
  customExamMinutes,
  onSessionModeChange,
  onExamPresetMinutesChange,
  onCustomExamMinutesChange,
  onStartSession,
  onViewDashboard,
  onExit,
}: {
  topics: FeTopic[];
  statsMap: Map<number, FeTopicStats>;
  weakTopics: FeWeakTopic[];
  sessionMode: SessionMode;
  examPresetMinutes: string;
  customExamMinutes: string;
  onSessionModeChange: (mode: SessionMode) => void;
  onExamPresetMinutesChange: (minutes: string) => void;
  onCustomExamMinutesChange: (minutes: string) => void;
  onStartSession: (topic: FeTopic) => void;
  onViewDashboard: () => void;
  onExit: () => void;
}) {
  const grouped = groupByCategory(topics);
  const totalAttempts = Array.from(statsMap.values()).reduce((sum, stat) => sum + stat.attempts, 0);
  const answeredTopics = Array.from(statsMap.values()).filter((stat) => stat.attempts > 0).length;
  const averageAccuracy =
    totalAttempts > 0
      ? Math.round(
          (Array.from(statsMap.values()).reduce((sum, stat) => sum + stat.accuracy * stat.attempts, 0) /
            totalAttempts) *
            100,
        )
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={18} style={{ color: 'var(--accent)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-ghost)',
              }}
            >
              FE Study Workspace / Topic Browser
            </span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>FE Exam Prep</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onViewDashboard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <BarChart2 size={13} />
            Progress
          </button>
          <button
            type="button"
            onClick={onExit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={13} />
            Back To Notes
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '10px',
            marginBottom: '14px',
          }}
        >
          {[
            { label: 'Total Topics', value: String(topics.length) },
            { label: 'Answered Topics', value: String(answeredTopics) },
            { label: 'Average Accuracy', value: totalAttempts > 0 ? `${averageAccuracy}%` : 'No data' },
            { label: 'Weak Topics', value: String(weakTopics.length) },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-ghost)',
                  marginBottom: '4px',
                }}
              >
                {item.label}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginBottom: '16px',
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-ghost)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Session Mode
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="radio"
                checked={sessionMode === 'practice'}
                onChange={() => onSessionModeChange('practice')}
              />
              Practice
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              <input type="radio" checked={sessionMode === 'exam'} onChange={() => onSessionModeChange('exam')} />
              Timed Exam
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="radio"
                checked={sessionMode === 'question-bank'}
                onChange={() => onSessionModeChange('question-bank')}
              />
              Question Bank
            </label>
          </div>
          {sessionMode === 'exam' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Duration:</span>
              {EXAM_PRESET_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => onExamPresetMinutesChange(String(minutes))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    border: '1px solid var(--border)',
                    backgroundColor: examPresetMinutes === String(minutes) ? 'var(--accent-dim)' : 'transparent',
                    color: examPresetMinutes === String(minutes) ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {minutes} min
                </button>
              ))}
              <button
                type="button"
                onClick={() => onExamPresetMinutesChange('custom')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: '1px solid var(--border)',
                  backgroundColor: examPresetMinutes === 'custom' ? 'var(--accent-dim)' : 'transparent',
                  color: examPresetMinutes === 'custom' ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Custom
              </button>
              {examPresetMinutes === 'custom' && (
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={customExamMinutes}
                  onChange={(e) => onCustomExamMinutesChange(e.target.value)}
                  style={{
                    width: '90px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-editor)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Weak topics alert */}
        {weakTopics.length > 0 && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(250,204,21,0.3)',
              backgroundColor: 'rgba(250,204,21,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <AlertTriangle size={14} style={{ color: '#facc15' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#facc15' }}>Weak Areas — focus here first</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {weakTopics.map((w) => {
                const topic = topics.find((t) => t.id === w.topic_id);
                if (!topic) return null;
                return (
                  <button
                    type="button"
                    key={w.topic_id}
                    onClick={() => onStartSession(topic)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '20px',
                      border: '1px solid rgba(250,204,21,0.4)',
                      backgroundColor: 'rgba(250,204,21,0.1)',
                      color: '#facc15',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {w.name}
                    <span style={{ opacity: 0.7 }}>({Math.round(w.accuracy * 100)}%)</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {topics.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📚</div>
            <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No topics yet</p>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Topics will appear here once seeded into the database.
            </p>
          </div>
        )}

        {/* Grouped topic list */}
        {Object.entries(grouped).map(([category, catTopics]) => (
          <div key={category} style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-ghost)',
                marginBottom: '10px',
              }}
            >
              {category}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '6px',
              }}
            >
              {catTopics.map((topic) => {
                const s = statsMap.get(topic.id);
                const acc = s && s.attempts > 0 ? s.accuracy : null;
                return (
                  <TopicRow
                    key={topic.id}
                    topic={topic}
                    accuracy={acc}
                    attempts={s?.attempts ?? 0}
                    sessionMode={sessionMode}
                    onStart={() => onStartSession(topic)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicRow({
  topic,
  accuracy,
  attempts,
  sessionMode,
  onStart,
}: {
  topic: FeTopic;
  accuracy: number | null;
  attempts: number;
  sessionMode: SessionMode;
  onStart: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {topic.name}
        </div>
        {accuracy !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '80px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: 'var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(accuracy * 100)}%`,
                  height: '100%',
                  backgroundColor: accuracyColor(accuracy),
                  borderRadius: '2px',
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: accuracyColor(accuracy), fontWeight: 600 }}>
              {Math.round(accuracy * 100)}%
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-ghost)' }}>{attempts} attempts</span>
          </div>
        )}
        {accuracy === null && <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>No attempts yet</span>}
      </div>
      <button
        type="button"
        onClick={onStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '5px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid transparent',
          backgroundColor: 'var(--accent-dim)',
          color: 'var(--accent)',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {sessionMode === 'exam' ? 'Start Exam' : 'Practice'}
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ── Practice Session ──────────────────────────────────────────────────────────

function PracticeSession({
  session,
  answerRef,
  onReveal,
  onStoreAnswer,
  onQuestionGenerated,
  onBankQuestionLoaded,
  onUserAnswerChange,
  onExamSubmit,
  onExamExhausted,
  onTakeBreak,
  onRecord,
  onEnd,
  onExit,
}: {
  session: SessionState;
  answerRef: React.RefObject<HTMLTextAreaElement | null>;
  onReveal: (answer: string) => void;
  onStoreAnswer: (answer: string) => void;
  onQuestionGenerated: (question: string) => void;
  onBankQuestionLoaded: (questionId: number) => void;
  onUserAnswerChange: (val: string) => void;
  onExamSubmit: () => void;
  onExamExhausted: () => void;
  onTakeBreak: () => void;
  onRecord: (result: 'correct' | 'incorrect' | 'skipped') => void;
  onEnd: () => void;
  onExit: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [modelAnswer, setModelAnswer] = useState('');
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<MathGradeResult | null>(null);

  // Auto-generate a question via local-only AI (studyAsk grounds the prompt in
  // vault context server-side, so a single round-trip replaces the old
  // queryVault + aiStudyChat two-step pattern).
  useEffect(() => {
    if (session.revealed) return;
    setGenerating(true);
    setModelAnswer('');
    setGrade(null);

    const generate = async () => {
      const questionNumber = session.questionCount + 1;
      const bankQuestion = await commands.getQuestionForSession(session.topicId, session.seenQuestionIds);
      if (bankQuestion) {
        // In exam mode, if the backend fell back and returned an already-seen question, the
        // question pool is exhausted — finalize instead of repeating.
        if (session.mode === 'exam' && session.seenQuestionIds.includes(bankQuestion.id)) {
          onExamExhausted();
          return;
        }

        const questionText =
          bankQuestion.choices && bankQuestion.choices.length > 0
            ? `${bankQuestion.question_text}\n\n${bankQuestion.choices.join('\n')}`
            : bankQuestion.question_text;
        const explanation = bankQuestion.explanation?.trim();
        const answerText = explanation
          ? `${bankQuestion.correct_answer}\n\n${explanation}`
          : bankQuestion.correct_answer;

        onQuestionGenerated(questionText);
        onBankQuestionLoaded(bankQuestion.id);
        // Store the correct answer in session state immediately so exam-mode
        // auto-submit and finalizeExamNow can evaluate the answer correctly.
        if (session.mode === 'exam') {
          onStoreAnswer(answerText);
        }
        setModelAnswer(answerText);
        return;
      }

      if (session.mode === 'exam') {
        onExamExhausted();
        return;
      }

      const prompt = `You are an FE exam tutor. Generate FE exam practice question #${questionNumber} for the topic: "${session.topicName}". Format: first write the question, then on a new line starting with "ANSWER:" provide the correct answer and a brief explanation.`;

      try {
        // studyAsk orchestrates vault semantic search + Ollama in one command
        const result = await commands.studyAsk(prompt, [session.topicName], 3);
        const response = result.answer;
        const parts = response.split(/\nANSWER:/i);
        if (parts.length >= 2) {
          onQuestionGenerated(parts[0].trim());
          setModelAnswer(parts.slice(1).join('\nANSWER:').trim());
        } else {
          onQuestionGenerated(response.trim());
          setModelAnswer('');
        }
      } catch {
        // studyAsk not available (dev mode) — fall back to aiStudyChat
        const response = await commands.aiStudyChat(prompt);
        const parts = response.split(/\nANSWER:/i);
        if (parts.length >= 2) {
          onQuestionGenerated(parts[0].trim());
          setModelAnswer(parts.slice(1).join('\nANSWER:').trim());
        } else {
          onQuestionGenerated(response.trim());
          setModelAnswer('');
        }
      }
    };

    generate()
      .catch((e) => {
        reportError({ context: 'FE Prep AI question generation', message: 'AI question generation failed', error: e });
        onQuestionGenerated('Could not generate question. Please check your AI connection in Settings.');
        setModelAnswer('');
      })
      .finally(() => setGenerating(false));
  }, [
    session.topicId,
    session.topicName,
    session.seenQuestionIds,
    session.mode,
    session.questionCount,
    session.revealed,
    onQuestionGenerated,
    onBankQuestionLoaded,
    onStoreAnswer,
    onExamExhausted,
  ]);

  const handleReveal = () => {
    onReveal(modelAnswer);
    // Grade the user's answer asynchronously after reveal
    if (session.userAnswer.trim() && modelAnswer.trim()) {
      setGrading(true);
      commands
        .gradeMathAnswer(session.question, session.userAnswer, modelAnswer)
        .then((result) => setGrade(result))
        .catch(() => setGrade(null))
        .finally(() => setGrading(false));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{session.topicName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {session.mode === 'exam' && session.remainingSeconds !== null && session.durationSeconds !== null && (
            <span
              style={{
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '0.03em',
                color: getCountdownColor(session.remainingSeconds, session.durationSeconds),
                minWidth: '78px',
                textAlign: 'right',
              }}
            >
              {formatDuration(session.remainingSeconds)}
            </span>
          )}
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {session.questionCount > 0 && `${session.correctCount}/${session.questionCount} correct`}
          </span>
          {session.mode === 'exam' && (
            <button
              type="button"
              disabled={session.breakTaken || session.finalized}
              onClick={onTakeBreak}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: session.breakTaken ? 'var(--bg-card)' : 'transparent',
                color: session.breakTaken ? 'var(--text-ghost)' : 'var(--text-secondary)',
                fontSize: '12px',
                cursor: session.breakTaken ? 'not-allowed' : 'pointer',
              }}
            >
              {session.breakTaken ? 'Break Used' : 'Take 5-minute Break'}
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Back To Notes
          </button>
          <button
            type="button"
            onClick={onEnd}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            End Session
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {session.questionCount > 0 && (
        <div style={{ height: '3px', backgroundColor: 'var(--border)', flexShrink: 0 }}>
          <div
            style={{
              height: '100%',
              width: `${Math.round((session.correctCount / session.questionCount) * 100)}%`,
              backgroundColor: 'var(--accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxWidth: '700px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {session.finalized && (
          <div
            style={{
              padding: '22px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--accent-muted)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-ghost)',
                marginBottom: '8px',
              }}
            >
              Exam Complete
            </div>
            <p style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
              Final Score: {session.correctCount}/{session.questionCount}
            </p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
              Accuracy:{' '}
              {session.questionCount > 0 ? Math.round((session.correctCount / session.questionCount) * 100) : 0}%
            </p>
          </div>
        )}

        {/* Question card */}
        {!session.finalized && (
          <div
            style={{
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-ghost)',
                marginBottom: '14px',
              }}
            >
              Question {session.questionCount + 1}
            </div>
            {generating ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    border: '2px solid var(--border)',
                    borderTopColor: 'var(--accent)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                Generating question…
              </div>
            ) : (
              <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}>
                {session.question || <span style={{ color: 'var(--text-ghost)' }}>Loading…</span>}
              </p>
            )}
          </div>
        )}

        {/* Answer input */}
        {!session.finalized && !session.revealed && !generating && (
          <>
            <textarea
              ref={answerRef}
              value={session.userAnswer}
              onChange={(e) => onUserAnswerChange(e.target.value)}
              placeholder="Type your answer here…"
              rows={4}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-editor)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                lineHeight: 1.6,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={session.mode === 'exam' ? onExamSubmit : handleReveal}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid transparent',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {session.mode === 'exam' ? 'Submit Answer' : 'Submit & Reveal Answer'}
              </button>
              <button
                type="button"
                onClick={() => onRecord('skipped')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <SkipForward size={14} />
                Skip
              </button>
            </div>
          </>
        )}

        {/* Revealed answer — shown in practice mode after reveal, and in exam mode at session end */}
        {session.revealed &&
          session.answer &&
          (session.mode === 'practice' || (session.mode === 'exam' && session.finalized)) && (
            <>
              <div
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--accent-muted)',
                  backgroundColor: 'var(--accent-dim)',
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                    marginBottom: '10px',
                  }}
                >
                  {session.mode === 'exam' ? 'Correct Answer' : 'Model Answer & Explanation'}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.7,
                    color: 'var(--text-primary)',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <MathBlock content={session.answer} />
                </div>
              </div>

              {/* AI grade feedback */}
              {(grading || grade) && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-lg)',
                    border: `1px solid ${
                      grading
                        ? 'var(--border)'
                        : grade?.verdict === 'correct'
                          ? 'var(--green, #4ade80)44'
                          : grade?.verdict === 'partial'
                            ? '#facc1544'
                            : '#f8717144'
                    }`,
                    backgroundColor: grading
                      ? 'var(--bg-card)'
                      : grade?.verdict === 'correct'
                        ? 'rgba(74,222,128,0.07)'
                        : grade?.verdict === 'partial'
                          ? 'rgba(250,204,21,0.07)'
                          : 'rgba(248,113,113,0.07)',
                  }}
                >
                  {grading ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: '14px',
                          height: '14px',
                          border: '2px solid var(--border)',
                          borderTopColor: 'var(--accent)',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      Grading your answer…
                    </div>
                  ) : grade ? (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '10px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              grade.verdict === 'correct'
                                ? 'rgba(74,222,128,0.18)'
                                : grade.verdict === 'partial'
                                  ? 'rgba(250,204,21,0.18)'
                                  : 'rgba(248,113,113,0.18)',
                            color:
                              grade.verdict === 'correct'
                                ? 'var(--green, #4ade80)'
                                : grade.verdict === 'partial'
                                  ? '#facc15'
                                  : 'var(--red, #f87171)',
                          }}
                        >
                          {grade.verdict === 'correct'
                            ? '✓ Correct'
                            : grade.verdict === 'partial'
                              ? '~ Partial'
                              : '✗ Incorrect'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Score: {grade.score}/100
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          lineHeight: 1.65,
                          color: 'var(--text-primary)',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <MathBlock content={grade.feedback} />
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {/* Rating buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <RatingBtn
                  icon={<CheckCircle size={15} />}
                  label="Correct"
                  color="var(--green, #4ade80)"
                  onClick={() => onRecord('correct')}
                />
                <RatingBtn
                  icon={<XCircle size={15} />}
                  label="Incorrect"
                  color="var(--red, #f87171)"
                  onClick={() => onRecord('incorrect')}
                />
                <RatingBtn
                  icon={<SkipForward size={15} />}
                  label="Skip"
                  color="var(--text-secondary)"
                  onClick={() => onRecord('skipped')}
                />
              </div>
            </>
          )}
      </div>
    </div>
  );
}

function RatingBtn({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '10px 22px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${color}44`,
        backgroundColor: `${color}11`,
        color,
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        minWidth: '110px',
        justifyContent: 'center',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Progress Dashboard ────────────────────────────────────────────────────────

function ProgressDashboard({
  stats,
  topics,
  onBack,
  onExit,
}: {
  stats: FeTopicStats[];
  topics: FeTopic[];
  onBack: () => void;
  onExit: () => void;
}) {
  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const chartData = stats
    .map((s) => ({
      name: topicMap.get(s.topic_id)?.name ?? `Topic ${s.topic_id}`,
      accuracy: Math.round(s.accuracy * 100),
      attempts: s.attempts,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-sidebar)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onExit}
          style={{
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={13} />
        </button>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Progress Dashboard</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        {stats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
            <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>No data yet</p>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Complete some practice sessions to see your progress here.
            </p>
          </div>
        ) : (
          <>
            {/* Bar chart */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Accuracy by Topic (weakest first)
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    angle={-35}
                    textAnchor="end"
                    tick={{ fill: 'var(--text-ghost)', fontSize: 10 }}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-ghost)', fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                    }}
                    formatter={(val) => [`${val}%`, 'Accuracy'] as [string, string]}
                  />
                  <Bar dataKey="accuracy" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stats table */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              All Topics
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {chartData.map((row) => (
                <div
                  key={row.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)',
                  }}
                >
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{row.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>{row.attempts} attempts</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: accuracyColor(row.accuracy / 100),
                      minWidth: '42px',
                      textAlign: 'right',
                    }}
                  >
                    {row.accuracy}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-secondary)',
      }}
    >
      <span
        style={{
          width: '28px',
          height: '28px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
