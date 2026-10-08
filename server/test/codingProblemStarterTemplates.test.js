import test from 'node:test';
import assert from 'node:assert/strict';
import PROBLEMS from '../seedData/codingProblems.js';
import { getStarterTemplate, LANGUAGE_KEYS } from '../config/languages.js';

test('all seeded coding problems use only the shared boilerplate templates', () => {
  assert.equal(PROBLEMS.length, 8);

  for (const problem of PROBLEMS) {
    assert.deepEqual(Object.keys(problem.starterCode).sort(), [...LANGUAGE_KEYS].sort());
    for (const language of LANGUAGE_KEYS) {
      assert.equal(problem.starterCode[language], getStarterTemplate(language), `${problem.title}: ${language}`);
    }
  }
});
