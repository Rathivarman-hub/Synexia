import express from 'express';
const router = express.Router();

import { protect, adminOnly } from '../middleware/auth.js';
import { codeLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { getProblems, getProblem, getStarterCode } from '../controllers/codingProblemController.js';
import {
  runCode, submitCode, getMySubmissions, getSubmission, getMyCodingStats,
  getMyProblemProgress, getExecutionStatusRoute,
} from '../controllers/codingSubmissionController.js';
import {
  getCodingBoard, getMyCodingRank, getStudentCodingReport, exportCodingLeaderboard, flushCodingCache,
} from '../controllers/codingLeaderboardController.js';
import { runCodeSchema, submitCodeSchema } from '../validators/codingValidators.js';
import { submitAssessmentSchema } from '../validators/assessmentValidators.js';
import {
  getMyAssessment, recordAssessmentWarning, startAssessment, submitAssessment,
} from '../controllers/assessmentController.js';
import { recordAssessmentWarningSchema } from '../validators/assessmentValidators.js';

// ─── Public catalogue (any authenticated user) ────────────────────────────────
router.get('/problems', protect, getProblems);
router.get('/problems/:slug', protect, getProblem);
router.get('/problems/:slug/starter', protect, getStarterCode);

// ─── Student execution ────────────────────────────────────────────────────────
// WHY codeLimiter sits here and not in server.js: run/submit are the only
// endpoints that consume paid sandbox quota, so they get their own budget
// (30/min per USER, not per IP — a campus NAT would otherwise lock out an
// entire lab) instead of being folded into the general 200/min IP limit.
router.post('/run', protect, codeLimiter, validate(runCodeSchema), runCode);
router.post('/submit', protect, codeLimiter, validate(submitCodeSchema), submitCode);
router.post('/assessment/start', protect, startAssessment('coding'));
router.get('/assessment/me', protect, getMyAssessment('coding'));
router.post('/assessment/warning', protect, validate(recordAssessmentWarningSchema), recordAssessmentWarning('coding'));
router.post('/assessment/submit', protect, codeLimiter, validate(submitAssessmentSchema), submitAssessment('coding'));

router.get('/submissions/me', protect, getMySubmissions);
router.get('/submissions/:id', protect, getSubmission);

router.get('/stats/me', protect, getMyCodingStats);
router.get('/stats/me/problems', protect, getMyProblemProgress);
router.get('/execution-status', protect, getExecutionStatusRoute);

router.get('/leaderboard', protect, getCodingBoard);
router.get('/leaderboard/me', protect, getMyCodingRank);

// ─── Admin leaderboard reporting ──────────────────────────────────────────────
router.get('/admin/students/:studentId', protect, adminOnly, getStudentCodingReport);
router.get('/admin/leaderboard/export', protect, adminOnly, exportCodingLeaderboard);
router.post('/admin/cache/flush', protect, adminOnly, flushCodingCache);

export default router;
