import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStudentActivity } from '../utils/studentActivityStats.js';

test('counts passed questions separately from the single final assessment submission', () => {
  const questionIdentityById = new Map(
    Array.from({ length: 8 }, (_, index) => [`question-${index + 1}`, `prompt-${index + 1}`])
  );
  const assessmentQuestionRows = Array.from({ length: 8 }, (_, index) => ({
    userId: 'student-1',
    problemId: `question-${index + 1}`,
    questionAttempts: 1,
    acceptedQuestionAttempts: index < 2 ? 1 : 0,
    solved: index < 2 ? 1 : 0,
  }));

  const stats = mergeStudentActivity({
    assessmentQuestionRows,
    assessmentSubmissionRows: [{
      _id: 'student-1',
      attempts: 1,
      bestScore: 13,
    }],
    questionIdentityById,
  })['student-1'];

  assert.equal(stats.problemsSolved, 2);
  assert.equal(stats.attempts, 1);
  assert.equal(stats.questionAttempts, 8);
  assert.equal(stats.acceptedQuestionAttempts, 2);
  assert.equal(stats.bestScore, 13);
});

test('deduplicates a solved prompt shared across coding and debugging submissions', () => {
  const sharedIdentityById = new Map([
    ['coding-question', 'same prompt'],
    ['debugging-question', 'same prompt'],
  ]);

  const stats = mergeStudentActivity({
    codingRows: [{
      userId: 'student-1',
      problemId: 'coding-question',
      attempts: 1,
      acceptedQuestionAttempts: 1,
      solved: 1,
      bestScore: 100,
    }],
    debuggingRows: [{
      userId: 'student-1',
      problemId: 'debugging-question',
      attempts: 1,
      acceptedQuestionAttempts: 1,
      solved: 1,
      bestScore: 100,
    }],
    questionIdentityById: sharedIdentityById,
  })['student-1'];

  assert.equal(stats.problemsSolved, 1);
  assert.equal(stats.attempts, 2);
  assert.equal(stats.questionAttempts, 2);
  assert.equal(stats.acceptedQuestionAttempts, 2);
});
