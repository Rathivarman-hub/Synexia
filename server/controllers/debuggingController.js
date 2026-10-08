import asyncHandler from 'express-async-handler';
import DebuggingProblem from '../models/DebuggingProblem.js';
import DebuggingSubmission from '../models/DebuggingSubmission.js';
import AssessmentSubmission from '../models/AssessmentSubmission.js';
import { LANGUAGE_KEYS, getLanguageManifest, getStarterTemplate } from '../config/languages.js';
import { gradeSubmission, runSampleTests } from '../services/codingGraderService.js';
import { isConfigured } from '../services/codeExecutionService.js';
import logger from '../config/logger.js';
import { lockProblemIfAssessmentFinalized } from '../services/assessmentLockService.js';
import { invalidateAdminDashboardCache } from '../utils/adminDashboardCache.js';
import { deleteCachePattern } from '../utils/cache.js';
import { evaluateAssessmentAnswer } from '../services/assessmentEvaluationService.js';

const TIME_LIMIT_MS = Number(process.env.CODE_TIME_LIMIT_MS) || 5000;
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
const slugify = (title) => String(title || '').toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 120);

const visibleTestCasesFor = (problem) => {
  const testCases = (problem.visibleTestCases || []).map((testCase) => ({
    input: testCase.input ?? '',
    expectedOutput: testCase.expectedOutput ?? '',
  }));
  const hasSample = testCases.some((testCase) =>
    testCase.input === (problem.sampleInput || '') &&
    testCase.expectedOutput === (problem.sampleOutput || '')
  );
  return hasSample
    ? testCases
    : [{ input: problem.sampleInput || '', expectedOutput: problem.sampleOutput || '' }, ...testCases];
};

const shapePublicProblem = (problem) => ({
  _id: problem._id,
  level: problem.level,
  title: problem.title,
  slug: problem.slug,
  description: problem.description,
  difficulty: problem.difficulty,
  points: problem.points,
  languageTemplates: problem.languageTemplates,
  sampleInput: problem.sampleInput,
  sampleOutput: problem.sampleOutput,
  visibleTestCases: visibleTestCasesFor(problem),
  hiddenCount: problem.hiddenTestCases?.length || 0,
  languages: getLanguageManifest(),
  isActive: problem.isActive,
  order: problem.order,
  acceptanceStats: problem.acceptanceStats,
});

const slugForCreate = async (title) => {
  const base = slugify(title) || `debugging-${Date.now()}`;
  let slug = base;
  let index = 1;
  while (await DebuggingProblem.exists({ slug })) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
};

const buildGraderProblem = (problem) => {
  const testCases = [
    ...visibleTestCasesFor(problem).map((testCase) => ({ ...testCase, hidden: false })),
    ...(problem.hiddenTestCases || []).map((testCase) => ({ ...testCase.toObject?.() || testCase, hidden: true })),
  ];
  return { points: problem.points, testCases };
};

export const listDebuggingProblems = asyncHandler(async (req, res) => {
  const { difficulty, language, points, search } = req.debuggingQuery;
  const filter = { isActive: true };
  if (difficulty) filter.difficulty = difficulty;
  if (points !== undefined) filter.points = Number(points);
  if (language && LANGUAGE_KEYS.includes(language)) filter[`languageTemplates.${language}`] = { $nin: ['', null] };
  if (search?.trim()) {
    const regex = { $regex: escapeRegex(search.trim()), $options: 'i' };
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const problems = await DebuggingProblem.find(filter)
    .select('level title slug description difficulty points languageTemplates visibleTestCases sampleInput sampleOutput isActive order acceptanceStats')
    .sort({ order: 1, level: 1, points: 1 })
    .lean();
  const ids = problems.map((problem) => problem._id);
  const attempts = ids.length ? await DebuggingSubmission.aggregate([
    { $match: { userId: req.user._id, isRun: false, problemId: { $in: ids } } },
    {
      $set: {
        score: {
          $cond: [
            { $and: [{ $eq: ['$status', 'accepted'] }, { $gt: ['$totalCases', 0] }, { $eq: ['$passedCases', '$totalCases'] }] },
            '$maxScore',
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$problemId',
        bestScore: { $max: '$score' },
        maxScore: { $max: '$maxScore' },
        totalAttempts: { $sum: 1 },
        accepted: { $max: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
      },
    },
  ]) : [];
  const attemptMap = Object.fromEntries(attempts.map((row) => [String(row._id), row]));
  const pointOptions = await DebuggingProblem.distinct('points', { isActive: true });
  res.json({
    success: true,
    total: problems.length,
    difficulties: [...new Set(problems.map((problem) => problem.difficulty))],
    points: pointOptions.sort((a, b) => a - b),
    data: problems.map((problem) => ({
      _id: problem._id,
      level: problem.level,
      title: problem.title,
      slug: problem.slug,
      description: problem.description,
      difficulty: problem.difficulty,
      points: problem.points,
      languages: LANGUAGE_KEYS.filter((key) => Boolean(problem.languageTemplates?.[key])),
      visibleTestCases: problem.visibleTestCases,
      sampleInput: problem.sampleInput,
      sampleOutput: problem.sampleOutput,
      order: problem.order,
      acceptanceStats: problem.acceptanceStats,
      status: attemptMap[String(problem._id)]?.accepted ? 'solved'
        : attemptMap[String(problem._id)] ? 'attempted' : 'none',
      solved: Boolean(attemptMap[String(problem._id)]?.accepted),
      bestScore: attemptMap[String(problem._id)]?.bestScore || 0,
      maxScore: attemptMap[String(problem._id)]?.maxScore || 0,
      totalAttempts: attemptMap[String(problem._id)]?.totalAttempts || 0,
    })),
  });
});

export const getDebuggingProblem = asyncHandler(async (req, res) => {
  const language = LANGUAGE_KEYS.includes(req.query.language) ? req.query.language : 'python';
  const problem = await DebuggingProblem.findOne({ slug: req.params.slug, isActive: true })
    .select('-solutionCode -hiddenTestCases')
    .lean();
  if (!problem) {
    res.status(404);
    throw new Error('Debugging question not found');
  }
  if (!problem.languageTemplates?.[language]) {
    res.status(409);
    throw new Error(`No ${language} template is configured for this debugging question.`);
  }
  const [individualAttempts, assessmentAttempts] = await Promise.all([
    DebuggingSubmission.countDocuments({ userId: req.user._id, problemId: problem._id, isRun: false }),
    AssessmentSubmission.countDocuments({
      userId: req.user._id,
      assessmentType: 'debugging',
      submitted: true,
      'answers.questionId': problem._id,
    }),
  ]);
  const data = shapePublicProblem(problem);
  data.languageTemplates = { [language]: getStarterTemplate(language) };
  data.totalAttempts = individualAttempts + assessmentAttempts;
  delete data.hiddenCount;
  res.json({ success: true, data });
});

export const getDebuggingProgress = asyncHandler(async (req, res) => {
  const problems = await DebuggingProblem.find({ isActive: true })
    .select('level title slug difficulty points order')
    .sort({ order: 1, level: 1 })
    .lean();
  const [submissions, assessmentRows] = await Promise.all([DebuggingSubmission.aggregate([
    { $match: { userId: req.user._id, isRun: false, problemId: { $in: problems.map((problem) => problem._id) } } },
    {
      $set: {
        score: {
          $cond: [
            { $and: [{ $eq: ['$status', 'accepted'] }, { $gt: ['$totalCases', 0] }, { $eq: ['$passedCases', '$totalCases'] }] },
            '$maxScore',
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$problemId',
        bestScore: { $max: '$score' },
        maxScore: { $max: '$maxScore' },
        totalAttempts: { $sum: 1 },
        accepted: { $max: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
      },
    },
  ]), AssessmentSubmission.aggregate([
    { $match: { userId: req.user._id, assessmentType: 'debugging', submitted: true } },
    { $unwind: '$answers' },
    { $match: { 'answers.questionId': { $in: problems.map((problem) => problem._id) } } },
    {
      $set: {
        'answers.score': {
          $cond: [
            {
              $and: [
                { $eq: ['$answers.status', 'accepted'] },
                { $gt: ['$answers.totalCases', 0] },
                { $eq: ['$answers.passedCases', '$answers.totalCases'] },
              ],
            },
            '$answers.maxScore',
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$answers.questionId',
        bestScore: { $max: '$answers.score' },
        maxScore: { $max: '$answers.maxScore' },
        accepted: { $max: { $cond: [{ $eq: ['$answers.status', 'accepted'] }, 1, 0] } },
      },
    },
  ])]);
  const progressRows = new Map(submissions.map((row) => [String(row._id), { ...row }]));
  assessmentRows.forEach((row) => {
    const key = String(row._id);
    const existing = progressRows.get(key) || { _id: row._id, bestScore: 0, maxScore: 0, accepted: 0, totalAttempts: 0 };
    existing.bestScore = Math.max(existing.bestScore || 0, row.bestScore || 0);
    existing.maxScore = Math.max(existing.maxScore || 0, row.maxScore || 0);
    existing.accepted = Math.max(existing.accepted || 0, row.accepted || 0);
    existing.totalAttempts += 1;
    progressRows.set(key, existing);
  });
  const progress = Object.fromEntries([...progressRows].map(([key, row]) => [key, row]));
  res.json({
    success: true,
    data: problems.map((problem) => {
      const attempt = progress[String(problem._id)];
      return {
        ...problem,
        status: attempt?.accepted ? 'solved' : attempt ? 'attempted' : 'none',
        solved: Boolean(attempt?.accepted),
        bestScore: attempt?.bestScore || 0,
        maxScore: attempt?.maxScore || 0,
        totalAttempts: attempt?.totalAttempts || 0,
      };
    }),
  });
});

export const runDebuggingCode = asyncHandler(async (req, res) => {
  const { problemId, language, code, assessmentSessionId } = req.body;
  const assessmentLock = await lockProblemIfAssessmentFinalized({
    userId: req.user._id,
    assessmentType: 'debugging',
    problemId,
  });
  if (assessmentLock.finalSubmission || assessmentLock.finalizingSession) {
    res.status(409);
    throw new Error('This assessment has been submitted and is read-only.');
  }
  if (assessmentLock.expiredSession) {
    res.status(409);
    throw new Error('The assessment time limit has ended. Your saved answers must be submitted now.');
  }
  const submitted = assessmentLock.activeSession
    ? false
    : await DebuggingSubmission.exists({ userId: req.user._id, problemId, isRun: false });
  if (submitted) {
    res.status(409);
    throw new Error('This debugging question has already been submitted and is locked.');
  }
  if (!isConfigured()) {
    res.status(503);
    throw new Error('Code execution is unavailable. Configure a supported execution provider.');
  }
  const problem = await DebuggingProblem.findById(problemId).select('+hiddenTestCases');
  if (!problem || !problem.isActive) {
    res.status(404);
    throw new Error('Debugging question not found');
  }
  if (!problem.languageTemplates?.[language]) {
    res.status(400);
    throw new Error(`No template is configured for ${language}.`);
  }
  const result = assessmentLock.activeSession
    ? await evaluateAssessmentAnswer({
      assessmentType: 'debugging',
      userId: req.user._id,
      sessionId: assessmentSessionId,
      problemId,
      language,
      code,
      timeLimitMs: TIME_LIMIT_MS,
    })
    : await runSampleTests(buildGraderProblem(problem), { language, code, timeLimitMs: TIME_LIMIT_MS });
  res.json({ success: true, data: { ...result, language, sampleCount: result.cases.length } });
});

export const submitDebuggingCode = asyncHandler(async (req, res) => {
  const { problemId, language, code, assessment = {} } = req.body;
  const isWarningLimitSubmission = assessment.reason === 'warning-limit';
  const assessmentLock = await lockProblemIfAssessmentFinalized({
    userId: req.user._id,
    assessmentType: 'debugging',
    problemId,
  });
  if (assessmentLock.activeSession || assessmentLock.finalizingSession || assessmentLock.finalSubmission) {
    res.status(409);
    throw new Error('Assessment questions can only be submitted with the final assessment submission.');
  }
  const existing = await DebuggingSubmission.exists({ userId: req.user._id, problemId, isRun: false });
  if (existing) {
    res.status(409);
    throw new Error('This debugging question has already been submitted and is locked for editing.');
  }
  if (!isConfigured() && !isWarningLimitSubmission) {
    res.status(503);
    throw new Error('Code execution is unavailable. Configure a supported execution provider.');
  }
  const problem = await DebuggingProblem.findById(problemId).select('+hiddenTestCases');
  if (!problem || !problem.isActive) {
    res.status(404);
    throw new Error('Debugging question not found');
  }
  if (!problem.languageTemplates?.[language]) {
    res.status(400);
    throw new Error(`No template is configured for ${language}.`);
  }

  let result;
  if (isConfigured()) {
    try {
      result = await gradeSubmission(buildGraderProblem(problem), { language, code, timeLimitMs: TIME_LIMIT_MS });
    } catch (error) {
      if (!isWarningLimitSubmission) throw error;
      logger.error(`Debugging auto-submit grading failed: ${error.message}`);
      result = {
        status: 'internal-error', passedCases: 0, failedCases: 0, totalCases: 0,
        accuracy: 0, score: 0, maxScore: problem.points, executionTime: 0,
        memoryUsageKB: 0, cases: [], message: 'Automatically submitted after reaching the warning limit; grading failed.',
      };
    }
  } else {
    result = {
      status: 'internal-error', passedCases: 0, failedCases: 0, totalCases: 0,
      accuracy: 0, score: 0, maxScore: problem.points, executionTime: 0,
      memoryUsageKB: 0, cases: [],
      message: 'Automatically submitted after reaching the warning limit; grading service was unavailable.',
    };
  }

  let submission;
  try {
    submission = await DebuggingSubmission.create({
      userId: req.user._id,
      problemId,
      language,
      code,
      status: result.status,
      passedCases: result.passedCases,
      failedCases: result.failedCases,
      totalCases: result.totalCases,
      accuracy: result.accuracy,
      score: result.score,
      maxScore: result.maxScore,
      executionTime: result.executionTime,
      memoryUsageKB: result.memoryUsageKB,
      testResults: result.cases,
      output: (result.cases.find((testCase) => !testCase.hidden && testCase.output)?.output || '').slice(0, 2000),
      error: (result.message || '').slice(0, 2000),
      assessmentReason: isWarningLimitSubmission ? 'warning-limit' : 'normal',
      warningCount: Math.min(3, Math.max(0, Number(assessment.warningCount) || 0)),
      warningEvents: Array.isArray(assessment.warningEvents) ? assessment.warningEvents.slice(0, 3) : [],
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    res.status(409);
    throw new Error('This debugging question has already been submitted and is locked for editing.');
  }
  await DebuggingProblem.updateOne(
    { _id: problem._id },
    { $inc: { 'acceptanceStats.totalSubmissions': 1, ...(result.status === 'accepted' ? { 'acceptanceStats.acceptedSubmissions': 1 } : {}) } }
  );
  await Promise.all([
    invalidateAdminDashboardCache(),
    deleteCachePattern('coding:leaderboard:*'),
    deleteCachePattern('coding:rank:*'),
  ]);
  logger.info(`Debugging submit: user=${req.user._id} problem=${problem.slug} lang=${language} status=${result.status}`);
  res.status(201).json({
    success: true,
    data: {
      submissionId: submission._id,
      status: result.status,
      passedCases: result.passedCases,
      failedCases: result.failedCases,
      totalCases: result.totalCases,
      accuracy: result.accuracy,
      score: result.score,
      maxScore: result.maxScore,
      pointsAwarded: result.score,
      executionTime: result.executionTime,
      memoryUsageKB: result.memoryUsageKB,
      submittedAt: submission.submittedAt,
      message: result.message,
      cases: result.cases,
    },
  });
});

export const listDebuggingAdminProblems = asyncHandler(async (_req, res) => {
  const problems = await DebuggingProblem.find({})
    .select('level title slug difficulty points languageTemplates isActive order')
    .sort({ order: 1, level: 1 })
    .lean();
  const data = problems.map((problem) => ({
    _id: problem._id,
    level: problem.level,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    points: problem.points,
    languages: LANGUAGE_KEYS.filter((key) => Boolean(problem.languageTemplates?.[key])),
    isActive: problem.isActive,
    order: problem.order,
  }));
  res.json({ success: true, total: data.length, data });
});

export const getDebuggingAdminProblem = asyncHandler(async (req, res) => {
  const problem = await DebuggingProblem.findById(req.params.id)
    .select('+hiddenTestCases');
  if (!problem) {
    res.status(404);
    throw new Error('Debugging question not found');
  }
  res.json({ success: true, data: problem });
});

export const createDebuggingProblem = asyncHandler(async (req, res) => {
  const slug = await slugForCreate(req.body.title);
  const problem = await DebuggingProblem.create({ ...req.body, slug });
  await invalidateAdminDashboardCache();
  logger.info(`Debugging problem created: ${problem.slug} by ${req.user._id}`);
  res.status(201).json({ success: true, data: problem });
});

export const updateDebuggingProblem = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  const problem = await DebuggingProblem.findByIdAndUpdate(req.params.id, updates, {
    returnDocument: 'after',
    runValidators: true,
    select: '+hiddenTestCases',
  });
  if (!problem) {
    res.status(404);
    throw new Error('Debugging question not found');
  }
  await invalidateAdminDashboardCache();
  res.json({ success: true, data: problem });
});

export const deleteDebuggingProblem = asyncHandler(async (req, res) => {
  const problem = await DebuggingProblem.findByIdAndDelete(req.params.id);
  if (!problem) {
    res.status(404);
    throw new Error('Debugging question not found');
  }
  const submissions = await DebuggingSubmission.countDocuments({ problemId: problem._id });
  await invalidateAdminDashboardCache();
  res.json({ success: true, data: { id: problem._id, orphanedSubmissions: submissions } });
});
