import Joi from 'joi';
import { CODING_DIFFICULTIES } from '../models/CodingProblem.js';
import { LANGUAGE_KEYS } from '../config/languages.js';

// ─── Coding Module · Validators ───────────────────────────────────────────────
// WHY: MongoDB schema validation protects the WRITE path but never rejects a bad
// shape before the model runs its hooks, and it returns raw driver error text.
// Joi at the route boundary (middleware/validate.js) returns a clean 400 with
// field-level messages, which is what the admin form renders. Both layers are
// deliberately kept: Joi for fast feedback, schema for invariants.

const testCaseSchema = Joi.object({
  input: Joi.string().allow('').max(20000).required().messages({
    'any.required': 'Every test case needs an input',
  }),
  expectedOutput: Joi.string().max(20000).allow('').required().messages({
    'any.required': 'Every test case needs an expected output',
  }),
  hidden: Joi.boolean().default(false),
});

const starterCodeSchema = Joi.object(
  LANGUAGE_KEYS.reduce((acc, key) => {
    acc[key] = Joi.string().max(20000).allow('').default('');
    return acc;
  }, {})
);

const exampleSchema = Joi.object({
  input: Joi.string().max(20000).allow('').default(''),
  output: Joi.string().max(20000).allow('').default(''),
  explanation: Joi.string().max(2000).allow('').default(''),
});

const stringList = (max) => Joi.array().items(Joi.string().trim().max(500)).max(max).default([]);

export const createCodingProblemSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    'string.empty': 'Title is required',
    'any.required': 'Title is required',
  }),
  slug: Joi.string().trim().lowercase().max(140).allow('').optional(),
  difficulty: Joi.string().valid(...CODING_DIFFICULTIES).default('easy'),
  // 0 is legal and means "derive from difficulty" (handled in the model hook).
  points: Joi.number().integer().min(0).max(1000).default(0),
  category: Joi.string().trim().max(60).default('arrays'),
  tags: stringList(12),

  statement: Joi.string().trim().min(10).max(20000).required().messages({
    'any.required': 'Problem statement is required',
  }),
  constraints: stringList(30),
  inputFormat: Joi.string().max(4000).allow('').default(''),
  outputFormat: Joi.string().max(4000).allow('').default(''),
  hints: stringList(10),

  examples: Joi.array().items(exampleSchema).max(10).default([]),
  starterCode: starterCodeSchema.default({}),
  testCases: Joi.array().items(testCaseSchema).min(1).max(60).required().messages({
    'array.min': 'At least one test case is required',
    'any.required': 'Test cases are required',
  }),

  isActive: Joi.boolean().default(true),
  order: Joi.number().integer().min(0).max(9999).default(0),
});

/**
 * PUT semantics: every field optional, but at least one must be present.
 * WHY: without `.or()`, an empty body would sail through validation and
 * `findByIdAndUpdate` would no-op while reporting "updated" — a silent no-op is
 * the worst failure mode an admin endpoint can have.
 */
export const updateCodingProblemSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200),
  slug: Joi.string().trim().lowercase().max(140).allow(''),
  difficulty: Joi.string().valid(...CODING_DIFFICULTIES),
  points: Joi.number().integer().min(0).max(1000),
  category: Joi.string().trim().max(60),
  tags: stringList(12),
  statement: Joi.string().trim().min(10).max(20000),
  constraints: stringList(30),
  inputFormat: Joi.string().max(4000).allow(''),
  outputFormat: Joi.string().max(4000).allow(''),
  hints: stringList(10),
  examples: Joi.array().items(exampleSchema).max(10),
  starterCode: starterCodeSchema,
  testCases: Joi.array().items(testCaseSchema).min(1).max(60),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0).max(9999),
}).or('title', 'slug', 'difficulty', 'points', 'category', 'tags', 'statement', 'constraints',
  'inputFormat', 'outputFormat', 'hints', 'examples', 'starterCode', 'testCases', 'isActive', 'order')
  .messages({
    'object.missing': 'Provide at least one field to update',
  });

export const addTestCasesSchema = Joi.object({
  testCases: Joi.array().items(testCaseSchema).min(1).max(60).required().messages({
    'array.min': 'Add at least one test case',
  }),
  // WHY: default true. When an admin appends cases to a live problem they mean
  // grading cases, and an accidentally-public hidden case silently weakens the
  // problem — failing closed is the safer default.
  hidden: Joi.boolean().default(true),
});

export const runCodeSchema = Joi.object({
  problemId: Joi.string().hex().length(24).required(),
  language: Joi.string().valid(...LANGUAGE_KEYS).required().messages({
    'any.only': 'Unsupported language',
  }),
  code: Joi.string().min(1).max(20000).required().messages({
    'any.required': 'Code is required',
  }),
  // Optional: run a specific subset of sample cases.
  caseIndices: Joi.array().items(Joi.number().integer().min(0).max(200)).max(20).optional(),
});

export const submitCodeSchema = Joi.object({
  problemId: Joi.string().hex().length(24).required(),
  language: Joi.string().valid(...LANGUAGE_KEYS).required().messages({
    'any.only': 'Unsupported language',
  }),
  code: Joi.string().allow('').max(20000).required().messages({
    'any.required': 'Code is required',
  }),
  assessment: Joi.object({
    reason: Joi.string().valid('normal', 'warning-limit').default('normal'),
    warningCount: Joi.number().integer().min(0).max(3).default(0),
    warningEvents: Joi.array().items(Joi.object({
      type: Joi.string().valid('fullscreen-exit', 'visibility-hidden', 'window-blur', 'context-switch', 'developer-tools', 'escape').required(),
      occurredAt: Joi.date().iso().required(),
    })).max(3).default([]),
    elapsedSeconds: Joi.number().integer().min(0).default(0),
  }).default({}),
});
