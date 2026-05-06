import { AlertTriangle, BarChart2, BookOpen, CheckCircle, ChevronRight, SkipForward, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FeTopic, FeTopicStats, FeWeakTopic } from '../../lib/tauri/commands';
import { commands } from '../../lib/tauri/commands';

// ── Types ─────────────────────────────────────────────────────────────────────

type View = 'browser' | 'session' | 'dashboard';

interface SessionState {
  sessionId: number;
  topicId: number;
  topicName: string;
  question: string;
  answer: string;
  userAnswer: string;
  revealed: boolean;
  questionCount: number;
  correctCount: number;
  startedAt: number; // timestamp ms
}

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

// ── Main component ────────────────────────────────────────────────────────────

export function FePrepMode() {
  const [view, setView] = useState<View>('browser');
  const [topics, setTopics] = useState<FeTopic[]>([]);
  const [stats, setStats] = useState<FeTopicStats[]>([]);
  const [weakTopics, setWeakTopics] = useState<FeWeakTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionState | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  // Load topics + stats on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [t, s, w] = await Promise.all([
          commands.listFeTopics(),
          commands.getFeStatistics(),
          commands.getWeakFeTopics(),
        ]);
        setTopics(t);
        setStats(s);
        setWeakTopics(w);
      } catch (e) {
        console.error('Failed to load FE Prep data:', e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const statsMap = new Map(stats.map((s) => [s.topic_id, s]));

  const startSession = useCallback(async (topic: FeTopic) => {
    try {
      const sessionId = await commands.startFeSession('practice', [topic.name]);
      setSession({
        sessionId,
        topicId: topic.id,
        topicName: topic.name,
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
      console.error('Failed to start session:', e);
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!session) return;
    try {
      await commands.completeFeSession(session.sessionId, session.questionCount, session.correctCount);
    } catch (e) {
      console.error('Failed to complete session:', e);
    }
    setSession(null);
    // Refresh stats
    const [s, w] = await Promise.all([commands.getFeStatistics(), commands.getWeakFeTopics()]);
    setStats(s);
    setWeakTopics(w);
    setView('browser');
  }, [session]);

  const recordAttempt = useCallback(
    async (result: 'correct' | 'incorrect' | 'skipped') => {
      if (!session) return;
      const elapsed = Math.round((Date.now() - session.startedAt) / 1000);
      try {
        await commands.recordFeAttempt(
          session.topicId,
          result,
          elapsed,
          undefined,
          session.question,
          session.userAnswer,
          session.answer,
        );
      } catch (e) {
        console.error('Failed to record attempt:', e);
      }
      setSession((prev) =>
        prev
          ? {
              ...prev,
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

  if (loading) return <LoadingSpinner />;

  if (view === 'session' && session) {
    return (
      <PracticeSession
        session={session}
        answerRef={answerRef}
        onReveal={(answer) => setSession((s) => (s ? { ...s, answer, revealed: true } : null))}
        onUserAnswerChange={(val) => setSession((s) => (s ? { ...s, userAnswer: val } : null))}
        onRecord={recordAttempt}
        onEnd={endSession}
      />
    );
  }

  if (view === 'dashboard') {
    return <ProgressDashboard stats={stats} topics={topics} onBack={() => setView('browser')} />;
  }

  // Default: Topic Browser
  return (
    <TopicBrowser
      topics={topics}
      statsMap={statsMap}
      weakTopics={weakTopics}
      onStartSession={startSession}
      onViewDashboard={() => setView('dashboard')}
    />
  );
}

// ── Topic Browser ─────────────────────────────────────────────────────────────

function TopicBrowser({
  topics,
  statsMap,
  weakTopics,
  onStartSession,
  onViewDashboard,
}: {
  topics: FeTopic[];
  statsMap: Map<number, FeTopicStats>;
  weakTopics: FeWeakTopic[];
  onStartSession: (topic: FeTopic) => void;
  onViewDashboard: () => void;
}) {
  const grouped = groupByCategory(topics);

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
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>FE Exam Prep</span>
        </div>
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
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {catTopics.map((topic) => {
                const s = statsMap.get(topic.id);
                const acc = s && s.attempts > 0 ? s.accuracy : null;
                return (
                  <TopicRow
                    key={topic.id}
                    topic={topic}
                    accuracy={acc}
                    attempts={s?.attempts ?? 0}
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
  onStart,
}: {
  topic: FeTopic;
  accuracy: number | null;
  attempts: number;
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
        Practice
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
  onUserAnswerChange,
  onRecord,
  onEnd,
}: {
  session: SessionState;
  answerRef: React.RefObject<HTMLTextAreaElement | null>;
  onReveal: (answer: string) => void;
  onUserAnswerChange: (val: string) => void;
  onRecord: (result: 'correct' | 'incorrect' | 'skipped') => void;
  onEnd: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [modelAnswer, setModelAnswer] = useState('');

  // Auto-generate a question via AI when session starts or after each question
  useEffect(() => {
    if (session.revealed) return;
    setGenerating(true);
    setModelAnswer('');
    commands
      .aiChat(
        `You are an FE exam tutor. Generate one multiple-choice or short-answer FE exam practice question for the topic: "${session.topicName}". Format: first write the question, then on a new line starting with "ANSWER:" provide the correct answer and a brief explanation.`,
        undefined,
      )
      .then((response) => {
        const parts = response.split(/\nANSWER:/i);
        if (parts.length >= 2) {
          setModelAnswer(parts.slice(1).join('\nANSWER:').trim());
        } else {
          setModelAnswer(response);
        }
      })
      .catch((e) => {
        console.error('AI question generation failed:', e);
        setModelAnswer('Could not generate question. Please check your AI connection in Settings.');
      })
      .finally(() => setGenerating(false));
  }, [session.topicName, session.questionCount, session.revealed]);

  const handleReveal = () => {
    onReveal(modelAnswer);
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
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {session.questionCount > 0 && `${session.correctCount}/${session.questionCount} correct`}
          </span>
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
        {/* Question card */}
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
              {session.question || <span style={{ color: 'var(--text-ghost)' }}>Loading questionu2026</span>}
            </p>
          )}
        </div>

        {/* Answer input */}
        {!session.revealed && !generating && (
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
                onClick={handleReveal}
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
                Submit & Reveal Answer
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

        {/* Revealed answer */}
        {session.revealed && (
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
                Model Answer &amp; Explanation
              </div>
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color: 'var(--text-primary)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {session.answer}
              </p>
            </div>

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
}: {
  stats: FeTopicStats[];
  topics: FeTopic[];
  onBack: () => void;
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
