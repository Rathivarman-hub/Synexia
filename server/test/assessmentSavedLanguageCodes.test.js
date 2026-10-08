import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import AssessmentSubmission from '../models/AssessmentSubmission.js';
import AssessmentSession from '../models/AssessmentSession.js';
import { saveAssessmentDraftSchema, submitAssessmentSchema } from '../validators/assessmentValidators.js';
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

test('different students keep separate submitted answer code', async () => {
  const firstStudentCode = 'System.out.println("student A");';
  const secondStudentCode = 'System.out.println("student B");';
  const createSubmission = (userId, code) => new AssessmentSubmission({
    userId,
    assessmentType: 'coding',
    sessionId: new mongoose.Types.ObjectId(),
    answers: Array.from({ length: 8 }, (_, index) => ({
      questionId: new mongoose.Types.ObjectId(),
      title: `Question ${index + 1}`,
      slug: `question-${index + 1}`,
      language: 'java',
      code,
      codeByLanguage: { java: code },
      status: 'wrong-answer',
    })),
    status: 'wrong-answer',
    reason: 'manual-submit',
  });

  const first = createSubmission(new mongoose.Types.ObjectId(), firstStudentCode);
  const second = createSubmission(new mongoose.Types.ObjectId(), secondStudentCode);
  await Promise.all([first.validate(), second.validate()]);

  assert.notEqual(String(first.userId), String(second.userId));
  assert.equal(first.answers[0].code, firstStudentCode);
  assert.equal(second.answers[0].code, secondStudentCode);
  assert.equal(first.answers[0].codeByLanguage.get('java'), firstStudentCode);
  assert.equal(second.answers[0].codeByLanguage.get('java'), secondStudentCode);
});

test('assessment draft saves require a session, problem, language, and bounded source', () => {
  const validDraft = {
    sessionId: '507f1f77bcf86cd799439012',
    problemId: '507f1f77bcf86cd799439013',
    language: 'java',
    sourceCode: 'class Main {}',
  };
  assert.equal(saveAssessmentDraftSchema.validate(validDraft).error, undefined);
  assert.ok(saveAssessmentDraftSchema.validate({
    ...validDraft,
    sourceCode: 'x'.repeat(20001),
  }).error);
  assert.ok(saveAssessmentDraftSchema.validate({
    ...validDraft,
    language: 'ruby',
  }).error);
});

test('assessment sessions persist separate code drafts per question and language', async () => {
  const questionId = new mongoose.Types.ObjectId();
  const session = new AssessmentSession({
    userId: new mongoose.Types.ObjectId(),
    assessmentType: 'coding',
    questionIds: Array.from({ length: 8 }, () => new mongoose.Types.ObjectId()),
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    drafts: [{
      problemId: questionId,
      questionId,
      language: 'java',
      sourceCode: 'class Main {}',
      lastSavedAt: new Date(),
    }],
  });

  await assert.doesNotReject(() => session.validate());
  assert.equal(session.toJSON().drafts[0].sourceCode, 'class Main {}');
});
