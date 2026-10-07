import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import AssessmentSubmission from '../models/AssessmentSubmission.js';
import { submitAssessmentSchema } from '../validators/assessmentValidators.js';

test('accepts eight answers with empty or omitted code', async () => {
  const answers = Array.from({ length: 8 }, (_, index) => ({
    questionId: new mongoose.Types.ObjectId(),
    title: `Question ${index + 1}`,
    slug: `question-${index + 1}`,
    language: 'python',
    ...(index < 4 ? { code: 'print("answer")' } : {}),
    status: 'wrong-answer',
  }));
  const submission = new AssessmentSubmission({
    userId: new mongoose.Types.ObjectId(),
    assessmentType: 'coding',
    sessionId: new mongoose.Types.ObjectId(),
    answers,
    status: 'wrong-answer',
    reason: 'manual-submit',
  });

  assert.equal(await submission.validate(), undefined);
  assert.deepEqual(
    submission.answers.slice(4).map((answer) => answer.code),
    ['', '', '', '']
  );
});

test('validates an omitted draft as an empty answer code', () => {
  const { error, value } = submitAssessmentSchema.validate({
    sessionId: new mongoose.Types.ObjectId().toString(),
    answers: [{
      questionId: new mongoose.Types.ObjectId().toString(),
      language: 'python',
    }],
  });

  assert.equal(error, undefined);
  assert.equal(value.answers[0].code, '');
});
