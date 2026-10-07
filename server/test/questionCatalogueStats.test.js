import test from 'node:test';
import assert from 'node:assert/strict';
import PROBLEMS from '../seedData/codingProblems.js';
import { buildDebuggingSeedRecord } from '../services/debuggingProblemSeeder.js';
import { countUniqueQuestions } from '../utils/questionCatalogueStats.js';

test('counts the seeded coding and debugging catalogues as eight questions', () => {
  const codingQuestions = PROBLEMS.map((problem) => ({
    statement: problem.statement,
    isActive: true,
  }));
  const debuggingQuestions = PROBLEMS.map((problem, index) => {
    const record = buildDebuggingSeedRecord(problem, index);
    return { description: record.description, isActive: true };
  });

  assert.deepEqual(countUniqueQuestions(codingQuestions, debuggingQuestions), {
    totalProblems: 8,
    activeProblems: 8,
    inactiveProblems: 0,
  });
});

test('counts the same coding and debugging prompt once', () => {
  const codingQuestions = [
    { statement: 'Find the sum of odd numbers.', isActive: true },
  ];
  const debuggingQuestions = [
    {
      description: 'Find the sum of odd numbers.\n\nConstraints:\n- 1 <= N <= 10^5\n\nInput format: integers',
      isActive: true,
    },
  ];

  assert.deepEqual(countUniqueQuestions(codingQuestions, debuggingQuestions), {
    totalProblems: 1,
    activeProblems: 1,
    inactiveProblems: 0,
  });
});

test('keeps distinct questions separate and counts an active copy over an inactive one', () => {
  const codingQuestions = [
    { statement: 'Find the sum of odd numbers.', isActive: false },
    { statement: 'Reverse an integer.', isActive: true },
  ];
  const debuggingQuestions = [
    {
      description: 'Find the sum of odd numbers.\n\nInput format: integers',
      isActive: true,
    },
  ];

  assert.deepEqual(countUniqueQuestions(codingQuestions, debuggingQuestions), {
    totalProblems: 2,
    activeProblems: 2,
    inactiveProblems: 0,
  });
});

test('includes inactive questions in the total without marking them active', () => {
  assert.deepEqual(countUniqueQuestions(
    [{ statement: 'Active prompt', isActive: true }],
    [{ description: 'Archived prompt', isActive: false }]
  ), {
    totalProblems: 2,
    activeProblems: 1,
    inactiveProblems: 1,
  });
});
