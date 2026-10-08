import mongoose from 'mongoose';
import { LANGUAGE_KEYS } from '../config/languages.js';

const assessmentSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessmentType: { type: String, enum: ['coding', 'debugging'], required: true },
    questionIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, required: true }],
      validate: {
        validator: (questions) => questions.length === 8,
        message: 'An assessment must contain exactly 8 questions.',
      },
      required: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['in-progress', 'finalizing', 'submitted'], default: 'in-progress', required: true },
    active: { type: Boolean, default: true, required: true },
    warningCount: { type: Number, default: 0, min: 0, max: 3 },
    warningEvents: {
      type: [{
        _id: false,
        type: { type: String, required: true },
        occurredAt: { type: Date, required: true },
      }],
      default: [],
    },
    drafts: {
      type: [{
        _id: false,
        problemId: { type: mongoose.Schema.Types.ObjectId, required: true },
        questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        language: { type: String, enum: LANGUAGE_KEYS, required: true },
        sourceCode: { type: String, maxlength: 20000, required: true },
        lastSavedAt: { type: Date, required: true },
      }],
      default: [],
    },
    evaluations: {
      type: [{
        _id: false,
        problemId: { type: mongoose.Schema.Types.ObjectId },
        questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        language: { type: String, enum: LANGUAGE_KEYS, required: true },
        code: { type: String, maxlength: 20000, required: true },
        status: { type: String, required: true },
        passedTests: { type: Number, min: 0, required: true },
        totalTests: { type: Number, min: 0, required: true },
        accepted: { type: Boolean, required: true },
        awardedPoints: { type: Number, min: 0, required: true },
        evaluatedAt: { type: Date, required: true },
      }],
      default: [],
    },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

assessmentSessionSchema.index(
  { userId: 1, assessmentType: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

export default mongoose.model('AssessmentSession', assessmentSessionSchema);
