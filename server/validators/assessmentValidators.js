import Joi from 'joi';
import { LANGUAGE_KEYS } from '../config/languages.js';

const warningEventSchema = Joi.object({
  type: Joi.string().valid(
    'fullscreen-exit',
    'visibility-hidden',
    'window-blur',
    'context-switch',
    'developer-tools',
    'escape'
  ).required(),
  occurredAt: Joi.date().iso().required(),
});

export const recordAssessmentWarningSchema = Joi.object({
  sessionId: Joi.string().hex().length(24).required(),
  event: warningEventSchema.required(),
});

export const submitAssessmentSchema = Joi.object({
  sessionId: Joi.string().hex().length(24).required(),
  answers: Joi.array().items(Joi.object({
    questionId: Joi.string().hex().length(24).required(),
    language: Joi.string().valid(...LANGUAGE_KEYS).required(),
    code: Joi.string().allow('').max(20000).default(''),
  })).max(8).default([]),
  warningCount: Joi.number().integer().min(0).max(3).default(0),
  warningEvents: Joi.array().items(warningEventSchema).max(3).default([]),
  reason: Joi.string().valid('manual-submit', 'warning-limit', 'time-limit').default('manual-submit'),
});
