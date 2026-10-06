import mongoose from 'mongoose';
import { SUBMISSION_STATUSES } from './CodingSubmission.js';
import { LANGUAGE_KEYS } from '../config/languages.js';

const debuggingSubmissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'DebuggingProblem', required: true, index: true },
    language: { type: String, required: true, enum: LANGUAGE_KEYS },
    code: { type: String, required: true, maxlength: 20000 },
    status: { type: String, enum: SUBMISSION_STATUSES, required: true },
    passedCases: { type: Number, default: 0, min: 0 },
    failedCases: { type: Number, default: 0, min: 0 },
    totalCases: { type: Number, default: 0, min: 0 },
    accuracy: { type: Number, default: 0, min: 0, max: 100 },
    score: { type: Number, default: 0, min: 0 },
    maxScore: { type: Number, default: 0, min: 0 },
    executionTime: { type: Number, default: 0, min: 0 },
    memoryUsageKB: { type: Number, default: 0, min: 0 },
    testResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    output: { type: String, default: '' },
    error: { type: String, default: '' },
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

debuggingSubmissionSchema.index({ userId: 1, problemId: 1, isRun: 1, submittedAt: -1 });
debuggingSubmissionSchema.index({ userId: 1, submittedAt: -1 });
debuggingSubmissionSchema.index(
  { userId: 1, problemId: 1, isRun: 1 },
  { unique: true, partialFilterExpression: { isRun: false } }
);

const DebuggingSubmission = mongoose.model('DebuggingSubmission', debuggingSubmissionSchema);
export default DebuggingSubmission;
