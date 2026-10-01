import { runBatch } from './codeExecutionService.js';

// ─── Coding Module · Grading Service ───────────────────────────────────────────
// WHY: Output comparison is the single place where a platform decides whether a
// student is right or wrong. LeetCode-style graders compare *whitespace-token
// sequences*, not bytes: "1 2 3" and "1  2\n3\n" are the same answer. Getting
// this wrong produces the worst class of bug in a coding judge — real solutions
// marked wrong because of trailing whitespace.
// WHY one regex and not a chain of replaces: JS `\s` already matches spaces,
// tabs, LF, CR and CRLF, so collapsing every whitespace run to a single space
// normalises line endings, indentation and trailing newlines in a single pass.
// That is the whole reason a correct solution must never be marked wrong just
// because it printed "1 2 3\n" instead of "1 2 3".
const WHITESPACE_RUN = /\s+/g;

/**
 * Canonicalise a program's stdout for comparison.
 * 1. collapse every internal whitespace run (incl. CRLF) to a single space
 * 2. trim leading/trailing whitespace
 */
export const normalizeOutput = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(WHITESPACE_RUN, ' ').trim();
};

/** Case-insensitive comparison — used only for boolean/word answers. */
export const normalizeOutputLoose = (value) => normalizeOutput(value).toLowerCase();

export const outputsMatch = (actual, expected) => normalizeOutput(actual) === normalizeOutput(expected);

/**
 * Collapse a graded run into the values the UI and the DB need.
 *
 * @param {object} problem      the CodingProblem document
 * @param {object[]} execResults one runOnce() result per test case, same order
 * @returns {{status, passedCases, totalCases, accuracy, score, maxScore,
 *            executionTime, cases: Array}}
 */
export const grade = (problem, execResults) => {
  const cases = problem.testCases || [];
  const totalCases = cases.length;
  const maxScore = problem.points || 0;
  let passedCases = 0;
  let executionTime = 0;
  let memoryUsageKB = 0;
  // A compile error is fatal — every case fails for the same reason, so there is
  // no point reporting each one as a separate "wrong answer".
  let compileError = null;
  let infrastructureError = null;

  const graded = cases.map((testCase, i) => {
    const run = execResults[i] || { status: 'internal-error', output: '', error: 'No result', executionTime: 0 };
    executionTime += run.executionTime || 0;
    memoryUsageKB = Math.max(memoryUsageKB, run.memoryUsageKB || 0);

    if (run.status === 'compile-error' && !compileError) {
      compileError = run.error || 'Compilation failed.';
    }
    if (run.status === 'internal-error' && !infrastructureError) {
      infrastructureError = run.error || 'Sandbox error.';
    }

    const passed = run.status === 'ok' && outputsMatch(run.output, testCase.expectedOutput);
    if (passed) passedCases += 1;

    return {
      index: i,
      // WHY: hidden cases report only pass/fail. Returning the expected output
      // for a hidden case would let a student hardcode answers by probing.
      input: testCase.hidden ? null : testCase.input,
      expectedOutput: testCase.hidden ? null : testCase.expectedOutput,
      hidden: Boolean(testCase.hidden),
      passed,
      status: run.status,
      // Truncated for transport; the full stdout is discarded after grading.
      output: testCase.hidden ? null : run.output,
      error: testCase.hidden ? null : run.error,
      executionTime: run.executionTime || 0,
      memoryUsageKB: run.memoryUsageKB || 0,
    };
  });

  let status;
  if (compileError) status = 'compile-error';
  else if (infrastructureError) status = 'internal-error';
  else if (totalCases > 0 && passedCases === totalCases) status = 'accepted';
  else if (passedCases > 0) status = 'partial';
  else if (graded.some((c) => c.status === 'time-limit-exceeded')) status = 'time-limit-exceeded';
  else if (graded.some((c) => c.status === 'runtime-error')) status = 'runtime-error';
  else status = 'wrong-answer';

  const accuracy = totalCases > 0 ? Math.round((passedCases / totalCases) * 1000) / 10 : 0;

  // WHY: partial credit is proportional to cases passed, capped at the problem's
  // points. This keeps the leaderboard meaningful (a 7/10 solution earns credit)
  // while still reserving full marks for a fully correct solution.
  const score = status === 'accepted' ? maxScore : Math.floor((accuracy / 100) * maxScore);

  return {
    status,
    passedCases,
    failedCases: totalCases - passedCases,
    totalCases,
    accuracy,
    score,
    maxScore,
    executionTime,
    memoryUsageKB,
    // First meaningful diagnostic message wins — that is what the user needs.
    message: compileError || infrastructureError || graded.find((c) => c.status !== 'ok')?.error || '',
    cases: graded,
  };
};

/**
 * Full submit flow: execute every case (samples + hidden) and grade.
 * @param {object} problem CodingProblem document
 */
export const gradeSubmission = async (problem, { language, code, timeLimitMs = 5000 }) => {
  const testCases = problem.testCases || [];
  const execResults = await runBatch({
    language,
    code,
    inputs: testCases.map((tc) => tc.input),
    timeLimitMs,
  });
  return grade(problem, execResults);
};

/**
 * "Run Code" flow — sample cases only, and never graded for score.
 * Selected case indices let the user re-run one specific case from the panel.
 */
export const runSampleTests = async (problem, { language, code, caseIndices, timeLimitMs = 5000 }) => {
  const testCases = problem.testCases || [];
  const indices = (Array.isArray(caseIndices) && caseIndices.length
    ? caseIndices
    : testCases.map((_, i) => i)
  )
    .map((i) => Number(i))
    .filter((i) => Number.isInteger(i) && i >= 0 && i < testCases.length);

  // Hidden cases are never executed on a free "Run" — that is the entire
  // distinction between Run (free, sample-only) and Submit (graded, all cases).
  const sampleIndices = indices.filter((i) => !testCases[i].hidden);
  if (sampleIndices.length === 0) {
    return { cases: [], executionTime: 0, memoryUsageKB: 0, message: 'No sample test cases to run.', configured: true };
  }

  const execResults = await runBatch({
    language,
    code,
    inputs: sampleIndices.map((i) => testCases[i].input),
    timeLimitMs,
  });

  const cases = sampleIndices.map((index, i) => {
    const testCase = testCases[index];
    const run = execResults[i] || { status: 'internal-error', output: '', error: 'No result', executionTime: 0 };
    return {
      index,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      hidden: false,
      passed: run.status === 'ok' && outputsMatch(run.output, testCase.expectedOutput),
      status: run.status,
      output: run.output,
      error: run.error,
      executionTime: run.executionTime || 0,
      memoryUsageKB: run.memoryUsageKB || 0,
    };
  });

  return {
    cases,
    executionTime: cases.reduce((sum, c) => sum + c.executionTime, 0),
    memoryUsageKB: Math.max(0, ...cases.map((testCase) => testCase.memoryUsageKB || 0)),
    passedCases: cases.filter((testCase) => testCase.passed).length,
    failedCases: cases.filter((testCase) => !testCase.passed).length,
    status: cases.length > 0 && cases.every((testCase) => testCase.passed)
      ? 'accepted'
      : cases.find((testCase) => testCase.status !== 'ok')?.status || 'wrong-answer',
    configured: true,
  };
};

export default { normalizeOutput, outputsMatch, grade, gradeSubmission, runSampleTests };
