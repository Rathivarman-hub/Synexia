import test from 'node:test';
import assert from 'node:assert/strict';
import { grade, gradeSubmission } from '../services/codingGraderService.js';
import {
  calculateAwardedPoints,
  normalizeAssessmentSubmissionScore,
  resolveAssessmentAnswer,
} from '../services/assessmentScoring.js';
import { getStarterTemplate, LANGUAGE_KEYS } from '../config/languages.js';

test('partial and compilation failures award zero points', () => {
  const problem = {
    points: 17,
    testCases: [{ expectedOutput: '2' }, { expectedOutput: '4' }],
  };
  const partial = grade(problem, [
    { status: 'ok', output: '2' },
    { status: 'ok', output: 'wrong' },
  ]);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.score, 0);
  assert.equal(partial.awardedPoints, 0);

  const compileError = grade(problem, [
    { status: 'compile-error', output: '', error: 'compile failed' },
    { status: 'compile-error', output: '', error: 'compile failed' },
  ]);
  assert.equal(compileError.score, 0);
  assert.equal(compileError.accepted, false);
});

test('only a complete accepted evaluation awards the full question points', () => {
  const result = grade(
    { points: 17, testCases: [{ expectedOutput: '2' }, { expectedOutput: '4' }] },
    [{ status: 'ok', output: '2' }, { status: 'ok', output: '4' }]
  );
  assert.equal(result.status, 'accepted');
  assert.equal(result.accepted, true);
  assert.equal(result.score, 17);
  assert.equal(result.awardedPoints, 17);
  assert.equal(calculateAwardedPoints({
    status: 'accepted', passedTests: 0, totalTests: 0, accepted: true,
  }, 17), 0);
});

test('all language starter templates are detected and never graded', async () => {
  for (const language of LANGUAGE_KEYS) {
    const result = await gradeSubmission(
      { points: 5, testCases: [{ input: '', expectedOutput: '' }] },
      { language, code: getStarterTemplate(language) }
    );
    assert.equal(result.status, 'not-attempted', language);
    assert.equal(result.score, 0, language);
    assert.equal(result.passedTests, 0, language);
  }
});

test('final assessment scoring requires the latest accepted code and language', () => {
  const acceptedRun = {
    language: 'python',
    code: 'print(2)',
    status: 'accepted',
    passedTests: 5,
    totalTests: 5,
    accepted: true,
  };
  const resolve = (code, language = 'python') => resolveAssessmentAnswer({
    answer: { code, language },
    evaluation: acceptedRun,
    maxPoints: 17,
    questionTestCount: 5,
  });

  assert.equal(resolve('print(2)').awardedPoints, 17);
  assert.equal(resolve('print(3)').status, 'not-evaluated');
  assert.equal(resolve('print(3)').awardedPoints, 0);
  assert.equal(resolve('print(2)', 'java').awardedPoints, 0);
  assert.equal(resolveAssessmentAnswer({
    answer: { code: '', language: 'python' },
    evaluation: undefined,
    maxPoints: 17,
    questionTestCount: 5,
  }).status, 'not-attempted');
});

test('legacy partial assessment scores are normalized to zero in read responses', () => {
  const result = normalizeAssessmentSubmissionScore({
    score: 17,
    answers: [{
      status: 'partial',
      passedCases: 3,
      totalCases: 5,
      score: 17,
      maxScore: 17,
    }],
  });
  assert.equal(result.score, 0);
  assert.equal(result.answers[0].score, 0);
  assert.equal(result.answers[0].awardedPoints, 0);
});
