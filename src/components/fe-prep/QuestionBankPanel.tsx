import { AlertCircle, Edit3, Flag, Plus, Upload } from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reportError } from '../../lib/errorReporter';
import type { QuestionDetail, QuestionListItem, TopicWithQuestionCount } from '../../lib/tauri/commands';
import { commands } from '../../lib/tauri/commands';

interface QuestionBankPanelProps {
  onExit: () => void;
}

interface ImportedQuestion {
  question: string;
  answer: string;
  explanation?: string;
  type?: string;
  difficulty?: string;
}

const QUESTIONS_PER_PAGE = 25;

export function parseImportedQuestions(raw: unknown): ImportedQuestion[] {
  const payload = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as { questions?: unknown }).questions)
      ? ((raw as { questions: unknown[] }).questions ?? [])
      : [];

  return payload
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null;
      const row = item as Record<string, unknown>;
      const question =
        typeof row.question === 'string'
          ? row.question
          : typeof row.question_text === 'string'
            ? row.question_text
            : typeof row.prompt === 'string'
              ? row.prompt
              : '';
      const answer =
        typeof row.answer === 'string' ? row.answer : typeof row.correct_answer === 'string' ? row.correct_answer : '';

      if (!question.trim() || !answer.trim()) return null;

      return {
        question: question.trim(),
        answer: answer.trim(),
        explanation: typeof row.explanation === 'string' ? row.explanation : undefined,
        type: typeof row.q_type === 'string' ? row.q_type : typeof row.type === 'string' ? row.type : undefined,
        difficulty: typeof row.difficulty === 'string' ? row.difficulty : undefined,
      } as ImportedQuestion;
    })
    .filter((item): item is ImportedQuestion => item !== null);
}

export function QuestionBankPanel({ onExit }: QuestionBankPanelProps) {
  const [topics, setTopics] = useState<TopicWithQuestionCount[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionDetail | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flaggedQuestionId, setFlaggedQuestionId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const loadTopics = useCallback(async () => {
    const t = await commands.listTopicsWithQuestionCounts();
    setTopics(t);
    if (t.length > 0 && !selectedTopicId) {
      setSelectedTopicId(t[0].id);
    }
  }, [selectedTopicId]);

  const loadQuestions = useCallback(async (topicId: number) => {
    const q = await commands.listQuestionsByTopic(topicId);
    setQuestions(q);
    setPage(1);
  }, []);

  // Load topics with counts on mount
  useEffect(() => {
    const load = async () => {
      try {
        await loadTopics();
      } catch (e) {
        reportError({ context: 'Question bank topics', message: 'Failed to load topics', error: e });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadTopics]);

  // Load questions for selected topic
  useEffect(() => {
    if (!selectedTopicId) return;
    const load = async () => {
      try {
        await loadQuestions(selectedTopicId);
      } catch (e) {
        reportError({ context: 'Question bank list', message: 'Failed to load questions', error: e });
      }
    };
    void load();
  }, [selectedTopicId, loadQuestions]);

  const handleSelectQuestion = useCallback(async (questionId: number) => {
    try {
      const detail = await commands.getQuestionDetail(questionId);
      setSelectedQuestion(detail);
    } catch (e) {
      reportError({ context: 'Question bank details', message: 'Failed to load question detail', error: e });
    }
  }, []);

  const handleMarkReviewed = useCallback(
    async (questionId: number) => {
      try {
        await commands.markQuestionReviewed(questionId);
        // Refresh the questions list
        if (selectedTopicId) {
          await loadQuestions(selectedTopicId);
          setStatusMessage('Marked question as reviewed.');
        }
      } catch (e) {
        reportError({ context: 'Question bank review', message: 'Failed to mark reviewed', error: e });
      }
    },
    [selectedTopicId, loadQuestions],
  );

  const handleOpenImport = useCallback(() => {
    if (!selectedTopicId) {
      setStatusMessage('Pick a topic before importing.');
      return;
    }
    importRef.current?.click();
  }, [selectedTopicId]);

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !selectedTopicId) return;

      try {
        const rawText = await file.text();
        const parsed = JSON.parse(rawText) as unknown;
        const rows = parseImportedQuestions(parsed);
        if (rows.length === 0) {
          setStatusMessage('No valid questions found in JSON.');
          return;
        }

        for (const row of rows) {
          await commands.addFeQuestion(
            selectedTopicId,
            row.question,
            row.answer,
            row.explanation,
            row.type ?? 'numeric',
            row.difficulty,
          );
        }

        await loadQuestions(selectedTopicId);
        await loadTopics();
        setStatusMessage(`Imported ${rows.length} question${rows.length === 1 ? '' : 's'} from ${file.name}.`);
      } catch (e) {
        reportError({ context: 'Question bank import', message: 'Failed to import JSON', error: e });
      }
    },
    [selectedTopicId, loadQuestions, loadTopics],
  );

  const selectedTopic = useMemo(() => topics.find((t) => t.id === selectedTopicId), [topics, selectedTopicId]);
  const pageCount = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE));
  const pageStart = (page - 1) * QUESTIONS_PER_PAGE;
  const pageQuestions = questions.slice(pageStart, pageStart + QUESTIONS_PER_PAGE);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = setTimeout(() => setStatusMessage(null), 3200);
    return () => clearTimeout(timeout);
  }, [statusMessage]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading questions...</div>
      </div>
    );
  }

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
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Question Bank</span>
        <button
          type="button"
          onClick={onExit}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
        {/* Left sidebar - topic list */}
        <div
          style={{
            width: '220px',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-sidebar)',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase' }}>
              Topics
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setSelectedTopicId(topic.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 0,
                  border: 'none',
                  borderLeft: selectedTopicId === topic.id ? '3px solid var(--accent)' : '3px solid transparent',
                  backgroundColor: selectedTopicId === topic.id ? 'var(--bg-card)' : 'transparent',
                  color: selectedTopicId === topic.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={topic.name}
              >
                <div style={{ fontWeight: 500, marginBottom: '2px' }}>{topic.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-ghost)', opacity: 0.7 }}>
                  {topic.question_count} questions
                  {topic.needs_review_count > 0 && ` · ${topic.needs_review_count} review`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right side - questions table */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Toolbar */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-sidebar)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid transparent',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Add Question
            </button>
            <button
              type="button"
              onClick={handleOpenImport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <Upload size={13} />
              Import JSON
            </button>
            <div style={{ flex: 1 }} />
            {statusMessage && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--accent)',
                  backgroundColor: 'var(--accent-dim)',
                  border: '1px solid var(--border)',
                  borderRadius: '999px',
                  padding: '4px 10px',
                }}
              >
                {statusMessage}
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>
              {questions.length} questions {selectedTopic && `in ${selectedTopic.name}`}
            </span>
          </div>

          {/* Questions table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {questions.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <AlertCircle size={24} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No questions for {selectedTopic?.name}</p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  style={{
                    marginTop: '12px',
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid transparent',
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Create your first question
                </button>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <tr>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-ghost)',
                        textTransform: 'uppercase',
                        width: '40%',
                      }}
                    >
                      Question
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-ghost)',
                        textTransform: 'uppercase',
                        width: '12%',
                      }}
                    >
                      Type
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-ghost)',
                        textTransform: 'uppercase',
                        width: '12%',
                      }}
                    >
                      Difficulty
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-ghost)',
                        textTransform: 'uppercase',
                        width: '12%',
                      }}
                    >
                      Success Rate
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-ghost)',
                        textTransform: 'uppercase',
                        width: '24%',
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageQuestions.map((q) => (
                    <tr
                      key={q.id}
                      style={{
                        height: '46px',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: q.needs_review ? 'rgba(250,204,21,0.05)' : 'transparent',
                      }}
                    >
                      <td
                        style={{
                          padding: '12px',
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          maxWidth: '1px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        onClick={() => handleSelectQuestion(q.id)}
                        title={q.prompt_truncated}
                      >
                        {q.prompt_truncated}
                      </td>
                      <td style={{ padding: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{q.q_type}</td>
                      <td style={{ padding: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {q.difficulty || '—'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {q.success_rate > 0 ? `${Math.round(q.success_rate * 100)}%` : '—'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectQuestion(q.id)}
                            title="Edit"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFlaggedQuestionId(q.id);
                              setShowFlagModal(true);
                            }}
                            title="Flag"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            <Flag size={12} />
                          </button>
                          {q.needs_review === 1 && (
                            <button
                              type="button"
                              onClick={() => handleMarkReviewed(q.id)}
                              title="Mark reviewed"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: '#facc15',
                                color: '#000',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {questions.length > QUESTIONS_PER_PAGE && (
            <div
              style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border)',
                backgroundColor: 'var(--bg-sidebar)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>
                Showing {pageStart + 1}-{Math.min(pageStart + QUESTIONS_PER_PAGE, questions.length)} of{' '}
                {questions.length}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                  disabled={page >= pageCount}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    cursor: page >= pageCount ? 'not-allowed' : 'pointer',
                    opacity: page >= pageCount ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedQuestion && (
        <QuestionModal
          question={selectedQuestion}
          onClose={() => setSelectedQuestion(null)}
          onSaved={() => {
            if (selectedTopicId) {
              void loadQuestions(selectedTopicId);
              void loadTopics();
              setStatusMessage('Question saved.');
            }
          }}
        />
      )}

      {showAddForm && (
        <AddQuestionModal
          topics={topics}
          onClose={() => setShowAddForm(false)}
          onSaved={async () => {
            if (!selectedTopicId) return;
            await loadQuestions(selectedTopicId);
            await loadTopics();
            setStatusMessage('Question added successfully.');
          }}
        />
      )}

      {showFlagModal && flaggedQuestionId && (
        <FlagModal
          questionId={flaggedQuestionId}
          onSaved={async () => {
            if (!selectedTopicId) return;
            await loadQuestions(selectedTopicId);
            await loadTopics();
            setStatusMessage('Question issue reported.');
          }}
          onClose={() => {
            setShowFlagModal(false);
            setFlaggedQuestionId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Question Detail Modal ─────────────────────────────────────────────────────

function QuestionModal({
  question,
  onClose,
  onSaved,
}: {
  question: QuestionDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [questionText, setQuestionText] = useState(question.question_text);
  const [correctAnswer, setCorrectAnswer] = useState(question.correct_answer);
  const [explanation, setExplanation] = useState(question.explanation || '');
  const [difficulty, setDifficulty] = useState(question.difficulty || '');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await commands.updateFeQuestion(
        question.id,
        questionText !== question.question_text ? questionText : undefined,
        correctAnswer !== question.correct_answer ? correctAnswer : undefined,
        explanation !== (question.explanation || '') ? explanation : undefined,
        difficulty !== (question.difficulty || '') ? difficulty : undefined,
      );
      onSaved();
      setEditMode(false);
    } catch (e) {
      reportError({ context: 'Question bank save', message: 'Failed to save question', error: e });
    } finally {
      setSaving(false);
    }
  }, [question, questionText, correctAnswer, explanation, difficulty, onSaved]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-app)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '24px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {editMode ? 'Edit Question' : 'Question Details'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-ghost)',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ×
          </button>
        </div>

        {editMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                htmlFor="edit-question"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-ghost)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Question
              </label>
              <textarea
                id="edit-question"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-editor)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  minHeight: '100px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="edit-answer"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-ghost)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Correct Answer
              </label>
              <textarea
                id="edit-answer"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-editor)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="edit-explanation"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-ghost)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Explanation
              </label>
              <textarea
                id="edit-explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-editor)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="edit-difficulty"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-ghost)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Difficulty
                </label>
                <select
                  id="edit-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-editor)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                  }}
                >
                  <option value="">Select difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: saving ? 'var(--bg-hover)' : 'var(--accent)',
                  color: saving ? 'var(--text-ghost)' : '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-ghost)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Question
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {question.question_text}
              </p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-ghost)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Correct Answer
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {question.correct_answer}
              </p>
            </div>
            {question.explanation && (
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--text-ghost)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Explanation
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {question.explanation}
                </p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--text-ghost)',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}
                >
                  Type
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)' }}>{question.q_type}</p>
              </div>
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--text-ghost)',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}
                >
                  Difficulty
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)' }}>
                  {question.difficulty || '—'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid transparent',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Question Modal ────────────────────────────────────────────────────────

function AddQuestionModal({
  topics,
  onClose,
  onSaved,
}: {
  topics: TopicWithQuestionCount[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [topicId, setTopicId] = useState<number | string>(topics[0]?.id || '');
  const [questionText, setQuestionText] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [qType, setQType] = useState('numeric');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!topicId || !questionText.trim() || !correctAnswer.trim()) {
      return;
    }
    setSaving(true);
    try {
      await commands.addFeQuestion(
        Number(topicId),
        questionText,
        correctAnswer,
        explanation || undefined,
        qType,
        difficulty || undefined,
      );
      await onSaved();
      onClose();
    } catch (e) {
      reportError({ context: 'Question bank add', message: 'Failed to add question', error: e });
    } finally {
      setSaving(false);
    }
  }, [topicId, questionText, correctAnswer, explanation, difficulty, qType, onClose, onSaved]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-app)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Add New Question
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label
              htmlFor="add-topic"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-ghost)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Topic
            </label>
            <select
              id="add-topic"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-editor)',
                color: 'var(--text-primary)',
                fontSize: '12px',
              }}
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="add-question"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-ghost)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Question
            </label>
            <textarea
              id="add-question"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter the question text..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-editor)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'inherit',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="add-answer"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-ghost)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Correct Answer
            </label>
            <textarea
              id="add-answer"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              placeholder="Enter the correct answer..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-editor)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'inherit',
                minHeight: '80px',
                resize: 'vertical',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="add-explanation"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-ghost)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Explanation (optional)
            </label>
            <textarea
              id="add-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Optional explanation of the answer..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-editor)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'inherit',
                minHeight: '80px',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label
                htmlFor="add-type"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-ghost)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Type
              </label>
              <select
                id="add-type"
                value={qType}
                onChange={(e) => setQType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-editor)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              >
                <option value="numeric">Numeric</option>
                <option value="mc_single">Multiple Choice</option>
                <option value="mc_multi">Multi-select</option>
                <option value="drag_drop">Drag & Drop</option>
                <option value="hotspot">Hotspot</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="add-difficulty"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-ghost)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Difficulty
              </label>
              <select
                id="add-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-editor)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              >
                <option value="">Select difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !questionText.trim() || !correctAnswer.trim()}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor:
                  saving || !questionText.trim() || !correctAnswer.trim() ? 'var(--bg-hover)' : 'var(--accent)',
                color: saving || !questionText.trim() || !correctAnswer.trim() ? 'var(--text-ghost)' : '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: saving || !questionText.trim() || !correctAnswer.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Adding...' : 'Add Question'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Flag Question Modal ───────────────────────────────────────────────────────

function FlagModal({
  questionId,
  onSaved,
  onClose,
}: {
  questionId: number;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await commands.flagQuestion(questionId, reason);
      await onSaved();
      onClose();
    } catch (e) {
      reportError({ context: 'Question bank flag', message: 'Failed to flag question', error: e });
    } finally {
      setSubmitting(false);
    }
  }, [questionId, reason, onClose, onSaved]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1002,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-app)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Report Question Issue
        </h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Describe the issue with this question:
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="E.g., Answer is incorrect, Question is unclear, Typo in options..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-editor)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontFamily: 'inherit',
            minHeight: '100px',
            resize: 'vertical',
            marginBottom: '16px',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: submitting || !reason.trim() ? 'var(--bg-hover)' : 'var(--accent)',
              color: submitting || !reason.trim() ? 'var(--text-ghost)' : '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: submitting || !reason.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
