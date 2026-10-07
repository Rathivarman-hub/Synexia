import asyncHandler from 'express-async-handler';
import AssessmentSession from '../models/AssessmentSession.js';
import AssessmentSubmission from '../models/AssessmentSubmission.js';
import CodingProblem from '../models/CodingProblem.js';
import DebuggingProblem from '../models/DebuggingProblem.js';
import { LANGUAGE_KEYS } from '../config/languages.js';
import { gradeSubmission } from '../services/codingGraderService.js';
import { isConfigured } from '../services/codeExecutionService.js';
import { deleteCache, deleteCachePattern } from '../utils/cache.js';
import { invalidateAdminDashboardCache } from '../utils/adminDashboardCache.js';
import logger from '../config/logger.js';

const QUESTION_COUNT = 8;
const DURATION_MS = 90 * 60 * 1000;
const TIME_LIMIT_MS = Number(process.env.CODE_TIME_LIMIT_MS) || 5000;
const WARNING_LIMIT = 3;
const FINALIZATION_STALE_MS = 5 * 60 * 1000;

const modelFor = (type) => (type === 'debugging' ? DebuggingProblem : CodingProblem);

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

const publicSession = (session, questions) => ({
  _id: session._id,
  assessmentType: session.assessmentType,
  startedAt: session.startedAt,
  expiresAt: session.expiresAt,
  warningCount: session.warningCount || 0,
  warningEvents: session.warningEvents || [],
  questions: questions.map(({ _id, title, slug }) => ({ _id, title, slug })),
});

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

const emptyGrade = (points) => ({
  status: 'wrong-answer',
  passedCases: 0,
  failedCases: 0,
  totalCases: 0,
  accuracy: 0,
  score: 0,
  maxScore: points || 0,
  executionTime: 0,
  cases: [],
});

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
  }).lean();
  if (submission) {
    const repaired = await markSessionSubmitted(submission.sessionId, req.user._id, assessmentType, submission.submittedAt);
    if (repaired) await invalidateAssessmentCaches(req.user._id);
    res.json({ success: true, data: { submitted: true, submission } });
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
    { new: true }
  ).select('warningCount warningEvents');

  if (recorded) {
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

export const submitAssessment = (assessmentType) => asyncHandler(async (req, res) => {
  const existingSubmission = await AssessmentSubmission.findOne({
    userId: req.user._id,
    assessmentType,
  }).lean();
  if (existingSubmission) {
    await markSessionSubmitted(existingSubmission.sessionId, req.user._id, assessmentType, existingSubmission.submittedAt);
    await invalidateAssessmentCaches(req.user._id);
    res.json({ success: true, alreadySubmitted: true, data: existingSubmission });
    return;
  }

  await recoverStaleFinalization(req.user._id, assessmentType);
  const session = await AssessmentSession.findOne({
    _id: req.body.sessionId,
    userId: req.user._id,
    assessmentType,
    status: 'in-progress',
  });
  if (!session) {
    res.status(409);
    throw new Error('No active assessment session was found. Your assessment was not saved.');
  }

  const now = Date.now();
  const expired = now >= session.expiresAt.getTime();
  const reason = expired ? 'time-limit' : req.body.reason;
  if (!expired && reason === 'warning-limit' && session.warningCount < WARNING_LIMIT) {
    res.status(400);
    throw new Error('Automatic submission requires the maximum warning count.');
  }

  const providedAnswers = new Map(
    req.body.answers.map((answer) => [String(answer.questionId), answer])
  );
  if (providedAnswers.size !== req.body.answers.length) {
    res.status(400);
    throw new Error('Each assessment question can only have one final answer.');
  }
  const questionIdSet = new Set(session.questionIds.map(String));
  if ([...providedAnswers.keys()].some((id) => !questionIdSet.has(id))) {
    res.status(400);
    throw new Error('The submitted answers do not match this assessment.');
  }

  const Problem = modelFor(assessmentType);
  const problems = await Problem.find({ _id: { $in: session.questionIds } })
    .select(assessmentType === 'debugging'
      ? '+hiddenTestCases title slug points languageTemplates visibleTestCases sampleInput sampleOutput'
      : '+hiddenTestCases title slug points testCases')
    .lean();
  const problemMap = new Map(problems.map((problem) => [String(problem._id), problem]));
  const orderedProblems = session.questionIds.map((id) => problemMap.get(String(id)));
  if (orderedProblems.some((problem) => !problem)) {
    res.status(409);
    throw new Error('An assessment question is no longer available. Contact an administrator before submitting.');
  }

  const finalizingSession = await AssessmentSession.findOneAndUpdate(
    {
      _id: session._id,
      userId: req.user._id,
      assessmentType,
      status: 'in-progress',
    },
    { $set: { status: 'finalizing' } },
    { new: true }
  );
  if (!finalizingSession) {
    const saved = await AssessmentSubmission.findOne({ userId: req.user._id, assessmentType }).lean();
    if (saved) {
      res.json({ success: true, alreadySubmitted: true, data: saved });
      return;
    }
    res.status(409);
    throw new Error('This assessment is already being submitted. Please wait and retry.');
  }

  let results;
  try {
    results = await Promise.all(orderedProblems.map(async (problem) => {
    const answer = providedAnswers.get(String(problem._id));
    const language = answer?.language || LANGUAGE_KEYS[0];
    const code = answer?.code || '';
    const testProblem = assessmentType === 'debugging'
      ? debuggingGraderProblem(problem)
      : problem;
    if (!code.trim() || (assessmentType === 'debugging' && !problem.languageTemplates?.[language])) {
      return {
        questionId: problem._id,
        title: problem.title,
        slug: problem.slug,
        language,
        code,
        ...emptyGrade(problem.points),
        failedCases: (testProblem.testCases || []).length,
        totalCases: (testProblem.testCases || []).length,
      };
    }

    let result;
    if (!isConfigured()) {
      result = {
        ...emptyGrade(problem.points),
        status: 'internal-error',
        message: 'Code execution is unavailable; this answer was saved without a score.',
      };
    } else {
      try {
        result = await gradeSubmission(testProblem, { language, code, timeLimitMs: TIME_LIMIT_MS });
      } catch (error) {
        logger.error(`Assessment grading failed: type=${assessmentType} user=${req.user._id} question=${problem.slug} error=${error.message}`);
        result = {
          ...emptyGrade(problem.points),
          status: 'internal-error',
          message: 'Grading failed; this answer was saved without a score.',
        };
      }
    }

    return {
      questionId: problem._id,
      title: problem.title,
      slug: problem.slug,
      language,
      code,
      status: result.status,
      passedCases: result.passedCases || 0,
      failedCases: result.failedCases || 0,
      totalCases: result.totalCases || 0,
      accuracy: result.accuracy || 0,
      score: result.score || 0,
      maxScore: result.maxScore ?? problem.points ?? 0,
      executionTime: result.executionTime || 0,
      testResults: result.cases || [],
    };
    }));
  } catch (error) {
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

  const score = results.reduce((sum, answer) => sum + answer.score, 0);
  const maxScore = results.reduce((sum, answer) => sum + answer.maxScore, 0);
  const passedCases = results.reduce((sum, answer) => sum + answer.passedCases, 0);
  const totalCases = results.reduce((sum, answer) => sum + answer.totalCases, 0);
  const status = results.every((answer) => answer.status === 'accepted')
    ? 'accepted'
    : results.some((answer) => answer.score > 0)
      ? 'partial'
      : results.find((answer) => answer.status === 'internal-error')?.status || 'wrong-answer';

  let submission;
  try {
    submission = await AssessmentSubmission.create({
      userId: req.user._id,
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
    if (error.code !== 11000) {
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
    const saved = await AssessmentSubmission.findOne({ userId: req.user._id, assessmentType }).lean();
    if (!saved) throw error;
    finalizingSession.status = 'submitted';
    finalizingSession.active = false;
    finalizingSession.submittedAt = saved.submittedAt;
    try {
      await finalizingSession.save();
    } catch (saveError) {
      logger.error(`Could not mark assessment session submitted: session=${finalizingSession._id} error=${saveError.message}`);
    }
    await invalidateAssessmentCaches(req.user._id);
    res.json({ success: true, alreadySubmitted: true, data: saved });
    return;
  }

  finalizingSession.status = 'submitted';
  finalizingSession.active = false;
  finalizingSession.submittedAt = submission.submittedAt;
  try {
    await finalizingSession.save();
  } catch (saveError) {
    logger.error(`Could not mark assessment session submitted: session=${finalizingSession._id} error=${saveError.message}`);
  }
  await invalidateAssessmentCaches(req.user._id);
  logger.info(`Assessment submitted: user=${req.user._id} type=${assessmentType} score=${score}/${maxScore} reason=${reason}`);
  res.status(201).json({ success: true, data: submission });
});
