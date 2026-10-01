import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name must not exceed 100 characters',
    'any.required': 'Name is required',
  }),
  email: Joi.string().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'Password is required',
  }),
  college: Joi.string().trim().max(200).allow('').optional(),
  rollNumber: Joi.string().trim().max(50).allow('').optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  college: Joi.string().trim().max(200).allow('').optional(),
  rollNumber: Joi.string().trim().max(50).allow('').optional(),
  password: Joi.string().min(6).max(128).optional(),
  // avatar must be a URL (not raw base64) — use Cloudinary/S3 URL
  avatar: Joi.string().uri().max(500).allow('').optional().messages({
    'string.uri': 'Avatar must be a valid URL (upload to Cloudinary first)',
  }),
});
