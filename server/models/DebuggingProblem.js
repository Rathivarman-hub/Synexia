import mongoose from 'mongoose';
import { LANGUAGE_KEYS } from '../config/languages.js';

const languageCodeSchema = new mongoose.Schema(
  Object.fromEntries(LANGUAGE_KEYS.map((language) => [language, { type: String, default: '' }])),
  { _id: false }
);

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, default: '', maxlength: 20000 },
    expectedOutput: { type: String, default: '', maxlength: 20000 },
  },
  { _id: false }
);

const hasEveryLanguage = (codeByLanguage) =>
  LANGUAGE_KEYS.every((language) => typeof codeByLanguage?.[language] === 'string' && codeByLanguage[language].trim().length > 0);

const debuggingProblemSchema = new mongoose.Schema(
  {
    assessmentType: { type: String, enum: ['debugging'], default: 'debugging', immutable: true, index: true },
    level: { type: Number, min: 1, max: 8, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, maxlength: 20000 },
    difficulty: {
      type: String,
      enum: ['easy', 'easy-medium', 'medium', 'medium-hard', 'hard', 'complex'],
      default: 'easy',
      index: true,
    },
    points: { type: Number, required: true, min: 0, max: 1000 },
    languageTemplates: {
      type: languageCodeSchema,
      default: () => ({}),
      validate: { validator: hasEveryLanguage, message: 'A student template is required for every supported language.' },
    },
    boilerplateCode: { type: languageCodeSchema, default: () => ({}) },
    solutionCode: { type: languageCodeSchema, select: false },
    missingLinePosition: { type: languageCodeSchema, default: () => ({}) },
    sampleInput: { type: String, default: '', maxlength: 20000 },
    sampleOutput: { type: String, default: '', maxlength: 20000 },
    visibleTestCases: { type: [testCaseSchema], default: [] },
    hiddenTestCases: {
      type: [testCaseSchema],
      default: [],
      select: false,
      validate: {
        validator: (testCases) => Array.isArray(testCases) && testCases.length > 0,
        message: 'At least one hidden test case is required.',
      },
    },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, min: 0, max: 9999 },
    acceptanceStats: {
      totalSubmissions: { type: Number, default: 0, min: 0 },
      acceptedSubmissions: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

debuggingProblemSchema.index({ isActive: 1, difficulty: 1, points: -1 });
debuggingProblemSchema.index({ isActive: 1, order: 1, points: 1 });

const DebuggingProblem = mongoose.model('DebuggingProblem', debuggingProblemSchema);
export default DebuggingProblem;
