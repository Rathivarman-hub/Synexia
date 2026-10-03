import mongoose from 'mongoose';
import CodingSubmission from '../models/CodingSubmission.js';

const bestAttemptPipeline = () => [
  { $match: { isRun: false, score: { $gt: 0 } } },
  { $sort: { userId: 1, problemId: 1, score: -1, submittedAt: -1 } },
  {
    $group: {
      _id: { userId: '$userId', problemId: '$problemId' },
      score: { $first: '$score' },
      maxScore: { $first: '$maxScore' },
      passedCases: { $first: '$passedCases' },
      totalCases: { $first: '$totalCases' },
      executionTime: { $first: '$executionTime' },
      submittedAt: { $first: '$submittedAt' },
      // SUM over the per-problem rows gives us the submission count without a
      // second pass over the collection.
      attempts: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      userId: '$_id.userId',
      problemId: '$_id.problemId',
      score: 1,
      maxScore: 1,
      passedCases: 1,
      totalCases: 1,
      executionTime: 1,
      submittedAt: 1,
      attempts: 1,
    },
  },
];

const userTotalsPipeline = () => [
  ...bestAttemptPipeline(),
  {
    $group: {
      _id: '$userId',
      totalScore: { $sum: '$score' },
      problemsSolved: { $sum: { $cond: [{ $eq: ['$score', '$maxScore'] }, 1, 0] } },
      problemsAttempted: { $sum: 1 },
      passedCases: { $sum: '$passedCases' },
      totalCases: { $sum: '$totalCases' },
      totalAttempts: { $sum: '$attempts' },
      lastActivity: { $max: '$submittedAt' },
    },
  },
  {
    $project: {
      _id: 0,
      userId: '$_id',
      totalScore: 1,
      problemsSolved: 1,
      problemsAttempted: 1,
      passedCases: 1,
      totalCases: 1,
      totalAttempts: 1,
      lastActivity: 1,
      accuracy: {
        $cond: [
          { $gt: ['$totalCases', 0] },
          {
            $round: [
              { $multiply: [{ $divide: ['$passedCases', '$totalCases'] }, 100] },
              1,
            ],
          },
          0,
        ],
      },
    },
  },
];

const withUserDetails = () => [
  {
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'user',
      // WHY: projection on the lookup. The users collection holds a bcrypt hash;
      // pulling the whole document to discard 4 fields wastes bandwidth on a
      // hot, paginated endpoint.
      pipeline: [{ $project: { name: 1, college: 1, avatar: 1, role: 1 } }],
    },
  },
  { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  { $match: { 'user.role': 'student' } },
  {
    $project: {
      _id: 0,
      userId: 1,
      name: { $ifNull: ['$user.name', 'Deleted user'] },
      college: { $ifNull: ['$user.college', ''] },
      avatar: { $ifNull: ['$user.avatar', ''] },
      totalScore: 1,
      problemsSolved: 1,
      problemsAttempted: 1,
      accuracy: 1,
      totalAttempts: 1,
      lastActivity: 1,
    },
  },
];

/** Top-N coding leaderboard. */
export const getCodingLeaderboard = async ({ limit = 50 } = {}) => {
  const rows = await CodingSubmission.aggregate([
    ...userTotalsPipeline(),
    ...withUserDetails(),
    // Tie-break on userId for a deterministic order — without it two users with
    // identical scores can swap ranks between requests and look like a bug.
    { $sort: { totalScore: -1, accuracy: -1, problemsSolved: -1, userId: 1 } },
    { $limit: Math.min(1000000, Math.max(1, Math.floor(limit) || 50)) },
  ]);

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
};

/**
 * Rank of ONE user without materialising the whole board.
 *
 * WHY not `board.findIndex(...)`: the existing /api/leaderboard controller
 * already documents this exact memory hazard. We count how many users sort ahead
 * of the target instead — a single indexed count regardless of board size.
 */
export const getCodingRank = async (userId) => {
  const oid = new mongoose.Types.ObjectId(String(userId));

  // Step 1 — resolve MY aggregates. This has to finish before step 2, because
  // the "who is ahead of me" predicate is built from these exact values.
  const mine = await CodingSubmission.aggregate([
    { $match: { userId: oid, isRun: false, score: { $gt: 0 } } },
    ...userTotalsPipeline().slice(1),
  ]);

  const stats = mine[0] || {
    totalScore: 0,
    problemsSolved: 0,
    totalAttempts: 0,
    accuracy: 0,
  };

  const EMPTY = {
    rank: null,
    total: 0,
    totalScore: stats.totalScore,
    problemsSolved: stats.problemsSolved,
    totalAttempts: stats.totalAttempts,
    accuracy: stats.accuracy,
  };

  // Step 2 — count the users that sort strictly ahead of me, then the board size.
  // The predicate mirrors the $sort in getCodingLeaderboard EXACTLY; if the two
  // ever diverge, ranks and displayed order would disagree.
  const aheadPredicate = {
    $or: [
      { totalScore: { $gt: stats.totalScore } },
      { totalScore: stats.totalScore, accuracy: { $gt: stats.accuracy } },
      { totalScore: stats.totalScore, accuracy: stats.accuracy, problemsSolved: { $gt: stats.problemsSolved } },
      { totalScore: stats.totalScore, accuracy: stats.accuracy, problemsSolved: stats.problemsSolved, userId: { $lt: oid } },
    ],
  };

  const [ahead, total] = await Promise.all([
    CodingSubmission.aggregate([...userTotalsPipeline(), { $match: aheadPredicate }, { $count: 'ahead' }]),
    CodingSubmission.aggregate([...userTotalsPipeline(), { $count: 'total' }]),
  ]);

  const boardSize = total[0]?.total || 0;
  if (boardSize === 0) return EMPTY;

  return {
    rank: (ahead[0]?.ahead || 0) + 1,
    total: boardSize,
    totalScore: stats.totalScore,
    problemsSolved: stats.problemsSolved,
    totalAttempts: stats.totalAttempts,
    accuracy: stats.accuracy,
  };
};

/** Per-user status map for the problems table (`solved` / `attempted` / `none`). */
export const getUserProblemStatusMap = async (userId, problemIds) => {
  if (!problemIds.length) return {};
  const rows = await CodingSubmission.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), isRun: false, problemId: { $in: problemIds } } },
    {
      $group: {
        _id: '$problemId',
        bestScore: { $max: '$score' },
        maxScore: { $max: '$maxScore' },
        totalAttempts: { $sum: 1 },
        lastAttemptAt: { $max: '$submittedAt' },
        // A problem is only "solved" if some submission hit full marks.
        accepted: { $max: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    const solved = row.accepted === 1;
    acc[String(row._id)] = {
      status: solved ? 'solved' : 'attempted',
      solved,
      bestScore: row.bestScore || 0,
      maxScore: row.maxScore || 0,
      totalAttempts: row.totalAttempts || 0,
      lastAttemptAt: row.lastAttemptAt,
    };
    return acc;
  }, {});
};

export default { getCodingLeaderboard, getCodingRank, getUserProblemStatusMap };
