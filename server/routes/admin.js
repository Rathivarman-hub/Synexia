import express from 'express';
const router = express.Router();

import { protect, adminOnly } from '../middleware/auth.js';
import {
  getStats,
  getLanguageStats,
  getStudents,
  exportStudents,
  getTrends,
  getStudentSubmissions,
  deleteStudents,
} from '../controllers/adminController.js';
import { validate } from '../middleware/validate.js';
import { deleteStudentsSchema } from '../validators/adminValidators.js';

router.use(protect, adminOnly);

// Platform + coding stats. All figures come from the CodingProblem /
// CodingSubmission collections; the MCQ equivalents are gone.
router.get('/stats', getStats);
router.get('/language-stats', getLanguageStats);
router.get('/trends', getTrends);

// User management (kept feature).
router.get('/students', getStudents);
router.get('/export-students', exportStudents);
router.delete('/students', validate(deleteStudentsSchema), deleteStudents);

// Per-student coding attempt history. Replaces the old
// GET /students/:id/assessments, which read the deleted Assessment collection.
router.get('/students/:studentId/submissions', getStudentSubmissions);

// NOTE: the old PUT /assessment/:assessmentId/marks endpoint is intentionally
// absent. It let an admin overwrite a graded MCQ score. Coding scores are
// computed by the grader from the sandbox verdict, so there is no hand-editable
// mark to update — an admin who needs to correct one should delete/re-publish
// the problem instead, which is auditable through the coding admin routes.

export default router;
