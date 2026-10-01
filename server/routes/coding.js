import express from 'express';
const router = express.Router();

import { protect, adminOnly } from '../middleware/auth.js';
import { codeLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  getProblems, getProblem, getStarterCode, createProblem, updateProblem,
  deleteProblem, addTestCases, getCodingAdminStats,
} from '../controllers/codingProblemController.js';
import {
  runCode, submitCode, getMySubmissions, getSubmission, getMyCodingStats,
  getMyProblemProgress, getExecutionStatusRoute,
} from '../controllers/codingSubmissionController.js';
import {
  getCodingBoard, getMyCodingRank, getStudentCodingReport, exportCodingLeaderboard, flushCodingCache,
} from '../controllers/codingLeaderboardController.js';
import {
  createCodingProblemSchema, updateCodingProblemSchema, addTestCasesSchema,
  runCodeSchema, submitCodeSchema,
} from '../validators/codingValidators.js';

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

router.get('/submissions/me', protect, getMySubmissions);
router.get('/submissions/:id', protect, getSubmission);

router.get('/stats/me', protect, getMyCodingStats);
router.get('/stats/me/problems', protect, getMyProblemProgress);
router.get('/execution-status', protect, getExecutionStatusRoute);

router.get('/leaderboard', protect, adminOnly, getCodingBoard);
router.get('/leaderboard/me', protect, adminOnly, getMyCodingRank);

// ─── Admin management ─────────────────────────────────────────────────────────
// WHY: mounted AFTER the public routes above. `/:slug` would otherwise shadow
// these and an admin POST to /admin/stats would be parsed as a slug lookup.
router.get('/admin/stats', protect, adminOnly, getCodingAdminStats);
router.get('/admin/students/:studentId', protect, adminOnly, getStudentCodingReport);
router.get('/admin/leaderboard/export', protect, adminOnly, exportCodingLeaderboard);
router.post('/admin/cache/flush', protect, adminOnly, flushCodingCache);

router.route('/admin/problems')
  .post(protect, adminOnly, validate(createCodingProblemSchema), createProblem);

router.route('/admin/problems/:id')
  .put(protect, adminOnly, validate(updateCodingProblemSchema), updateProblem)
  .delete(protect, adminOnly, deleteProblem);

router.post(
  '/admin/problems/:id/test-cases',
  protect,
  adminOnly,
  validate(addTestCasesSchema),
  addTestCases
);

export default router;
