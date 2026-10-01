import mongoose from 'mongoose';

export const SUBMISSION_STATUSES = [
  'accepted',
  'partial',
  'wrong-answer',
  'runtime-error',
  'compile-error',
  'time-limit-exceeded',
  'internal-error',
];

const codingSubmissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingProblem', required: true, index: true },

    language: {
      type: String,
      required: true,
      enum: ['python', 'java', 'javascript', 'c', 'cpp', 'csharp', 'go'],
    },
    // WHY: the full source is persisted (not just on accepted runs) so a student
    // can reopen "My Submissions" and iterate on a failing attempt, and so an
    // admin can review cheaters. Capped at 20 000 chars — beyond that the
    // provider would reject it anyway.
    code: { type: String, required: true, maxlength: 20000 },

    status: { type: String, enum: SUBMISSION_STATUSES, required: true },
    passedCases: { type: Number, default: 0, min: 0 },
    failedCases: { type: Number, default: 0, min: 0 },
    totalCases: { type: Number, default: 0, min: 0 },
    // WHY: percentage of test cases passed, stored directly. The leaderboard
    // ranks on accuracy across thousands of rows; recomputing a ratio per row
    // inside the aggregation is avoidable work.
    accuracy: { type: Number, default: 0 },

    score: { type: Number, default: 0, min: 0 },
    maxScore: { type: Number, default: 0, min: 0 },

    // Wall-clock ms reported by the execution provider.
    executionTime: { type: Number, default: 0 },
    memoryUsageKB: { type: Number, default: 0, min: 0 },
    testResults: {
      type: [{
        index: { type: Number, required: true },
        hidden: { type: Boolean, default: false },
        passed: { type: Boolean, required: true },
        status: { type: String, required: true },
        input: { type: String, default: null },
        expectedOutput: { type: String, default: null },
        output: { type: String, default: null },
        error: { type: String, default: null },
        executionTime: { type: Number, default: 0 },
        memoryUsageKB: { type: Number, default: 0 },
      }],
      default: [],
    },
    // Truncated stdout/stderr for the console panel. Full output is never kept —
    // a runaway print loop would otherwise bloat the collection.
    output: { type: String, default: '' },
    error: { type: String, default: '' },

    // WHY: "Run" and "Submit" share this collection so the user sees one
    // unified history, but they must be separable — runs must not inflate
    // acceptance rate or the leaderboard.
    isRun: { type: Boolean, default: false, index: true },

    assessmentReason: { type: String, enum: ['normal', 'warning-limit'], default: 'normal', index: true },
    warningCount: { type: Number, default: 0, min: 0, max: 3 },
    warningEvents: {
      type: [{ type: { type: String, required: true }, occurredAt: { type: Date, required: true } }],
      default: [],
    },
    elapsedSeconds: { type: Number, default: 0, min: 0 },

    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
codingSubmissionSchema.virtual('isAccepted').get(function () {
  return this.status === 'accepted';
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
// WHY #1: the single most important read is "best submission per (user, problem)"
// for the leaderboard and the per-row Status column. Sorting by score DESC
// inside the group means the pipeline can stop at the first document per group.
codingSubmissionSchema.index({ userId: 1, problemId: 1, submittedAt: -1 });
codingSubmissionSchema.index({ userId: 1, problemId: 1, score: -1, submittedAt: -1 });

// WHY #2: per-problem acceptance rate aggregation and admin analytics.
codingSubmissionSchema.index({ problemId: 1, isRun: 1, status: 1, submittedAt: -1 });

// WHY #3: "Recent Submissions" on the dashboard — bounded desc scan, no filter.
codingSubmissionSchema.index({ userId: 1, submittedAt: -1 });

// WHY #4: leaderboard top-N by total score. The pipeline groups by userId then
// sorts the small result set, so this mostly serves the rank-count query.
codingSubmissionSchema.index({ userId: 1, score: -1 });

export const CodingSubmission = mongoose.model('CodingSubmission', codingSubmissionSchema);
export default CodingSubmission;
