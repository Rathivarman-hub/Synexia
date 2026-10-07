import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import User from '../models/User.js';
import CodingProblem from '../models/CodingProblem.js';
import DebuggingProblem from '../models/DebuggingProblem.js';
import CodingSubmission from '../models/CodingSubmission.js';
import DebuggingSubmission from '../models/DebuggingSubmission.js';
import AssessmentSession from '../models/AssessmentSession.js';
import AssessmentSubmission from '../models/AssessmentSubmission.js';
import { Parser } from 'json2csv';
import { deleteCache, getCache, setCache, deleteCachePattern } from '../utils/cache.js';
import { invalidateAdminDashboardCache } from '../utils/adminDashboardCache.js';

/**
 * SYNEXIA - Admin controller
 *
 * WHY this file no longer mentions Assessment or Question:
 * the MCQ module (models/Assessment.js, models/Question.js and their controllers)
 * has been removed. This controller still exists because "User Management" and
 * the "Admin Panel" are kept features — they just aggregate the CODING
 * collections now. Every field below is sourced from CodingProblem or
 * CodingSubmission; nothing is invented in the client.
 *
 * One deliberate semantic change: the old `passRate` metric meant "share of
 * students who scored >= 40% on an MCQ paper". There is no equivalent here,
 * because coding has no single graded attempt per student. `acceptanceRate` is
 * the honest analogue — the share of SUBMISSIONS that the judge accepted.
 */

// ─── Cache TTLs ───────────────────────────────────────────────────────────────
const STATS_TTL = 120;       // 2 minutes — stats tolerate slight staleness
const TRENDS_TTL = 300;      // 5 minutes — trends change infrequently

/**
 * Shared per-student coding rollup.
 *
 * WHY one aggregation instead of a per-student query: the previous version ran
 * Assessment.aggregate() once per student, so a 15-row page cost 16 DB round
 * trips and a 500-student page cost 501. Grouping by userId in a single pass is
 * always 1 query regardless of page size.
 *
 * WHY `$addToSet` + `$size` for problemsSolved: re-submitting a solved problem
 * must still read as 1 problem solved, exactly like the per-student stats
 * endpoint. Summing submission rows would inflate it.
 *
 * WHY `bestScore` is a $max and not a $sum: the leaderboard ranks students by
 * total points across DISTINCT solved problems (see codingLeaderboardService),
 * so the admin "best score" column must use the same definition or the two
 * screens will disagree.
 */
const studentCodingRollup = (userIds) =>
  CodingSubmission.aggregate([
    { $match: { isRun: false, ...(userIds ? { userId: { $in: userIds } } : {}) } },
    {
      $group: {
        _id: '$userId',
        attempts: { $sum: 1 },
        acceptedSubmissions: {
          $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
        },
        bestScore: { $max: '$score' },
        solvedProblemIds: {
          $addToSet: {
            $cond: [{ $eq: ['$status', 'accepted'] }, '$problemId', '$$REMOVE'],
          },
        },
        lastActive: { $max: '$submittedAt' },
      },
    },
    {
      $project: {
        attempts: 1,
        acceptedSubmissions: 1,
        bestScore: 1,
        lastActive: 1,
        problemsSolved: { $size: '$solvedProblemIds' },
      },
    },
  ]);

/** Shape a rollup row for the UI, tolerating a student with no submissions. */
const EMPTY_CODING_STATS = {
  attempts: 0,
  acceptedSubmissions: 0,
  problemsSolved: 0,
  bestScore: 0,
  lastActive: null,
};

const rollupByUserId = (rows) => {
  const map = {};
  rows.forEach((r) => {
    map[String(r._id)] = r;
  });
  return map;
};

export const deleteStudents = asyncHandler(async (req, res) => {
  const studentIds = req.body.studentIds.map((id) => new mongoose.Types.ObjectId(id));
  const session = await mongoose.startSession();
  let deletedCount = 0;

  try {
    await session.withTransaction(async () => {
      const students = await User.find({ _id: { $in: studentIds }, role: 'student' })
        .select('_id')
        .session(session)
        .lean();
      if (students.length !== studentIds.length) {
        res.status(404);
        throw new Error('One or more selected students no longer exist.');
      }

      const userFilter = { userId: { $in: studentIds } };
      await CodingSubmission.deleteMany(userFilter, { session });
      await DebuggingSubmission.deleteMany(userFilter, { session });
      await AssessmentSession.deleteMany(userFilter, { session });
      await AssessmentSubmission.deleteMany(userFilter, { session });

      const result = await User.deleteMany({ _id: { $in: studentIds }, role: 'student' }, { session });
      if (result.deletedCount !== studentIds.length) {
        res.status(409);
        throw new Error('Student records changed during deletion. No records were deleted.');
      }
      deletedCount = result.deletedCount;
    });
  } finally {
    await session.endSession();
  }

  await Promise.all([
    invalidateAdminDashboardCache(),
    deleteCachePattern('coding:leaderboard:*'),
    ...studentIds.flatMap((id) => [
      deleteCache(`user:${id}`),
      deleteCache(`coding:rank:${id}`),
      deleteCache(`coding:stats:assessment:${id}`),
      deleteCachePattern(`coding:submissions:${id}:*`),
    ]),
  ]);

  res.json({ success: true, deletedCount });
});

// @desc    Admin dashboard stats
// @route   GET /api/admin/stats
// @access  Admin
export const getStats = asyncHandler(async (req, res) => {
  const cacheKey = 'admin:stats';
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ success: true, cached: true, data: cached });

  const [
    studentIds, codingProblems, activeCodingProblems, debuggingProblems, activeDebuggingProblems,
  ] = await Promise.all([
    User.distinct('_id', { role: 'student' }),
    CodingProblem.countDocuments(),
    CodingProblem.countDocuments({ isActive: true }),
    DebuggingProblem.countDocuments(),
    DebuggingProblem.countDocuments({ isActive: true }),
  ]);
  const userFilter = { userId: { $in: studentIds } };
  const [
    codingSubmissions, codingAccepted, debuggingSubmissions, debuggingAccepted,
    assessmentSubmissions, assessmentAccepted, codingSubmitters, debuggingSubmitters, assessmentSubmitters,
  ] = await Promise.all([
    CodingSubmission.countDocuments({ ...userFilter, isRun: false }),
    CodingSubmission.countDocuments({ ...userFilter, isRun: false, status: 'accepted' }),
    DebuggingSubmission.countDocuments({ ...userFilter, isRun: false }),
    DebuggingSubmission.countDocuments({ ...userFilter, isRun: false, status: 'accepted' }),
    AssessmentSubmission.countDocuments({ ...userFilter, submitted: true }),
    AssessmentSubmission.countDocuments({ ...userFilter, submitted: true, status: 'accepted' }),
    CodingSubmission.distinct('userId', { ...userFilter, isRun: false }),
    DebuggingSubmission.distinct('userId', { ...userFilter, isRun: false }),
    AssessmentSubmission.distinct('userId', { ...userFilter, submitted: true }),
  ]);

  const distinctActiveStudentIds = [...new Set(
    [...codingSubmitters, ...debuggingSubmitters, ...assessmentSubmitters].map(String)
  )];
  const activeStudents = distinctActiveStudentIds.length;

  const totalSubmissions = codingSubmissions + debuggingSubmissions + assessmentSubmissions;
  const acceptedSubmissions = codingAccepted + debuggingAccepted + assessmentAccepted;
  const data = {
    totalStudents: studentIds.length,
    activeStudents,
    totalProblems: codingProblems + debuggingProblems,
    activeProblems: activeCodingProblems + activeDebuggingProblems,
    totalSubmissions,
    acceptedSubmissions,
    acceptanceRate: totalSubmissions ? Math.round((acceptedSubmissions / totalSubmissions) * 1000) / 10 : 0,
    // A completed eight-question assessment counts as one final submission.
    gradedSubmissions: totalSubmissions,
  };

  await setCache(cacheKey, data, STATS_TTL);
  res.json({ success: true, cached: false, data });
});

// @desc    Language popularity + per-language acceptance
// @route   GET /api/admin/language-stats
// @access  Admin
export const getLanguageStats = asyncHandler(async (req, res) => {
  const cacheKey = 'admin:langstats';
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ success: true, cached: true, data: cached });

  // WHY successRate is a computed field rather than $avg of `accuracy`:
  // `accuracy` on a submission is the fraction of THAT attempt's test cases
  // that passed, so averaging it gives "average partial progress", which is not
  // what an admin asking "which language do people actually solve in" wants.
  const studentIds = await User.distinct('_id', { role: 'student' });
  const userFilter = { userId: { $in: studentIds } };
  const [codingRows, debuggingRows, assessmentRows] = await Promise.all([CodingSubmission.aggregate([
    { $match: { ...userFilter, isRun: false } },
    {
      $group: {
        _id: '$language',
        submissions: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
        solvers: { $addToSet: '$userId' },
      },
    },
  ]), DebuggingSubmission.aggregate([
    { $match: { ...userFilter, isRun: false } },
    {
      $group: {
        _id: '$language',
        submissions: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
        solvers: { $addToSet: '$userId' },
      },
    },
  ]), AssessmentSubmission.aggregate([
    { $match: { ...userFilter, submitted: true } },
    { $unwind: '$answers' },
    {
      $group: {
        _id: '$answers.language',
        submissions: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ['$answers.status', 'accepted'] }, 1, 0] } },
        solvers: { $addToSet: '$userId' },
      },
    },
  ])]);
  const languageMap = new Map();
  [...codingRows, ...debuggingRows, ...assessmentRows].forEach((row) => {
    const language = String(row._id);
    const current = languageMap.get(language) || { _id: language, submissions: 0, accepted: 0, solvers: new Set() };
    current.submissions += row.submissions;
    current.accepted += row.accepted;
    row.solvers.forEach((solver) => current.solvers.add(String(solver)));
    languageMap.set(language, current);
  });
  const rows = [...languageMap.values()]
    .map((row) => ({
      _id: 0,
      language: row._id,
      submissions: row.submissions,
      accepted: row.accepted,
      uniqueSolvers: row.solvers.size,
      successRate: Math.round((row.accepted / Math.max(row.submissions, 1)) * 1000) / 10,
    }))
    .sort((a, b) => b.submissions - a.submissions);

  await setCache(cacheKey, rows, STATS_TTL);
  res.json({ success: true, cached: false, data: rows });
});

// @desc    All students with their coding stats
// @route   GET /api/admin/students
// @access  Admin
export const getStudents = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const filter = { role: 'student' };

  if (typeof search === 'string' && search.trim()) {
    // Escape the input before building a $regex: an unescaped search string is a
    // ReDoS vector and would also throw on invalid patterns like "a(". The old
    // code interpolated it raw.
    const safe = search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { college: { $regex: safe, $options: 'i' } },
    ];
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, students] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(parsedLimit)
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // Scoped to exactly the students on this page — one grouped aggregation, so
  // the endpoint stays at 2 DB calls total regardless of page size.
  const [scoped, assessmentRows] = students.length
    ? await Promise.all([
      studentCodingRollup(students.map((s) => s._id)),
      AssessmentSubmission.aggregate([
        { $match: { submitted: true, userId: { $in: students.map((s) => s._id) } } },
        {
          $group: {
            _id: '$userId',
            attempts: { $sum: 1 },
            acceptedSubmissions: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            bestScore: { $sum: '$score' },
            solvedQuestions: {
              $sum: {
                $size: {
                  $filter: {
                    input: '$answers',
                    as: 'answer',
                    cond: { $eq: ['$$answer.status', 'accepted'] },
                  },
                },
              },
            },
            lastActive: { $max: '$submittedAt' },
          },
        },
      ]),
    ])
    : [[], []];

  const statsMap = rollupByUserId(scoped);
  assessmentRows.forEach((row) => {
    const key = String(row._id);
    const existing = statsMap[key] || { ...EMPTY_CODING_STATS, solvedProblemIds: [] };
    statsMap[key] = {
      ...existing,
      attempts: existing.attempts + row.attempts,
      acceptedSubmissions: existing.acceptedSubmissions + row.acceptedSubmissions,
      bestScore: existing.bestScore + row.bestScore,
      problemsSolved: existing.problemsSolved + row.solvedQuestions,
      lastActive: !existing.lastActive || row.lastActive > existing.lastActive ? row.lastActive : existing.lastActive,
    };
  });

  const enriched = students.map((s) => ({
    ...s,
    // Named `codingStats` rather than the old `assessmentStats`: the client
    // renders these on the coding drill-down, and keeping the MCQ name would
    // imply an MCQ meaning that no longer exists.
    codingStats: statsMap[String(s._id)] || EMPTY_CODING_STATS,
  }));

  res.json({
    success: true,
    total,
    page: parsedPage,
    limit: parsedLimit,
    data: enriched,
  });
});

// @desc    Export students with coding stats as CSV
// @route   GET /api/admin/export-students
// @access  Admin
export const exportStudents = asyncHandler(async (req, res) => {
  // Pages through students so a large roster cannot spike memory.
  const PAGE_SIZE = 500;
  let page = 0;
  const allData = [];

  for (;;) {
    const students = await User.find({ role: 'student' })
      .select('-password')
      .lean()
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE);

    if (students.length === 0) break;

    const ids = students.map((s) => s._id);
    const rows = await studentCodingRollup(ids);
    const map = rollupByUserId(rows);

    students.forEach((s) => {
      const c = map[String(s._id)] || EMPTY_CODING_STATS;
      allData.push({
        Name: s.name,
        Email: s.email,
        College: s.college,
        RollNumber: s.rollNumber,
        ProblemsSolved: c.problemsSolved,
        Submissions: c.attempts,
        Accepted: c.acceptedSubmissions,
        BestScore: c.bestScore,
        LastActive: c.lastActive,
        JoinedAt: s.createdAt,
      });
    });

    page += 1;
  }

  const parser = new Parser();
  const csv = parser.parse(allData);
  res.header('Content-Type', 'text/csv');
  // Renamed from techiz_students.csv to match the SYNEXIA branding the rest of
  // the app was migrated to.
  res.attachment('synexia_students.csv');
  res.send(csv);
});

// @desc    Monthly coding submission trends
// @route   GET /api/admin/trends
// @access  Admin
export const getTrends = asyncHandler(async (req, res) => {
  const cacheKey = 'admin:trends';
  const cached = await getCache(cacheKey);
  if (cached) return res.json({ success: true, cached: true, data: cached });

  const studentIds = await User.distinct('_id', { role: 'student' });
  const userFilter = { userId: { $in: studentIds } };
  const [codingTrends, debuggingTrends, assessmentTrends] = await Promise.all([CodingSubmission.aggregate([
    { $match: { ...userFilter, isRun: false, submittedAt: { $type: 'date' } } },
    {
      $group: {
        _id: { year: { $year: '$submittedAt' }, month: { $month: '$submittedAt' } },
        submissions: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
        avgScore: { $avg: '$score' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id: 1,
        submissions: 1,
        accepted: 1,
        avgScore: { $round: ['$avgScore', 1] },
        acceptanceRate: {
          $round: [
            { $multiply: [{ $divide: ['$accepted', { $max: ['$submissions', 1] }] }, 100] },
            1,
          ],
        },
      },
    },
  ]), DebuggingSubmission.aggregate([
    { $match: { ...userFilter, isRun: false, submittedAt: { $type: 'date' } } },
    {
      $group: {
        _id: { year: { $year: '$submittedAt' }, month: { $month: '$submittedAt' } },
        submissions: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
        avgScore: { $avg: '$score' },
      },
    },
  ]), AssessmentSubmission.aggregate([
    { $match: { ...userFilter, submitted: true, submittedAt: { $type: 'date' } } },
    {
      $group: {
        _id: { year: { $year: '$submittedAt' }, month: { $month: '$submittedAt' } },
        submissions: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
        avgScore: { $avg: '$score' },
      },
    },
  ])]);

  const trendMap = new Map();
  [...codingTrends, ...debuggingTrends, ...assessmentTrends].forEach((row) => {
    const key = `${row._id.year}-${row._id.month}`;
    const current = trendMap.get(key) || { ...row, submissions: 0, accepted: 0, scoreTotal: 0 };
    current.scoreTotal += (row.avgScore || 0) * row.submissions;
    current.submissions += row.submissions;
    current.accepted += row.accepted;
    current.avgScore = current.submissions ? current.scoreTotal / current.submissions : 0;
    trendMap.set(key, current);
  });
  const trends = [...trendMap.values()]
    .sort((a, b) => a._id.year - b._id.year || a._id.month - b._id.month)
    .slice(-12)
    .map((row) => ({
      _id: row._id,
      submissions: row.submissions,
      accepted: row.accepted,
      avgScore: Math.round(row.avgScore * 10) / 10,
      acceptanceRate: Math.round((row.accepted / Math.max(row.submissions, 1)) * 1000) / 10,
    }));

  await setCache(cacheKey, trends, TRENDS_TTL);
  res.json({ success: true, cached: false, data: trends });
});

/**
 * @desc    A single student's coding submissions
 * @route   GET /api/admin/students/:studentId/submissions
 * @access  Admin
 *
 * WHY this is here rather than reusing /api/coding/admin/students/:studentId:
 * that endpoint returns an aggregate *report* (score, rank, per-problem status)
 * for the coding report view. This one returns the raw, paginated submission
 * rows so the admin can see the actual attempt history, which is the direct
 * replacement for the old "view assessments" modal.
 */
export const getStudentSubmissions = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { limit = 25, status } = req.query;

  const filter = { userId: studentId, isRun: false };
  if (typeof status === 'string' && status && status !== 'all') {
    filter.status = status;
  }

  const assessmentFilter = { userId: studentId, submitted: true };
  if (typeof status === 'string' && status && status !== 'all') assessmentFilter.status = status;
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const [student, codingTotal, assessmentTotal, codingSubmissions, assessmentSubmissions] = await Promise.all([
    User.findById(studentId).select('name email college rollNumber role').lean(),
    CodingSubmission.countDocuments(filter),
    AssessmentSubmission.countDocuments(assessmentFilter),
    CodingSubmission.find(filter)
      .populate('problemId', 'title slug difficulty points')
      // `code` is intentionally excluded: the admin drill-down shows the verdict
      // and score, and shipping every student's source to the admin table is an
      // unnecessary data exposure.
      .select('-code')
      .sort({ submittedAt: -1 })
      .limit(safeLimit)
      .lean(),
    AssessmentSubmission.find(assessmentFilter)
      .select('-answers.code -answers.testResults')
      .sort({ submittedAt: -1 })
      .limit(safeLimit)
      .lean(),
  ]);

  if (!student || student.role !== 'student') {
    res.status(404);
    throw new Error('Student not found');
  }

  const finalAssessmentRows = assessmentSubmissions.map((submission) => ({
    _id: submission._id,
    assessmentType: submission.assessmentType,
    problemId: { title: `${submission.assessmentType === 'debugging' ? 'Debugging' : 'Coding'} assessment (8 questions)` },
    language: new Set(submission.answers.map((answer) => answer.language)).size > 1
      ? 'Multiple languages'
      : submission.answers[0]?.language || '—',
    status: submission.status,
    passedCases: submission.passedCases,
    totalCases: submission.totalCases,
    score: submission.score,
    maxScore: submission.maxScore,
    assessmentReason: submission.reason === 'warning-limit' ? 'warning-limit' : 'normal',
    warningCount: submission.warningCount,
    warningEvents: submission.warningEvents,
    executionTime: submission.answers.reduce((sum, answer) => sum + answer.executionTime, 0),
    submittedAt: submission.submittedAt,
  }));
  const submissions = [...codingSubmissions, ...finalAssessmentRows]
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, safeLimit);
  res.json({ success: true, total: codingTotal + assessmentTotal, student, data: submissions });
});
