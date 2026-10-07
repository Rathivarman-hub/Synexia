import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { deleteStudentsSchema } from '../validators/adminValidators.js';

test('accepts unique student IDs for a bulk delete', () => {
  const studentIds = [
    new mongoose.Types.ObjectId().toString(),
    new mongoose.Types.ObjectId().toString(),
  ];
  const { error, value } = deleteStudentsSchema.validate({ studentIds });

  assert.equal(error, undefined);
  assert.deepEqual(value.studentIds, studentIds);
});

test('rejects empty, duplicate, and malformed student ID lists', () => {
  const id = new mongoose.Types.ObjectId().toString();

  assert.ok(deleteStudentsSchema.validate({ studentIds: [] }).error);
  assert.ok(deleteStudentsSchema.validate({ studentIds: [id, id] }).error);
  assert.ok(deleteStudentsSchema.validate({ studentIds: ['not-an-object-id'] }).error);
});
