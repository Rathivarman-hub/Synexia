import CodingProblem from '../models/CodingProblem.js';
import DebuggingProblem from '../models/DebuggingProblem.js';
import CodingSubmission from '../models/CodingSubmission.js';
import DebuggingSubmission from '../models/DebuggingSubmission.js';
import AssessmentSubmission from '../models/AssessmentSubmission.js';
import { normalizeQuestionIdentity } from './questionCatalogueStats.js';

const submissionRollup = (Model, userIds) => Model.aggregate([
  { $match: { userId: { $in: userIds }, isRun: false } },
  {
    $group: {
      _id: { userId: '$userId', problemId: '$problemId' },
      attempts: { $sum: 1 },
      acceptedQuestionAttempts: {
        $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
      },
      solved: { $max: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
      bestScore: {
        $max: {
          $cond: [
            { $gt: ['$maxScore', 0] },
            { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] },
            0,
          ],
        },
      },
      lastActive: { $max: '$submittedAt' },
    },
  },
  {
    $project: {
      userId: '$_id.userId',
      problemId: '$_id.problemId',
      attempts: 1,
      acceptedQuestionAttempts: 1,
      solved: 1,
      bestScore: 1,
      lastActive: 1,
    },
  },
]);

const assessmentQuestionRollup = (userIds) => AssessmentSubmission.aggregate([
  { $match: { userId: { $in: userIds }, submitted: true } },
  { $unwind: '$answers' },
  {
    $group: {
      _id: { userId: '$userId', problemId: '$answers.questionId' },
      questionAttempts: { $sum: 1 },
      acceptedQuestionAttempts: {
        $sum: { $cond: [{ $eq: ['$answers.status', 'accepted'] }, 1, 0] },
      },
      solved: { $max: { $cond: [{ $eq: ['$answers.status', 'accepted'] }, 1, 0] } },
      lastActive: { $max: '$submittedAt' },
    },
  },
  {
    $project: {
      userId: '$_id.userId',
      problemId: '$_id.problemId',
      questionAttempts: 1,
      acceptedQuestionAttempts: 1,
      solved: 1,
      lastActive: 1,
    },
  },
]);

const assessmentSubmissionRollup = (userIds) => AssessmentSubmission.aggregate([
  { $match: { userId: { $in: userIds }, submitted: true } },
  {
    $group: {
      _id: '$userId',
      attempts: { $sum: 1 },
      bestScore: {
        $max: {
          $cond: [
            { $gt: ['$maxScore', 0] },
            { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] },
            0,
          ],
        },
      },
      lastActive: { $max: '$submittedAt' },
    },
  },
]);

export const mergeStudentActivity = ({
  codingRows = [],
  debuggingRows = [],
  assessmentQuestionRows = [],
  assessmentSubmissionRows = [],
  questionIdentityById = new Map(),
}) => {
  const users = new Map();
  const ensureUser = (userId) => {
    const key = String(userId);
    if (!users.has(key)) {
      users.set(key, {
        attempts: 0,
        questionAttempts: 0,
        acceptedQuestionAttempts: 0,
        bestScore: 0,
        lastActive: null,
        solvedQuestionIdentities: new Set(),
      });
    }
    return users.get(key);
  };

  const addQuestionRows = (rows, isAssessment = false) => {
    rows.forEach((row) => {
      const user = ensureUser(row.userId);
      const questionId = row.problemId ?? row._id?.problemId;
      const identity = questionIdentityById.get(String(questionId)) || `question:${questionId}`;
      const questionAttempts = row.questionAttempts ?? row.attempts ?? 0;
      user.questionAttempts += questionAttempts;
      user.acceptedQuestionAttempts += row.acceptedQuestionAttempts || 0;
      if (row.solved) user.solvedQuestionIdentities.add(identity);
      user.bestScore = Math.max(user.bestScore, row.bestScore || 0);
      if (!isAssessment) user.attempts += row.attempts || 0;
      if (row.lastActive && (!user.lastActive || row.lastActive > user.lastActive)) {
        user.lastActive = row.lastActive;
      }
    });
  };

  addQuestionRows(codingRows);
  addQuestionRows(debuggingRows);
  addQuestionRows(assessmentQuestionRows, true);

  assessmentSubmissionRows.forEach((row) => {
    const user = ensureUser(row._id);
    user.attempts += row.attempts || 0;
    user.bestScore = Math.max(user.bestScore, row.bestScore || 0);
    if (row.lastActive && (!user.lastActive || row.lastActive > user.lastActive)) {
      user.lastActive = row.lastActive;
    }
  });

  return Object.fromEntries([...users].map(([userId, user]) => [userId, {
    attempts: user.attempts,
    questionAttempts: user.questionAttempts,
    acceptedQuestionAttempts: user.acceptedQuestionAttempts,
    problemsSolved: user.solvedQuestionIdentities.size,
    bestScore: user.bestScore,
    lastActive: user.lastActive,
  }]));
};

export const getStudentActivityStats = async (userIds) => {
  if (userIds.length === 0) return {};

  const [
    codingRows,
    debuggingRows,
    assessmentQuestionRows,
    assessmentSubmissionRows,
    codingProblems,
    debuggingProblems,
  ] = await Promise.all([
    submissionRollup(CodingSubmission, userIds),
    submissionRollup(DebuggingSubmission, userIds),
    assessmentQuestionRollup(userIds),
    assessmentSubmissionRollup(userIds),
    CodingProblem.find().select('_id statement').lean(),
    DebuggingProblem.find().select('_id description').lean(),
  ]);
  const questionIdentityById = new Map();
  codingProblems.forEach((problem) => {
    questionIdentityById.set(String(problem._id), normalizeQuestionIdentity(problem.statement));
  });
  debuggingProblems.forEach((problem) => {
    questionIdentityById.set(String(problem._id), normalizeQuestionIdentity(problem.description));
  });

  return mergeStudentActivity({
    codingRows,
    debuggingRows,
    assessmentQuestionRows,
    assessmentSubmissionRows,
    questionIdentityById,
  });
};
