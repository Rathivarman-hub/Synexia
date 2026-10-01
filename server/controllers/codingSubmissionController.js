import asyncHandler from 'express-async-handler';
import CodingProblem from '../models/CodingProblem.js';
import CodingSubmission from '../models/CodingSubmission.js';
import { gradeSubmission, runSampleTests } from '../services/codingGraderService.js';
import { getUserProblemStatusMap } from '../services/codingLeaderboardService.js';
import { getExecutionStatus, isConfigured } from '../services/codeExecutionService.js';
import { getCache, setCache, deleteCache, deleteCachePattern } from '../utils/cache.js';
import logger from '../config/logger.js';

const SUBMISSIONS_TTL = 60;
const TIME_LIMIT_MS = Number(process.env.CODE_TIME_LIMIT_MS) || 5000;

/**
 * @desc    Execute user code against the SAMPLE test cases only.
 *         Never scored, never persisted as a graded attempt.
 * @route   POST /api/coding/run
 * @access  Private (student)
 */
export const runCode = asyncHandler(async (req, res) => {
  const { problemId, language, code, caseIndices } = req.body;

  const existingSubmission = await CodingSubmission.findOne({
    userId: req.user._id,
    problemId,
    isRun: false,
  }).select('_id').lean();
  if (existingSubmission) {
    res.status(409);
    throw new Error('This problem has already been submitted and is locked.');
  }

  if (!isConfigured()) {
    res.status(503);
    throw new Error('Code execution is unavailable. Configure a supported CODE_EXECUTION_PROVIDER and its endpoint or credentials.');
  }

  const problem = await CodingProblem.findById(problemId).select('+hiddenTestCases');
  if (!problem || !problem.isActive) {
    res.status(404);
    throw new Error('Problem not found');
  }

  const result = await runSampleTests(problem, { language, code, caseIndices, timeLimitMs: TIME_LIMIT_MS });

  // WHY isRun rows ARE persisted, but excluded from every aggregate in
  // codingLeaderboardService (isRun: false filter). Persisting them gives the
  // student a unified "Run then Submit" history; filtering them there keeps runs
  // out of acceptance rate and rank. One flag, two responsibilities, no
  // duplicate collection.
  await CodingSubmission.create({
    userId: req.user._id,
    problemId: problem._id,
    language,
    code,
    status: result.status,
    passedCases: result.passedCases,
    failedCases: result.failedCases,
    totalCases: result.cases.length,
    accuracy: result.cases.length
      ? Math.round((result.cases.filter((c) => c.passed).length / result.cases.length) * 1000) / 10
      : 0,
    score: 0,
    maxScore: problem.points,
    executionTime: result.executionTime,
    memoryUsageKB: result.memoryUsageKB,
    output: (result.cases[0]?.output || '').slice(0, 2000),
    error: (result.cases.find((c) => c.status !== 'ok')?.error || '').slice(0, 2000),
    isRun: true,
  });

  res.json({
    success: true,
    data: {
      language,
      cases: result.cases,
      status: result.status,
      passedCases: result.passedCases,
      failedCases: result.failedCases,
      executionTime: result.executionTime,
      memoryUsageKB: result.memoryUsageKB,
      // Sample coverage only — the client shows this so the user understands that
      // "Run" is not a verdict. Never disclose the hidden count's expected values.
      sampleCount: result.cases.length,
    },
  });
});

/**
 * @desc    Grade code against sample + hidden test cases, persist, update stats.
 * @route   POST /api/coding/submit
 * @access  Private (student)
 */
export const submitCode = asyncHandler(async (req, res) => {
  const { problemId, language, code, assessment = {} } = req.body;
  const isWarningLimitSubmission = assessment.reason === 'warning-limit';

  const existingSubmission = await CodingSubmission.findOne({
    userId: req.user._id,
    problemId,
    isRun: false,
  }).select('_id').lean();
  if (existingSubmission) {
    res.status(409);
    throw new Error('This solution has already been submitted and is locked for editing.');
  }

  if (!isConfigured() && !isWarningLimitSubmission) {
    res.status(503);
    throw new Error('Code execution is unavailable. Configure a supported CODE_EXECUTION_PROVIDER and its endpoint or credentials.');
  }

  // WHY: hiddenTestCases is `select: false` on the schema, so it must be
  // explicitly requested. Without it the grader would silently run samples only
  // and award full marks — the exact bug that would make the whole module
  // meaningless.
  const problem = await CodingProblem.findById(problemId).select('+hiddenTestCases');
  if (!problem || !problem.isActive) {
    res.status(404);
    throw new Error('Problem not found');
  }
  if (!problem.testCases?.length) {
    res.status(409);
    throw new Error('This problem has no test cases configured yet.');
  }

  let result;
  if (isConfigured()) {
    try {
      result = await gradeSubmission(problem, { language, code, timeLimitMs: TIME_LIMIT_MS });
    } catch (error) {
      if (!isWarningLimitSubmission) throw error;
      result = {
        status: 'internal-error',
        passedCases: 0,
        failedCases: 0,
        totalCases: 0,
        accuracy: 0,
        score: 0,
        maxScore: problem.points,
        executionTime: 0,
        memoryUsageKB: 0,
        cases: [],
        message: 'Automatically submitted after reaching the warning limit; grading failed.',
      };
    }
  } else {
    result = {
      status: 'internal-error',
      passedCases: 0,
      failedCases: 0,
      totalCases: 0,
      accuracy: 0,
      score: 0,
      maxScore: problem.points,
      executionTime: 0,
      memoryUsageKB: 0,
      cases: [],
      message: 'Automatically submitted after reaching the warning limit; grading service was unavailable.',
    };
  }

  const submission = await CodingSubmission.create({
    userId: req.user._id,
    problemId: problem._id,
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
    output: (result.cases.find((c) => !c.hidden && c.output)?.output || '').slice(0, 2000),
    error: (result.message || '').slice(0, 2000),
    isRun: false,
    assessmentReason: isWarningLimitSubmission ? 'warning-limit' : 'normal',
    warningCount: Math.min(3, Math.max(0, Number(assessment.warningCount) || 0)),
    warningEvents: Array.isArray(assessment.warningEvents) ? assessment.warningEvents.slice(0, 3) : [],
    elapsedSeconds: Math.max(0, Number(assessment.elapsedSeconds) || 0),
    submittedAt: new Date(),
  });

  // WHY: acceptanceStats is a denormalised counter on the problem document so the
  // problems table can render an Acceptance Rate column without an aggregate per
  // row. $inc is atomic — two concurrent accepts cannot lose an increment, which
  // a read-then-write in JS would.
  await CodingProblem.updateOne(
    { _id: problem._id },
    {
      $inc: {
        'acceptanceStats.totalSubmissions': 1,
        ...(result.status === 'accepted' ? { 'acceptanceStats.acceptedSubmissions': 1 } : {}),
      },
    }
  );

  // WHY invalidate caches: this submission changed the user's Status column,
  // problem acceptance rate, and student leaderboard data.
  await Promise.all([
    deleteCachePattern('coding:problems:list:*'),
    deleteCache(`coding:problem:${problem.slug}`),
    deleteCachePattern(`coding:leaderboard:*`),
    deleteCache(`coding:rank:${req.user._id}`),
    deleteCache(`coding:stats:assessment:${req.user._id}`),
  ]);

  logger.info(
    `Coding submit: user=${req.user._id} problem=${problem.slug} lang=${language} status=${result.status} ${result.passedCases}/${result.totalCases}`
  );

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
      // Hidden cases report pass/fail only. expectedOutput and input are null
      // server-side for every hidden case — nothing here leaks an answer.
      cases: result.cases,
    },
  });
});

/**
 * @desc    Paginated submission history for the current user
 * @route   GET /api/coding/submissions/me
 * @access  Private (student)
 */
export const getMySubmissions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, problemId, language, status } = req.query;
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  const filter = { userId: req.user._id };
  if (problemId) filter.problemId = problemId;
  if (language) filter.language = language;
  if (status) filter.status = status;
  // WHY: default to real submissions. The dashboard's "Recent Submissions" list
  // must not be polluted by dozens of Run attempts.
  if (req.query.includeRuns !== 'true') filter.isRun = false;

  const cacheKey = `coding:submissions:${req.user._id}:${JSON.stringify({ filter, skip, safeLimit })}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    res.json({ success: true, cached: true, ...cached });
    return;
  }

  const [total, submissions] = await Promise.all([
    CodingSubmission.countDocuments(filter),
    // WHY: populate only the two display fields. `code` is up to 20 KB per row —
    // returning a page of it would triple the payload for data the list view
    // never renders.
    CodingSubmission.find(filter)
      .populate('problemId', 'title slug difficulty points')
      .select('-code -output -error -testResults')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
  ]);

  const payload = { total, page: safePage, limit: safeLimit, data: submissions };
  await setCache(cacheKey, payload, SUBMISSIONS_TTL);

  res.json({ success: true, cached: false, ...payload });
});

/**
 * @desc    Full text + per-problem breakdown of one of MY submissions
 * @route   GET /api/coding/submissions/:id
 * @access  Private (owner or admin)
 */
export const getSubmission = asyncHandler(async (req, res) => {
  const submission = await CodingSubmission.findById(req.params.id)
    .populate('problemId', 'title slug difficulty points')
    .lean();

  if (!submission) {
    res.status(404);
    throw new Error('Submission not found');
  }

  const isOwner = String(submission.userId) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view this submission');
  }

  res.json({ success: true, data: submission });
});

/**
 * @desc    Dashboard card payload: current user's score and solved count
 * @route   GET /api/coding/stats/me
 * @access  Private (student)
 */
export const getMyCodingStats = asyncHandler(async (req, res) => {
  const cacheKey = `coding:stats:assessment:${req.user._id}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    res.json({ success: true, cached: true, data: cached });
    return;
  }

  const [ownScoreRows, totals, recent] = await Promise.all([
    CodingSubmission.aggregate([
      { $match: { userId: req.user._id, isRun: false } },
      {
        $group: {
          _id: '$problemId',
          bestScore: { $max: '$score' },
          attempts: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          codingScore: { $sum: '$bestScore' },
          totalAttempts: { $sum: '$attempts' },
        },
      },
    ]),
    Promise.all([
      CodingProblem.countDocuments({ isActive: true }),
      CodingSubmission.countDocuments({ userId: req.user._id, isRun: false, status: 'accepted' }),
      // WHY: distinct problems, not accepted submissions. Re-submitting a solved
      // problem 5 times must still read as "1 problem solved".
      CodingSubmission.distinct('problemId', { userId: req.user._id, isRun: false, status: 'accepted' }),
    ]),
    CodingSubmission.find({ userId: req.user._id, isRun: false })
      .populate('problemId', 'title slug difficulty points')
      .select('-code -output -error -testResults')
      .sort({ submittedAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const [totalProblems, acceptedSubmissions, solvedProblemIds] = totals;
  const ownScore = ownScoreRows[0] || { codingScore: 0, totalAttempts: 0 };

  const payload = {
    problemsSolved: solvedProblemIds.length,
    totalProblems,
    progress: totalProblems ? Math.round((solvedProblemIds.length / totalProblems) * 100) : 0,
    codingScore: ownScore.codingScore,
    totalAttempts: ownScore.totalAttempts,
    acceptedSubmissions,
    recentSubmissions: recent,
  };

  await setCache(cacheKey, payload, SUBMISSIONS_TTL);
  res.json({ success: true, cached: false, data: payload });
});

/**
 * @desc    Per-problem solve map for the current user (dashboard "my progress")
 * @route   GET /api/coding/stats/me/problems
 * @access  Private (student)
 */
export const getMyProblemProgress = asyncHandler(async (req, res) => {
  const problems = await CodingProblem.find({ isActive: true })
    .select('title slug difficulty points')
    .sort({ order: 1, points: 1 })
    .lean({ virtuals: true });

  const statusMap = await getUserProblemStatusMap(req.user._id, problems.map((p) => p._id));

  res.json({
    success: true,
    data: problems.map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      difficultyLabel: p.difficultyLabel,
      points: p.points,
      ...(statusMap[p._id] || { status: 'none', solved: false, bestScore: 0, totalAttempts: 0 }),
    })),
  });
});

/**
 * @desc    Execution provider health, for the UI's degraded-mode banner
 * @route   GET /api/coding/execution-status
 * @access  Private (student)
 */
export const getExecutionStatusRoute = asyncHandler(async (req, res) => {
  const status = getExecutionStatus();
  res.json({ success: true, data: { ...status, configured: status.configured } });
});
