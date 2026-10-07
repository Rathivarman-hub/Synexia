import Joi from 'joi';

export const deleteStudentsSchema = Joi.object({
  studentIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .max(100)
    .unique()
    .required(),
});
