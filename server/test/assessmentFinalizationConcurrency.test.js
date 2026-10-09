import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import AssessmentSession from '../models/AssessmentSession.js';
import AssessmentSubmission from '../models/AssessmentSubmission.js';

const mongoUri = process.env.ASSESSMENT_TEST_MONGO_URI;

test('Mongo atomically permits one finalization claim and one final record per student', {
  skip: !mongoUri,
}, async () => {
  const connection = await mongoose.createConnection(mongoUri, {
    dbName: `assessment_finalization_test_${process.pid}_${Date.now()}`,
  }).asPromise();

  try {
    const Session = connection.model('AssessmentSession', AssessmentSession.schema);
    const Submission = connection.model('AssessmentSubmission', AssessmentSubmission.schema);
    await Promise.all([Session.init(), Submission.init()]);

    const userId = new mongoose.Types.ObjectId();
    const questionIds = Array.from({ length: 8 }, () => new mongoose.Types.ObjectId());
    const [session] = await Session.create([{
      userId,
      assessmentType: 'coding',
      questionIds,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }]);

    const claims = await Promise.all([
      Session.findOneAndUpdate(
        { _id: session._id, userId, status: 'in-progress', active: true },
        { $set: { status: 'finalizing' } },
        { returnDocument: 'after' }
      ),
      Session.findOneAndUpdate(
        { _id: session._id, userId, status: 'in-progress', active: true },
        { $set: { status: 'finalizing' } },
        { returnDocument: 'after' }
      ),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);

    const submissionDocument = (sessionId) => ({
      userId,
      assessmentType: 'coding',
      sessionId,
      answers: questionIds.map((questionId, index) => ({
        questionId,
        title: `Question ${index + 1}`,
        slug: `question-${index + 1}`,
        language: 'python',
        status: 'not-attempted',
      })),
      status: 'wrong-answer',
      reason: 'manual-submit',
    });
    const attempts = await Promise.allSettled([
      Submission.create(submissionDocument(session._id)),
      Submission.create(submissionDocument(new mongoose.Types.ObjectId())),
    ]);

    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(await Submission.countDocuments({ userId, assessmentType: 'coding' }), 1);
  } finally {
    await connection.dropDatabase();
    await connection.close();
  }
});
