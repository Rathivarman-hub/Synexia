import mongoose from 'mongoose';
import CodingSubmission from '../models/CodingSubmission.js';
import DebuggingSubmission from '../models/DebuggingSubmission.js';
import User from '../models/User.js';

const scoredRowsPipeline = (userFilter = {}) => [
  {
    $set: {
      score: { $convert: { input: '$score', to: 'double', onError: 0, onNull: 0 } },
      maxScore: { $convert: { input: '$maxScore', to: 'double', onError: 0, onNull: 0 } },
      passedCases: { $convert: { input: '$passedCases', to: 'double', onError: 0, onNull: 0 } },
      totalCases: { $convert: { input: '$totalCases', to: 'double', onError: 0, onNull: 0 } },
    },
  },
  { $match: { ...userFilter, isRun: { $ne: true }, score: { $gte: 0 } } },
  {
    $unionWith: {
      coll: DebuggingSubmission.collection.name,
      pipeline: [
        {
          $set: {
            score: { $convert: { input: '$score', to: 'double', onError: 0, onNull: 0 } },
            maxScore: { $convert: { input: '$maxScore', to: 'double', onError: 0, onNull: 0 } },
            passedCases: { $convert: { input: '$passedCases', to: 'double', onError: 0, onNull: 0 } },
            totalCases: { $convert: { input: '$totalCases', to: 'double', onError: 0, onNull: 0 } },
          },
        },
        { $match: { ...userFilter, isRun: { $ne: true }, score: { $gte: 0 } } },
      ],
    },
  },
  {
    $unionWith: {
      coll: 'assessmentsubmissions',
      pipeline: [
        {
          $match: {
            ...userFilter,
            assessmentType: { $in: ['coding', 'debugging'] },
            submitted: true,
          },
        },
        { $unwind: '$answers' },
        {
          $set: {
            'answers.score': { $convert: { input: '$answers.score', to: 'double', onError: 0, onNull: 0 } },
            'answers.maxScore': { $convert: { input: '$answers.maxScore', to: 'double', onError: 0, onNull: 0 } },
            'answers.passedCases': { $convert: { input: '$answers.passedCases', to: 'double', onError: 0, onNull: 0 } },
            'answers.totalCases': { $convert: { input: '$answers.totalCases', to: 'double', onError: 0, onNull: 0 } },
          },
        },
        {
          $project: {
            userId: 1,
            problemId: '$answers.questionId',
            score: '$answers.score',
            maxScore: '$answers.maxScore',
            passedCases: '$answers.passedCases',
            totalCases: '$answers.totalCases',
            executionTime: '$answers.executionTime',
            submittedAt: 1,
          },
        },
      ],
    },
  },
];

const bestAttemptPipeline = (userFilter = {}) => [
  ...scoredRowsPipeline(userFilter),
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

const userTotalsPipeline = (userFilter = {}) => [
  ...bestAttemptPipeline(userFilter),
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

/** Top-N coding leaderboard. */
export const getCodingLeaderboard = async ({ limit = 50 } = {}) => {
  const [scoredRows, students] = await Promise.all([
    CodingSubmission.aggregate(userTotalsPipeline()),
    User.find({ role: 'student' }).select('name college avatar').sort({ _id: 1 }).lean(),
  ]);
  const scoreByUser = new Map(scoredRows.map((row) => [String(row.userId), row]));
  const rows = students.map((student) => {
    const stats = scoreByUser.get(String(student._id));
    return {
      userId: student._id,
      name: student.name,
      college: student.college || '',
      avatar: student.avatar || '',
      totalScore: stats?.totalScore || 0,
      totalPoints: stats?.totalScore || 0,
      problemsSolved: stats?.problemsSolved || 0,
      problemsAttempted: stats?.problemsAttempted || 0,
      accuracy: stats?.accuracy || 0,
      totalAttempts: stats?.totalAttempts || 0,
      lastActivity: stats?.lastActivity || null,
    };
  });
  rows.sort((a, b) =>
    b.totalScore - a.totalScore ||
    b.accuracy - a.accuracy ||
    b.problemsSolved - a.problemsSolved ||
    String(a.userId).localeCompare(String(b.userId))
  );

  return rows
    .slice(0, Math.min(1000000, Math.max(1, Math.floor(limit) || 50)))
    .map((row, i) => ({ ...row, rank: i + 1 }));
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
    ...userTotalsPipeline({ userId: oid }),
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

  const [ahead, totalStudents, studentsBefore, scoredStudentsBefore] = await Promise.all([
    CodingSubmission.aggregate([...userTotalsPipeline(), { $match: aheadPredicate }, { $count: 'ahead' }]),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', _id: { $lt: oid } }),
    CodingSubmission.aggregate([
      ...userTotalsPipeline(),
      { $match: { userId: { $lt: oid } } },
      { $count: 'count' },
    ]),
  ]);

  const boardSize = totalStudents;
  if (boardSize === 0) return EMPTY;

  const hasNoScore = stats.totalScore === 0 && stats.accuracy === 0 && stats.problemsSolved === 0;
  const unscoredStudentsBefore = hasNoScore
    ? Math.max(0, studentsBefore - (scoredStudentsBefore[0]?.count || 0))
    : 0;

  return {
    rank: (ahead[0]?.ahead || 0) + unscoredStudentsBefore + 1,
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
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        isRun: false,
        problemId: { $in: problemIds },
      },
    },
    {
      $unionWith: {
        coll: 'assessmentsubmissions',
        pipeline: [
          { $match: { userId: new mongoose.Types.ObjectId(String(userId)), assessmentType: 'coding', submitted: true } },
          { $unwind: '$answers' },
          { $match: { 'answers.questionId': { $in: problemIds } } },
          {
            $project: {
              problemId: '$answers.questionId',
              score: '$answers.score',
              maxScore: '$answers.maxScore',
              status: '$answers.status',
              submittedAt: 1,
            },
          },
        ],
      },
    },
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
