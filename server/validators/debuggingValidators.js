import Joi from 'joi';
import { LANGUAGE_KEYS } from '../config/languages.js';

const languageCodeSchema = Joi.object(
  LANGUAGE_KEYS.reduce((fields, language) => {
    fields[language] = Joi.string().max(20000).allow('').default('');
    return fields;
  }, {})
).required();

const completeLanguageCodeSchema = Joi.object(
  LANGUAGE_KEYS.reduce((fields, language) => {
    fields[language] = Joi.string().min(1).max(20000).required();
    return fields;
  }, {})
).required();

const testCaseSchema = Joi.object({
  input: Joi.string().max(20000).allow('').required(),
  expectedOutput: Joi.string().max(20000).allow('').required(),
});

const caseList = Joi.array().items(testCaseSchema).max(60).default([]);

export const createDebuggingProblemSchema = Joi.object({
  level: Joi.number().integer().min(1).max(8).required(),
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().min(10).max(20000).required(),
  difficulty: Joi.string().valid('easy', 'easy-medium', 'medium', 'medium-hard', 'hard', 'complex').required(),
  points: Joi.number().integer().min(0).max(1000).required(),
  languageTemplates: completeLanguageCodeSchema,
  boilerplateCode: languageCodeSchema,
  solutionCode: completeLanguageCodeSchema,
  missingLinePosition: languageCodeSchema,
  sampleInput: Joi.string().max(20000).allow('').default(''),
  sampleOutput: Joi.string().max(20000).allow('').default(''),
  visibleTestCases: caseList,
  hiddenTestCases: Joi.array().items(testCaseSchema).min(1).max(60).required(),
  isActive: Joi.boolean().default(true),
  order: Joi.number().integer().min(0).max(9999).default(0),
});

export const updateDebuggingProblemSchema = Joi.object({
  level: Joi.number().integer().min(1).max(8),
  title: Joi.string().trim().min(3).max(200),
  description: Joi.string().min(10).max(20000),
  difficulty: Joi.string().valid('easy', 'easy-medium', 'medium', 'medium-hard', 'hard', 'complex'),
  points: Joi.number().integer().min(0).max(1000),
  languageTemplates: completeLanguageCodeSchema,
  boilerplateCode: languageCodeSchema,
  solutionCode: completeLanguageCodeSchema,
  missingLinePosition: languageCodeSchema,
  sampleInput: Joi.string().max(20000).allow(''),
  sampleOutput: Joi.string().max(20000).allow(''),
  visibleTestCases: caseList,
  hiddenTestCases: Joi.array().items(testCaseSchema).min(1).max(60),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0).max(9999),
}).min(1);

export const listDebuggingProblemsQuerySchema = Joi.object({
  difficulty: Joi.string().valid('easy', 'easy-medium', 'medium', 'medium-hard', 'hard', 'complex'),
  language: Joi.string().valid(...LANGUAGE_KEYS),
  points: Joi.number().integer().min(0).max(1000),
  search: Joi.string().trim().max(100),
});

const assessmentSchema = Joi.object({
  reason: Joi.string().valid('normal', 'warning-limit').default('normal'),
  warningCount: Joi.number().integer().min(0).max(3).default(0),
  warningEvents: Joi.array().items(Joi.object({
    type: Joi.string().valid('fullscreen-exit', 'visibility-hidden', 'window-blur', 'context-switch', 'developer-tools', 'escape').required(),
    occurredAt: Joi.date().iso().required(),
  })).max(3).default([]),
  elapsedSeconds: Joi.number().integer().min(0).default(0),
}).default({});

const executionSchema = Joi.object({
  problemId: Joi.string().hex().length(24).required(),
  language: Joi.string().valid(...LANGUAGE_KEYS).required(),
  code: Joi.string().allow('').max(20000).required(),
});

export const runDebuggingCodeSchema = executionSchema.keys({
  code: Joi.string().min(1).max(20000).required(),
});
export const submitDebuggingCodeSchema = executionSchema.keys({ assessment: assessmentSchema });
