import express from 'express';
const router = express.Router();

import { protect, adminOnly } from '../middleware/auth.js';
import { getCodingBoard, getMyCodingRank } from '../controllers/codingLeaderboardController.js';

/**
 * SYNEXIA - /api/leaderboard
 *
 * WHY this file still exists after the MCQ module was removed:
 * /api/leaderboard is a legacy URL used by existing admin links and integrations.
 *
 * It remains an admin-only alias of /api/coding/leaderboard. Both controllers are
 * the same handlers, so there is no second implementation to keep in sync.
 *
 * The response shape is the coding one: rank, totalScore, problemsSolved,
 * accuracy. If you ever want to retire the old path, delete this file and its
 * single mount in server.js — nothing else references it.
 */
router.get('/', protect, adminOnly, getCodingBoard);

// Legacy rank URL remains available to admins only.
router.get('/my-rank', protect, adminOnly, getMyCodingRank);

export default router;
