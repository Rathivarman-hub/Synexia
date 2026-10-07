import Joi from 'joi';
import { LANGUAGE_KEYS } from '../config/languages.js';

// ─── Student coding execution validators ──────────────────────────────────────

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
