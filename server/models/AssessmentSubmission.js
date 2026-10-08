import mongoose from 'mongoose';
import { LANGUAGE_KEYS } from '../config/languages.js';
import { SUBMISSION_STATUSES } from './CodingSubmission.js';

const assessmentAnswerSchema = new mongoose.Schema(
  {
    problemId: { type: mongoose.Schema.Types.ObjectId },
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    language: { type: String, enum: LANGUAGE_KEYS, required: true },
    code: {
      type: String,
      default: '',
      maxlength: 20000,
      validate: {
        validator: (value) => typeof value === 'string',
        message: 'Answer code must be a string.',
      },
    },
    codeByLanguage: {
      type: Map,
      of: { type: String, maxlength: 20000 },
      default: {},
    },
    status: { type: String, enum: SUBMISSION_STATUSES, required: true },
    accepted: { type: Boolean, default: false },
    passedTests: { type: Number, default: 0, min: 0 },
    totalTests: { type: Number, default: 0, min: 0 },
    awardedPoints: { type: Number, default: 0, min: 0 },
    passedCases: { type: Number, default: 0, min: 0 },
    failedCases: { type: Number, default: 0, min: 0 },
    totalCases: { type: Number, default: 0, min: 0 },
    accuracy: { type: Number, default: 0, min: 0, max: 100 },
    score: { type: Number, default: 0, min: 0 },
    maxScore: { type: Number, default: 0, min: 0 },
    executionTime: { type: Number, default: 0, min: 0 },
    testResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const warningEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    occurredAt: { type: Date, required: true },
  },
  { _id: false }
);

const assessmentSubmissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessmentType: { type: String, enum: ['coding', 'debugging'], required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentSession', required: true, unique: true },
    answers: {
      type: [assessmentAnswerSchema],
      validate: {
        validator: (answers) => answers.length === 8,
        message: 'A final assessment must contain exactly 8 answers.',
      },
      required: true,
    },
    status: { type: String, enum: SUBMISSION_STATUSES, required: true },
    score: { type: Number, default: 0, min: 0 },
    maxScore: { type: Number, default: 0, min: 0 },
    passedCases: { type: Number, default: 0, min: 0 },
    totalCases: { type: Number, default: 0, min: 0 },
    warningCount: { type: Number, default: 0, min: 0, max: 3 },
    warningEvents: { type: [warningEventSchema], default: [] },
    elapsedSeconds: { type: Number, default: 0, min: 0 },
    reason: { type: String, enum: ['manual-submit', 'warning-limit', 'time-limit'], required: true },
    submitted: { type: Boolean, default: true, immutable: true },
    locked: { type: Boolean, default: true, immutable: true },
    submittedAt: { type: Date, default: Date.now, immutable: true, index: true },
  },
  { timestamps: true }
);

assessmentSubmissionSchema.index({ userId: 1, assessmentType: 1 }, { unique: true });

export default mongoose.model('AssessmentSubmission', assessmentSubmissionSchema);
