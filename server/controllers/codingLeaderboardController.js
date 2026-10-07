import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { Parser } from 'json2csv';
import CodingProblem from '../models/CodingProblem.js';
import DebuggingProblem from '../models/DebuggingProblem.js';
import CodingSubmission from '../models/CodingSubmission.js';
import { getCodingLeaderboard, getCodingRank } from '../services/codingLeaderboardService.js';
import { getCache, setCache, deleteCachePattern } from '../utils/cache.js';

const LEADERBOARD_TTL = 60;
const RANK_TTL = 30;

/**
 * @desc    Combined coding and debugging leaderboard
 * @route   GET /api/coding/leaderboard
 * @access  Authenticated
 */
export const getCodingBoard = asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const cacheKey = `coding:leaderboard:students:v5:${limit}`;

  const cached = await getCache(cacheKey);
  if (cached) {
    res.json({
      success: true,
      cached: true,
      total: cached.total,
      totalProblems: cached.totalProblems,
      data: cached.data,
    });
    return;
  }

  const [rows, codingProblems, debuggingProblems] = await Promise.all([
    getCodingLeaderboard({ limit }),
    CodingProblem.countDocuments({ isActive: true }),
    DebuggingProblem.countDocuments({ isActive: true }),
  ]);
  const totalProblems = codingProblems + debuggingProblems;

  const payload = { total: rows.length, totalProblems, data: rows };
  await setCache(cacheKey, payload, LEADERBOARD_TTL);

  res.json({ success: true, cached: false, ...payload });
});

/** Export the complete student leaderboard as CSV. */
export const exportCodingLeaderboard = asyncHandler(async (_req, res) => {
  const rows = await getCodingLeaderboard({ limit: 1000000 });
  const fields = [
    { label: 'Rank', value: 'rank' },
    { label: 'Student', value: 'name' },
    { label: 'College', value: 'college' },
    { label: 'Points', value: 'totalPoints' },
    { label: 'Solved', value: 'problemsSolved' },
    { label: 'Attempted', value: 'problemsAttempted' },
    { label: 'Accuracy', value: 'accuracy' },
    { label: 'Last Active', value: 'lastActivity' },
  ];
  const csv = new Parser({ fields }).parse(rows);

  res.header('Content-Type', 'text/csv');
  res.attachment('synexia_leaderboard.csv');
  res.send(csv);
});

/**
 * @desc    The current user's coding rank
 * @route   GET /api/coding/leaderboard/me
 * @access  Authenticated
 */
export const getMyCodingRank = asyncHandler(async (req, res) => {
  const cacheKey = `coding:rank:${req.user._id}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    res.json({ success: true, cached: true, data: cached });
    return;
  }

  const data = await getCodingRank(req.user._id);
  await setCache(cacheKey, data, RANK_TTL);

  res.json({ success: true, cached: false, data });
});

/**
 * @desc    Admin view of a single student's coding activity
 * @route   GET /api/coding/admin/students/:studentId
 * @access  Admin
 */
export const getStudentCodingReport = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const rank = await getCodingRank(studentId);

  // WHY Promise.all: these are three independent reads. The report page shows
  // all three at once, so serialising them would triple the perceived latency
  // for no benefit.
  const [recent, perProblem] = await Promise.all([
    CodingSubmission.find({ userId: studentId, isRun: false })
      .populate('problemId', 'title slug difficulty points')
      .select('-code -output -error')
      .sort({ submittedAt: -1 })
      .limit(20)
      .lean(),
    CodingSubmission.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(studentId)), isRun: false } },
      // Sort by score desc so $group $first is the student's best attempt.
      { $sort: { score: -1, submittedAt: -1 } },
      {
        $group: {
          _id: '$problemId',
          bestScore: { $first: '$score' },
          maxScore: { $first: '$maxScore' },
          attempts: { $sum: 1 },
          lastAttemptAt: { $first: '$submittedAt' },
        },
      },
      { $lookup: { from: 'codingproblems', localField: '_id', foreignField: '_id', as: 'problem' } },
      { $unwind: { path: '$problem', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          problemId: '$_id',
          title: { $ifNull: ['$problem.title', 'Deleted problem'] },
          slug: { $ifNull: ['$problem.slug', ''] },
          difficulty: { $ifNull: ['$problem.difficulty', 'unknown'] },
          bestScore: 1,
          maxScore: 1,
          attempts: 1,
          lastAttemptAt: 1,
          solved: { $eq: ['$bestScore', '$maxScore'] },
        },
      },
    ]),
  ]);

  res.json({ success: true, data: { ...rank, recentSubmissions: recent, perProblem } });
});

/**
 * @desc    Force-invalidate every coding cache (admin troubleshooting)
 * @route   POST /api/coding/admin/cache/flush
 * @access  Admin
 */
export const flushCodingCache = asyncHandler(async (req, res) => {
  await Promise.all([
    deleteCachePattern('coding:*'),
  ]);
  res.json({ success: true, message: 'Coding cache flushed' });
});
