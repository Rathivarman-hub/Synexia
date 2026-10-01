/**
 * Joi-based validation middleware factory.
 * Usage: router.post('/login', validate(loginSchema), loginController)
 */
export const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], {
    abortEarly: false,   // collect ALL errors, not just the first
    stripUnknown: true,  // remove extra fields not in schema
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map((d) => d.message.replace(/['"]/g, '')),
    });
  }

  // Replace req[target] with the sanitized & validated value
  req[target] = value;
  next();
};
