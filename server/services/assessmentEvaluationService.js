import mongoose from 'mongoose';
import AssessmentSession from '../models/AssessmentSession.js';
import CodingProblem from '../models/CodingProblem.js';
import DebuggingProblem from '../models/DebuggingProblem.js';
import { gradeSubmission } from './codingGraderService.js';
import { calculateAwardedPoints, isAcceptedEvaluation } from './assessmentScoring.js';

const problemModel = (assessmentType) =>
  assessmentType === 'debugging' ? DebuggingProblem : CodingProblem;

const graderProblem = (assessmentType, problem) => assessmentType === 'debugging'
  ? {
    points: problem.points,
    testCases: [
      { input: problem.sampleInput || '', expectedOutput: problem.sampleOutput || '', hidden: false },
      ...(problem.visibleTestCases || []).map((testCase) => ({ ...testCase, hidden: false })),
      ...(problem.hiddenTestCases || []).map((testCase) => ({ ...testCase, hidden: true })),
    ].filter((testCase, index, cases) =>
      index === 0
      || testCase.input !== cases[0].input
      || testCase.expectedOutput !== cases[0].expectedOutput
    ),
  }
  : problem;

const httpError = (status, message) => Object.assign(new Error(message), { status });

export const evaluateAssessmentAnswer = async ({
  assessmentType,
  userId,
  sessionId,
  problemId,
  language,
  code,
  timeLimitMs,
}) => {
  if (!mongoose.isValidObjectId(sessionId)) {
    throw httpError(409, 'The active assessment session is unavailable. Reload the assessment.');
  }

  const now = new Date();
  const sessionFilter = {
    _id: sessionId,
    userId,
    assessmentType,
    active: true,
    status: 'in-progress',
    expiresAt: { $gt: now },
    questionIds: new mongoose.Types.ObjectId(String(problemId)),
  };
  const session = await AssessmentSession.findOne(sessionFilter).select('_id');
  if (!session) {
    throw httpError(409, 'This question is not part of an active assessment session.');
  }

  const problem = await problemModel(assessmentType)
    .findOne({ _id: problemId, isActive: true })
    .select('+hiddenTestCases');
  if (!problem) throw httpError(404, 'Assessment question not found.');

  if (assessmentType === 'debugging' && !problem.languageTemplates?.[language]) {
    throw httpError(400, `No ${language} template is configured for this question.`);
  }

  const result = await gradeSubmission(graderProblem(assessmentType, problem), {
    language,
    code,
    timeLimitMs,
  });
  const evaluation = {
    problemId: problem._id,
    questionId: problem._id,
    language,
    code,
    status: result.status,
    passedTests: result.passedTests ?? result.passedCases,
    totalTests: result.totalTests ?? result.totalCases,
    accepted: result.accepted === true,
    awardedPoints: calculateAwardedPoints({
      status: result.status,
      passedTests: result.passedTests ?? result.passedCases,
      totalTests: result.totalTests ?? result.totalCases,
      accepted: result.accepted === true,
    }, problem.points),
    evaluatedAt: new Date(),
  };
  const draft = {
    problemId: problem._id,
    questionId: problem._id,
    language,
    sourceCode: code,
    lastSavedAt: evaluation.evaluatedAt,
  };

  const update = await AssessmentSession.updateOne(
    { ...sessionFilter, status: 'in-progress' },
    [{
      $set: {
        evaluations: {
          $concatArrays: [
            {
              $filter: {
                input: { $ifNull: ['$evaluations', []] },
                as: 'evaluation',
                cond: { $ne: ['$$evaluation.questionId', problem._id] },
              },
            },
            [{ $literal: evaluation }],
          ],
        },
        drafts: {
          $concatArrays: [
            {
              $filter: {
                input: { $ifNull: ['$drafts', []] },
                as: 'draft',
                cond: {
                  $not: [{
                    $and: [
                      { $eq: ['$$draft.questionId', problem._id] },
                      { $eq: ['$$draft.language', language] },
                    ],
                  }],
                },
              },
            },
            [{ $literal: draft }],
          ],
        },
      },
    }],
    { updatePipeline: true }
  );
  if (!update.matchedCount) {
    throw httpError(409, 'The assessment was locked before this evaluation could be saved.');
  }

  return {
    ...result,
    status: evaluation.status,
    accepted: evaluation.accepted,
    passedTests: evaluation.passedTests,
    totalTests: evaluation.totalTests,
    awardedPoints: evaluation.awardedPoints,
    maxScore: problem.points,
    fullAssessment: true,
  };
};
