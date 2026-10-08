import test from 'node:test';
import assert from 'node:assert/strict';
import { grade } from '../services/codingGraderService.js';
import { normalizeJudge0Result } from '../services/codeExecutionService.js';

const base64 = (value) => Buffer.from(value, 'utf8').toString('base64');

test('Judge0 wrong-answer status preserves stdout for SYNEXIA comparison', () => {
  const execution = normalizeJudge0Result({
    status: { id: 4, description: 'Wrong Answer' },
    stdout: base64('42\n'),
    stderr: '',
    exit_code: 0,
    time: '0.01',
    memory: '1024',
  });

  assert.equal(execution.status, 'ok');
  assert.equal(execution.output, '42\n');

  const correct = grade(
    { points: 5, testCases: [{ input: '', expectedOutput: '42' }] },
    [execution]
  );
  assert.equal(correct.status, 'accepted');
  assert.equal(correct.passedCases, 1);

  const incorrect = grade(
    { points: 5, testCases: [{ input: '', expectedOutput: '24' }] },
    [execution]
  );
  assert.equal(incorrect.status, 'wrong-answer');
  assert.equal(incorrect.passedCases, 0);
});
