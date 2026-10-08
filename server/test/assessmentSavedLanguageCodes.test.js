import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import AssessmentSubmission from '../models/AssessmentSubmission.js';
import { submitAssessmentSchema } from '../validators/assessmentValidators.js';
import { LANGUAGE_KEYS } from '../config/languages.js';

const validAnswer = {
  questionId: '507f1f77bcf86cd799439011',
  language: 'python',
  code: 'print("submitted")',
};

test('assessment submission accepts saved code for multiple supported languages', () => {
  const payload = {
    sessionId: '507f1f77bcf86cd799439012',
    answers: [{
      ...validAnswer,
      codeByLanguage: {
        python: 'print("submitted")',
        java: 'class Main {}',
      },
    }],
  };

  const { error, value } = submitAssessmentSchema.validate(payload);

  assert.equal(error, undefined);
  assert.equal(value.answers[0].codeByLanguage.python, 'print("submitted")');
  assert.equal(value.answers[0].codeByLanguage.java, 'class Main {}');
});

test('assessment submission rejects unsupported languages in saved code', () => {
  const { error } = submitAssessmentSchema.validate({
    sessionId: '507f1f77bcf86cd799439012',
    answers: [{
      ...validAnswer,
      codeByLanguage: { ruby: 'puts "unsupported"' },
    }],
  });

  assert.ok(error);
});

test('assessment submission enforces the code length limit for each saved language', () => {
  const { error } = submitAssessmentSchema.validate({
    sessionId: '507f1f77bcf86cd799439012',
    answers: [{
      ...validAnswer,
      codeByLanguage: { [LANGUAGE_KEYS[0]]: 'x'.repeat(20001) },
    }],
  });

  assert.ok(error);
});

test('assessment submissions persist saved code by language', async () => {
  const submission = new AssessmentSubmission({
    userId: new mongoose.Types.ObjectId(),
    assessmentType: 'coding',
    sessionId: new mongoose.Types.ObjectId(),
    answers: Array.from({ length: 8 }, (_, index) => ({
      questionId: new mongoose.Types.ObjectId(),
      title: `Question ${index + 1}`,
      slug: `question-${index + 1}`,
      language: 'python',
      code: 'print("submitted")',
      codeByLanguage: {
        python: 'print("submitted")',
        java: 'class Main {}',
      },
      status: 'wrong-answer',
    })),
    status: 'wrong-answer',
    reason: 'manual-submit',
  });

  await assert.doesNotReject(() => submission.validate());
  assert.equal(submission.toJSON().answers[0].codeByLanguage.java, 'class Main {}');
});
