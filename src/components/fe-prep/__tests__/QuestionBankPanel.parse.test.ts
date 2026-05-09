import { describe, expect, it } from 'vitest';
import { parseImportedQuestions } from '../QuestionBankPanel';

describe('parseImportedQuestions', () => {
  it('parses an array payload with mixed key variants', () => {
    const rows = parseImportedQuestions([
      {
        question: 'What is 2 + 2?',
        answer: '4',
        explanation: 'Basic arithmetic',
        type: 'numeric',
        difficulty: 'easy',
      },
      {
        prompt: "What is Ohm's law?",
        correct_answer: 'V = IR',
        q_type: 'mc_single',
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      question: 'What is 2 + 2?',
      answer: '4',
      explanation: 'Basic arithmetic',
      type: 'numeric',
      difficulty: 'easy',
    });
    expect(rows[1]).toEqual({
      question: "What is Ohm's law?",
      answer: 'V = IR',
      explanation: undefined,
      type: 'mc_single',
      difficulty: undefined,
    });
  });

  it('parses questions from an object payload', () => {
    const rows = parseImportedQuestions({
      questions: [
        {
          question_text: 'State Kirchhoff current law',
          correct_answer: 'Sum of currents into a node equals sum out',
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].question).toBe('State Kirchhoff current law');
    expect(rows[0].answer).toBe('Sum of currents into a node equals sum out');
  });

  it('filters out invalid rows and missing required fields', () => {
    const rows = parseImportedQuestions([
      null,
      1,
      { question: '  ', answer: 'valid' },
      { question: 'valid', answer: '' },
      { question: 'kept', answer: 'kept' },
    ]);

    expect(rows).toEqual([
      { question: 'kept', answer: 'kept', explanation: undefined, type: undefined, difficulty: undefined },
    ]);
  });

  it('returns empty list for unsupported payloads', () => {
    expect(parseImportedQuestions('not json')).toEqual([]);
    expect(parseImportedQuestions({ foo: 'bar' })).toEqual([]);
  });
});
