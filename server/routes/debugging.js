import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import { codeLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
  listDebuggingProblems, getDebuggingProblem, runDebuggingCode, submitDebuggingCode,
  getDebuggingProgress,
  listDebuggingAdminProblems, getDebuggingAdminProblem,
  createDebuggingProblem, updateDebuggingProblem, deleteDebuggingProblem,
} from '../controllers/debuggingController.js';
import {
  createDebuggingProblemSchema, updateDebuggingProblemSchema,
  runDebuggingCodeSchema, submitDebuggingCodeSchema, listDebuggingProblemsQuerySchema,
} from '../validators/debuggingValidators.js';
import { recordAssessmentWarningSchema, submitAssessmentSchema } from '../validators/assessmentValidators.js';
import {
  getMyAssessment, getMySavedAnswer, recordAssessmentWarning, startAssessment, submitAssessment,
} from '../controllers/assessmentController.js';

const router = express.Router();

const validateDebuggingQuery = (req, res, next) => {
  const { error, value } = listDebuggingProblemsQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map((detail) => detail.message.replace(/['"]/g, '')),
    });
  }
  req.debuggingQuery = value;
  return next();
};

router.get('/problems', protect, validateDebuggingQuery, listDebuggingProblems);
router.get('/problems/:slug', protect, getDebuggingProblem);
router.get('/stats/me/problems', protect, getDebuggingProgress);
router.post('/run', protect, codeLimiter, validate(runDebuggingCodeSchema), runDebuggingCode);
router.post('/submit', protect, codeLimiter, validate(submitDebuggingCodeSchema), submitDebuggingCode);
router.post('/assessment/start', protect, startAssessment('debugging'));
router.get('/assessment/me', protect, getMyAssessment('debugging'));
router.get('/problems/:slug/saved-answer', protect, getMySavedAnswer('debugging'));
router.post('/assessment/warning', protect, validate(recordAssessmentWarningSchema), recordAssessmentWarning('debugging'));
router.post('/assessment/submit', protect, codeLimiter, validate(submitAssessmentSchema), submitAssessment('debugging'));

router.get('/admin/problems', protect, adminOnly, listDebuggingAdminProblems);
router.get('/admin/problems/:id', protect, adminOnly, getDebuggingAdminProblem);
router.post('/admin/problems', protect, adminOnly, validate(createDebuggingProblemSchema), createDebuggingProblem);
router.put('/admin/problems/:id', protect, adminOnly, validate(updateDebuggingProblemSchema), updateDebuggingProblem);
router.delete('/admin/problems/:id', protect, adminOnly, deleteDebuggingProblem);

export default router;
