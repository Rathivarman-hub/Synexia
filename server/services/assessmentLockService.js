import mongoose from 'mongoose';
import AssessmentSession from '../models/AssessmentSession.js';
import AssessmentSubmission from '../models/AssessmentSubmission.js';

export const lockProblemIfAssessmentFinalized = async ({ userId, assessmentType, problemId }) => {
  const questionId = new mongoose.Types.ObjectId(String(problemId));
  const [session, finalSubmission] = await Promise.all([
    AssessmentSession.findOne({
      userId,
      assessmentType,
      status: { $in: ['in-progress', 'finalizing'] },
      questionIds: questionId,
    }).select('status expiresAt').lean(),
    AssessmentSubmission.exists({
      userId,
      assessmentType,
      'answers.questionId': questionId,
    }),
  ]);
  return {
    activeSession: session?.status === 'in-progress',
    expiredSession: session?.status === 'in-progress' && session.expiresAt <= new Date(),
    finalizingSession: session?.status === 'finalizing',
    finalSubmission: Boolean(finalSubmission),
  };
};
