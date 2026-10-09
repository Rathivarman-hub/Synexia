import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import AssessmentSession from '../models/AssessmentSession.js';
import AssessmentSubmission from '../models/AssessmentSubmission.js';
import CodingSubmission from '../models/CodingSubmission.js';
import DebuggingSubmission from '../models/DebuggingSubmission.js';
import CodingProblem from '../models/CodingProblem.js';
import DebuggingProblem from '../models/DebuggingProblem.js';
import { LANGUAGE_KEYS } from '../config/languages.js';
import { isBoilerplateCode } from '../services/codingGraderService.js';
import {
  normalizeAssessmentSubmissionScore,
  resolveAssessmentAnswer,
} from '../services/assessmentScoring.js';
import { deleteCache, deleteCachePattern } from '../utils/cache.js';
import { invalidateAdminDashboardCache } from '../utils/adminDashboardCache.js';
import logger from '../config/logger.js';

const QUESTION_COUNT = 8;
const DURATION_MS = 90 * 60 * 1000;
const WARNING_LIMIT = 3;
const FINALIZATION_STALE_MS = 5 * 60 * 1000;

const modelFor = (type) => (type === 'debugging' ? DebuggingProblem : CodingProblem);
const submissionModelFor = (type) => (type === 'debugging' ? DebuggingSubmission : CodingSubmission);

export const getMySavedAnswer = (assessmentType) => asyncHandler(async (req, res) => {
  const problem = await modelFor(assessmentType)
    .findOne({ slug: req.params.slug })
    .select('_id slug')
    .lean();
  if (!problem) {
    res.status(404);
    throw new Error('Problem not found.');
  }

  const assessment = await AssessmentSubmission.findOne({
    userId: req.user._id,
    assessmentType,
    submitted: true,
    'answers.questionId': problem._id,
  })
    .select('answers')
    .lean({ flattenMaps: true });
  const assessmentAnswer = assessment?.answers?.find(
    (answer) => String(answer.questionId) === String(problem._id)
  );
  if (assessmentAnswer) {
    res.json({
      success: true,
      data: {
        language: assessmentAnswer.language,
        code: assessmentAnswer.code,
        codeByLanguage: assessmentAnswer.codeByLanguage || {},
        source: 'assessment',
      },
    });
    return;
  }

  const standaloneAnswer = await submissionModelFor(assessmentType)
    .findOne({ userId: req.user._id, problemId: problem._id, isRun: false })
    .select('language code submittedAt')
    .sort({ submittedAt: -1 })
    .lean();
  res.json({
    success: true,
    data: standaloneAnswer
      ? {
        language: standaloneAnswer.language,
        code: standaloneAnswer.code,
        codeByLanguage: {},
        source: 'submission',
      }
      : null,
  });
});

const orderedQuestions = async (type) => {
  const Problem = modelFor(type);
  const sort = type === 'debugging'
    ? { order: 1, level: 1, points: 1, _id: 1 }
    : { order: 1, points: 1, _id: 1 };
  const questions = await Problem.find({ isActive: true })
    .select(type === 'debugging'
      ? 'title slug points languageTemplates visibleTestCases sampleInput sampleOutput order level'
      : 'title slug points testCases order')
    .sort(sort)
    .limit(QUESTION_COUNT)
    .lean();
  return questions;
};

const publicSession = (session, questions) => {
  const drafts = (session.drafts || [])
    .filter((draft) => !isBoilerplateCode(draft.language, draft.sourceCode))
    .map((draft) => ({
      problemId: draft.problemId || draft.questionId,
      questionId: draft.questionId || draft.problemId,
      language: draft.language,
      code: draft.sourceCode,
      sourceCode: draft.sourceCode,
      lastSavedAt: draft.lastSavedAt,
    }));

  const evaluations = (session.evaluations || []).map((evaluation) => {
    const questionId = String(evaluation.questionId);
    let savedDraft = drafts.find((draft) =>
      String(draft.questionId) === questionId && draft.language === evaluation.language
    );

    if (!savedDraft) {
      const sourceCode = evaluation.code;
      if (!isBoilerplateCode(evaluation.language, sourceCode)) {
        savedDraft = {
          problemId: evaluation.problemId || evaluation.questionId,
          questionId: evaluation.questionId,
          language: evaluation.language,
          code: sourceCode,
          sourceCode,
          lastSavedAt: evaluation.evaluatedAt,
        };
        drafts.push(savedDraft);
      }
    }

    const isCurrent = savedDraft?.sourceCode === evaluation.code;
    const accepted = isCurrent
      && evaluation.accepted === true
      && evaluation.totalTests > 0
      && evaluation.passedTests === evaluation.totalTests;
    return {
      questionId: evaluation.questionId,
      language: evaluation.language,
      code: evaluation.code,
      status: isCurrent ? evaluation.status : 'not-evaluated',
      passedTests: isCurrent ? evaluation.passedTests : 0,
      totalTests: evaluation.totalTests,
      accepted,
      awardedPoints: accepted ? evaluation.awardedPoints : 0,
      evaluatedAt: evaluation.evaluatedAt,
    };
  });

  return {
    _id: session._id,
    assessmentType: session.assessmentType,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    warningCount: session.warningCount || 0,
    warningEvents: session.warningEvents || [],
    drafts,
    evaluations,
    questions: questions.map(({ _id, title, slug }) => ({ _id, title, slug })),
  };
};

const recoverStaleFinalization = async (userId, assessmentType) => {
  const staleBefore = new Date(Date.now() - FINALIZATION_STALE_MS);
  const recovered = await AssessmentSession.updateOne(
    {
      userId,
      assessmentType,
      active: true,
      status: 'finalizing',
      updatedAt: { $lt: staleBefore },
    },
    { $set: { status: 'in-progress' } }
  );
  if (recovered.modifiedCount) {
    logger.warn(`Recovered stale assessment finalization: user=${userId} type=${assessmentType}`);
  }
};

const markSessionSubmitted = async (sessionId, userId, assessmentType, submittedAt) => {
  const result = await AssessmentSession.updateOne(
    { _id: sessionId, userId, assessmentType, status: { $in: ['in-progress', 'finalizing'] } },
    { $set: { status: 'submitted', active: false, submittedAt } }
  );
  if (!result.matchedCount) {
    const exists = await AssessmentSession.exists({ _id: sessionId, userId, assessmentType, status: 'submitted' });
    if (!exists) logger.error(`Final assessment record has no matching session: session=${sessionId} user=${userId}`);
  }
  return Boolean(result.modifiedCount);
};

const invalidateAssessmentCaches = async (userId) => Promise.all([
  invalidateAdminDashboardCache(),
  deleteCachePattern('coding:leaderboard:*'),
  deleteCachePattern('coding:rank:*'),
  deleteCache(`coding:stats:assessment:${userId}`),
]);

const debuggingGraderProblem = (problem) => ({
  points: problem.points,
  testCases: [
    {
      input: problem.sampleInput || '',
      expectedOutput: problem.sampleOutput || '',
      hidden: false,
    },
    ...(problem.visibleTestCases || []).map((testCase) => ({
      ...testCase,
      hidden: false,
    })),
    ...(problem.hiddenTestCases || []).map((testCase) => ({
      ...testCase,
      hidden: true,
    })),
  ].filter((testCase, index, cases) => index === 0 || testCase.input !== cases[0].input ||
    testCase.expectedOutput !== cases[0].expectedOutput),
});

export const startAssessment = (assessmentType) => asyncHandler(async (req, res) => {
  const existingSubmission = await AssessmentSubmission.findOne({
    userId: req.user._id,
    assessmentType,
  }).lean();
  if (existingSubmission) {
    res.status(409);
    throw new Error('This assessment has already been submitted and is locked.');
  }

  const questions = await orderedQuestions(assessmentType);
  if (questions.length !== QUESTION_COUNT) {
    res.status(409);
    throw new Error(`The ${assessmentType} assessment requires exactly ${QUESTION_COUNT} active questions.`);
  }

  await recoverStaleFinalization(req.user._id, assessmentType);
  const existingSession = await AssessmentSession.findOne({
    userId: req.user._id,
    assessmentType,
    active: true,
    status: { $in: ['in-progress', 'finalizing'] },
  });
  if (existingSession) {
    if (existingSession.status === 'finalizing') {
      res.status(409);
      throw new Error('Your assessment submission is being finalized. Please wait.');
    }
    const sessionQuestions = await modelFor(assessmentType)
      .find({ _id: { $in: existingSession.questionIds } })
      .select('title slug')
      .lean();
    const byId = new Map(sessionQuestions.map((question) => [String(question._id), question]));
    return res.json({
      success: true,
      data: publicSession(existingSession, existingSession.questionIds.map((id) => byId.get(String(id))).filter(Boolean)),
    });
  }

  const startedAt = new Date();
  let session;
  try {
    [session] = await AssessmentSession.create([{
      userId: req.user._id,
      assessmentType,
      questionIds: questions.map((question) => question._id),
      startedAt,
      expiresAt: new Date(startedAt.getTime() + DURATION_MS),
    }]);
  } catch (error) {
    if (error.code !== 11000) throw error;
    session = await AssessmentSession.findOne({
      userId: req.user._id,
      assessmentType,
      active: true,
      status: { $in: ['in-progress', 'finalizing'] },
    });
    if (!session) throw error;
  }

  res.status(201).json({ success: true, data: publicSession(session, questions) });
});

export const getMyAssessment = (assessmentType) => asyncHandler(async (req, res) => {
  const submission = await AssessmentSubmission.findOne({
    userId: req.user._id,
    assessmentType,
  }).lean({ flattenMaps: true });
  if (submission) {
    const repaired = await markSessionSubmitted(submission.sessionId, req.user._id, assessmentType, submission.submittedAt);
    if (repaired) await invalidateAssessmentCaches(req.user._id);
    res.json({
      success: true,
      data: { submitted: true, submission: normalizeAssessmentSubmissionScore(submission) },
    });
    return;
  }

  await recoverStaleFinalization(req.user._id, assessmentType);
  const session = await AssessmentSession.findOne({
    userId: req.user._id,
    assessmentType,
    active: true,
    status: { $in: ['in-progress', 'finalizing'] },
  }).lean();
  if (!session) {
    res.json({ success: true, data: { submitted: false, session: null } });
    return;
  }
  if (session.status === 'finalizing') {
    res.json({ success: true, data: { submitted: false, finalizing: true } });
    return;
  }
  if (session.expiresAt <= new Date()) {
    try {
      const expiredSubmission = await finalizeAssessment({
        userId: req.user._id,
        assessmentType,
        sessionId: session._id,
        requestedReason: 'time-limit',
      });
      res.json({
        success: true,
        data: {
          submitted: true,
          submission: normalizeAssessmentSubmissionScore(expiredSubmission),
        },
      });
      return;
    } catch (error) {
      if (error.status !== 409) throw error;
      const saved = await AssessmentSubmission.findOne({
        userId: req.user._id,
        assessmentType,
      }).lean({ flattenMaps: true });
      if (saved) {
        res.json({
          success: true,
          data: {
            submitted: true,
            submission: normalizeAssessmentSubmissionScore(saved),
          },
        });
        return;
      }
      throw error;
    }
  }

  const questions = await modelFor(assessmentType)
    .find({ _id: { $in: session.questionIds } })
    .select('title slug')
    .lean();
  const byId = new Map(questions.map((question) => [String(question._id), question]));
  res.json({
    success: true,
    data: {
      submitted: false,
      session: publicSession(session, session.questionIds.map((id) => byId.get(String(id))).filter(Boolean)),
    },
  });
});

const assessmentError = (status, message) => Object.assign(new Error(message), { status });

export const finalizeAssessment = async ({
  userId,
  assessmentType,
  sessionId,
  answers = [],
  requestedReason = 'manual-submit',
}) => {
  const existingSubmission = await AssessmentSubmission.findOne({
    userId,
    assessmentType,
  }).lean();
  if (existingSubmission) {
    throw assessmentError(409, 'This assessment has already been submitted and is locked.');
  }

  await recoverStaleFinalization(userId, assessmentType);
  const session = await AssessmentSession.findOne({
    _id: sessionId,
    userId,
    assessmentType,
    status: 'in-progress',
    active: true,
  });
  if (!session) {
    throw assessmentError(409, 'No active assessment session was found. Your assessment was not saved.');
  }

  const now = Date.now();
  const expired = now >= session.expiresAt.getTime();
  const reason = expired ? 'time-limit' : requestedReason;
  if (!['manual-submit', 'warning-limit', 'time-limit'].includes(reason)) {
    throw assessmentError(400, 'Invalid assessment submission reason.');
  }
  if (!expired && reason === 'time-limit') {
    throw assessmentError(400, 'The assessment time limit has not ended.');
  }
  if (!expired && reason === 'warning-limit' && session.warningCount < WARNING_LIMIT) {
    throw assessmentError(400, 'Automatic submission requires the maximum warning count.');
  }

  const providedAnswers = new Map(
    answers.map((answer) => [String(answer.questionId), answer])
  );
  if (providedAnswers.size !== answers.length) {
    throw assessmentError(400, 'Each assessment question can only have one final answer.');
  }
  const questionIdSet = new Set(session.questionIds.map(String));
  if ([...providedAnswers.keys()].some((id) => !questionIdSet.has(id))) {
    throw assessmentError(400, 'The submitted answers do not match this assessment.');
  }

  const Problem = modelFor(assessmentType);
  const problems = await Problem.find({ _id: { $in: session.questionIds } })
    .select(assessmentType === 'debugging'
      ? '+hiddenTestCases title slug points languageTemplates visibleTestCases sampleInput sampleOutput'
      : '+hiddenTestCases title slug points testCases')
    .lean();
  const problemMap = new Map(problems.map((problem) => [String(problem._id), problem]));
  const evaluationMap = new Map(
    (session.evaluations || []).map((evaluation) => [String(evaluation.questionId), evaluation])
  );
  const savedDraftsByQuestion = new Map();
  for (const draft of session.drafts || []) {
    const questionId = String(draft.questionId || draft.problemId);
    const previous = savedDraftsByQuestion.get(questionId) || {
      language: draft.language,
      code: draft.sourceCode,
      lastSavedAt: draft.lastSavedAt,
      codeByLanguage: {},
    };
    const isLatest = new Date(draft.lastSavedAt) >= new Date(previous.lastSavedAt);
    savedDraftsByQuestion.set(questionId, {
      language: isLatest ? draft.language : previous.language,
      code: isLatest ? draft.sourceCode : previous.code,
      lastSavedAt: isLatest ? draft.lastSavedAt : previous.lastSavedAt,
      codeByLanguage: {
        ...previous.codeByLanguage,
        [draft.language]: draft.sourceCode,
      },
    });
  }
  const orderedProblems = session.questionIds.map((id) => problemMap.get(String(id)));
  if (orderedProblems.some((problem) => !problem)) {
    throw assessmentError(409, 'An assessment question is no longer available. Contact an administrator before submitting.');
  }

  const finalizingSession = await AssessmentSession.findOneAndUpdate(
    {
      _id: session._id,
      userId,
      assessmentType,
      active: true,
      status: 'in-progress',
    },
    { $set: { status: 'finalizing' } },
    { returnDocument: 'after' }
  );
  if (!finalizingSession) {
    const saved = await AssessmentSubmission.exists({ userId, assessmentType });
    if (saved) {
      throw assessmentError(409, 'This assessment has already been submitted and is locked.');
    }
    throw assessmentError(409, 'This assessment is already being submitted. Please check its status.');
  }

  let results;
  try {
    results = await Promise.all(orderedProblems.map(async (problem) => {
      const savedDraft = savedDraftsByQuestion.get(String(problem._id));
      const answer = providedAnswers.get(String(problem._id)) || (savedDraft
        ? {
          questionId: problem._id,
          language: savedDraft.language,
          code: savedDraft.code,
          codeByLanguage: savedDraft.codeByLanguage,
        }
        : undefined);
      const language = answer?.language || LANGUAGE_KEYS[0];
      const code = answer?.code ?? '';
      const codeByLanguage = {
        ...(savedDraft?.codeByLanguage || {}),
        ...(answer?.codeByLanguage || {}),
        [language]: code,
      };
      const testProblem = assessmentType === 'debugging'
        ? debuggingGraderProblem(problem)
        : problem;
      const resolved = resolveAssessmentAnswer({
        answer,
        evaluation: evaluationMap.get(String(problem._id)),
        maxPoints: problem.points || 0,
        questionTestCount: (testProblem.testCases || []).length,
        boilerplate: isBoilerplateCode(language, code),
      });

      return {
        problemId: problem._id,
        questionId: problem._id,
        title: problem.title,
        slug: problem.slug,
        language,
        code,
        codeByLanguage,
        status: resolved.status,
        accepted: resolved.accepted,
        passedTests: resolved.passedTests,
        totalTests: resolved.totalTests,
        awardedPoints: resolved.awardedPoints,
        passedCases: resolved.passedTests,
        failedCases: resolved.failedTests,
        totalCases: resolved.totalTests,
        accuracy: resolved.accuracy,
        score: resolved.awardedPoints,
        maxScore: problem.points || 0,
        executionTime: 0,
        testResults: [],
      };
    }));
  } catch (error) {
    await AssessmentSession.updateOne(
      { _id: finalizingSession._id, status: 'finalizing' },
      { $set: { status: 'in-progress' } }
    );
    throw error;
  }

  const score = results.reduce((sum, answer) => sum + answer.awardedPoints, 0);
  const maxScore = results.reduce((sum, answer) => sum + answer.maxScore, 0);
  const passedCases = results.reduce((sum, answer) => sum + answer.passedCases, 0);
  const totalCases = results.reduce((sum, answer) => sum + answer.totalCases, 0);
  const status = results.every((answer) => answer.status === 'accepted')
    ? 'accepted'
    : results.some((answer) => answer.awardedPoints > 0)
      ? 'partial'
      : results.find((answer) => answer.status === 'internal-error')?.status || 'wrong-answer';

  let submission;
  try {
    submission = await AssessmentSubmission.create({
      userId,
      assessmentType,
      sessionId: session._id,
      answers: results,
      status,
      score,
      maxScore,
      passedCases,
      totalCases,
      warningCount: finalizingSession.warningCount,
      warningEvents: finalizingSession.warningEvents,
      elapsedSeconds: Math.min(
        Math.floor(DURATION_MS / 1000),
        Math.max(0, Math.floor((now - session.startedAt.getTime()) / 1000))
      ),
      reason,
      submittedAt: new Date(now),
    });
  } catch (error) {
    if (error.code === 11000) {
      throw assessmentError(409, 'This assessment has already been submitted and is locked.');
    }
    try {
      await AssessmentSession.updateOne(
        { _id: finalizingSession._id, status: 'finalizing' },
        { $set: { status: 'in-progress' } }
      );
    } catch (resetError) {
      logger.error(`Could not release assessment finalization lock: session=${finalizingSession._id} error=${resetError.message}`);
    }
    throw error;
  }

  finalizingSession.status = 'submitted';
  finalizingSession.active = false;
  finalizingSession.submittedAt = submission.submittedAt;
  try {
    await finalizingSession.save();
  } catch (saveError) {
    logger.error(`Could not mark assessment session submitted: session=${finalizingSession._id} error=${saveError.message}`);
  }
  await invalidateAssessmentCaches(userId);
  logger.info(`Assessment submitted: user=${userId} type=${assessmentType} score=${score}/${maxScore} reason=${reason}`);
  return submission;
};

export const recordAssessmentWarning = (assessmentType) => asyncHandler(async (req, res) => {
  const { sessionId, event } = req.body;
  const sessionFilter = {
    _id: sessionId,
    userId: req.user._id,
    assessmentType,
    status: 'in-progress',
    expiresAt: { $gt: new Date() },
  };
  const recorded = await AssessmentSession.findOneAndUpdate(
    {
      ...sessionFilter,
      warningCount: { $lt: WARNING_LIMIT },
      warningEvents: {
        $not: {
          $elemMatch: { type: event.type, occurredAt: event.occurredAt },
        },
      },
    },
    {
      $inc: { warningCount: 1 },
      $push: { warningEvents: { $each: [event], $slice: -WARNING_LIMIT } },
    },
    { returnDocument: 'after' }
  ).select('warningCount warningEvents');

  if (recorded) {
    if (recorded.warningCount >= WARNING_LIMIT) {
      const submission = await finalizeAssessment({
        userId: req.user._id,
        assessmentType,
        sessionId,
        requestedReason: 'warning-limit',
      });
      res.json({
        success: true,
        data: {
          warningCount: submission.warningCount,
          warningEvents: submission.warningEvents,
          submitted: true,
          submission,
        },
      });
      return;
    }
    res.json({ success: true, data: { warningCount: recorded.warningCount, warningEvents: recorded.warningEvents } });
    return;
  }

  const session = await AssessmentSession.findOne(sessionFilter).select('warningCount warningEvents');
  if (!session) {
    res.status(409);
    throw new Error('The assessment is already submitted or the session has expired.');
  }
  const duplicate = session.warningEvents.some((warning) =>
    warning.type === event.type && new Date(warning.occurredAt).getTime() === new Date(event.occurredAt).getTime()
  );
  if (session.warningCount >= WARNING_LIMIT) {
    const submission = await finalizeAssessment({
      userId: req.user._id,
      assessmentType,
      sessionId,
      requestedReason: 'warning-limit',
    });
    res.json({
      success: true,
      alreadyRecorded: duplicate,
      data: {
        warningCount: submission.warningCount,
        warningEvents: submission.warningEvents,
        submitted: true,
        submission,
      },
    });
    return;
  }
  if (!duplicate && session.warningCount < WARNING_LIMIT) {
    res.status(409);
    throw new Error('The warning could not be recorded. Please retry before continuing.');
  }
  res.json({
    success: true,
    alreadyRecorded: duplicate,
    data: { warningCount: session.warningCount, warningEvents: session.warningEvents },
  });
});

export const saveAssessmentDraft = (assessmentType) => asyncHandler(async (req, res) => {
  const { sessionId, problemId, language, sourceCode } = req.body;
  const targetSession = await AssessmentSession.findById(sessionId).select('userId').lean();
  if (targetSession && String(targetSession.userId) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized to save code for this assessment.');
  }
  const now = new Date();
  const sessionFilter = {
    _id: sessionId,
    userId: req.user._id,
    assessmentType,
    active: true,
    status: 'in-progress',
    expiresAt: { $gt: now },
    questionIds: problemId,
  };
  const draft = {
    problemId: new mongoose.Types.ObjectId(problemId),
    questionId: new mongoose.Types.ObjectId(problemId),
    language,
    sourceCode,
    lastSavedAt: now,
  };
  const update = await AssessmentSession.updateOne(
    sessionFilter,
    [{
      $set: {
        drafts: {
          $concatArrays: [
            {
              $filter: {
                input: { $ifNull: ['$drafts', []] },
                as: 'draft',
                cond: {
                  $not: [{
                    $and: [
                      { $eq: ['$$draft.questionId', new mongoose.Types.ObjectId(problemId)] },
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
    res.status(409);
    throw new Error('The assessment session is unavailable or this question is not part of it.');
  }
  res.json({ success: true, data: { lastSavedAt: now } });
});

export const submitAssessment = (assessmentType) => asyncHandler(async (req, res) => {
  const submission = await finalizeAssessment({
    userId: req.user._id,
    assessmentType,
    sessionId: req.body.sessionId,
    answers: req.body.answers,
    requestedReason: req.body.reason || 'manual-submit',
  });
  res.status(201).json({ success: true, data: submission });
});

export const finalizeExpiredAssessments = async () => {
  const expiredSessions = await AssessmentSession.find({
    active: true,
    status: 'in-progress',
    expiresAt: { $lte: new Date() },
  }).select('_id userId assessmentType').lean();

  await Promise.all(expiredSessions.map(async (session) => {
    try {
      await finalizeAssessment({
        userId: session.userId,
        assessmentType: session.assessmentType,
        sessionId: session._id,
        requestedReason: 'time-limit',
      });
    } catch (error) {
      if (error.status !== 409) {
        logger.error(`Expired assessment could not be finalized: session=${session._id} error=${error.message}`);
      }
    }
  }));
};
