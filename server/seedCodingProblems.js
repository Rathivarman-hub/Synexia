/**
 * SYNEXIA - Coding Assessment Module - Catalogue Seeder
 *
 * Run with:  npm run seed:coding           (upsert the 8 problems)
 *            npm run seed:coding:reset     (drop the catalogue AND its submissions first)
 *
 * WHY upsert instead of insert: re-running the seed refreshes the statements,
 * starter code and test cases of the 8 canonical problems in place, without
 * duplicating them.
 *
 * WARNING about --reset: that flag is destructive on BOTH collections. Student
 * submissions are the historical leaderboard/acceptance record, so wiping them
 * cannot be undone and the leaderboard restarts empty. Use it only on a fresh
 * database or when you have genuinely decided to discard all coding history.
 * (The admin "delete problem" API in codingProblemController.js is the
 * non-destructive path and deliberately leaves submissions behind.)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import logger from './config/logger.js';
import CodingProblem, {
  slugifyProblemTitle,
  getDifficultyPoints,
} from './models/CodingProblem.js';
import PROBLEMS from './seedData/codingProblems.js';

const RESET = process.argv.includes('--reset');

/**
 * Build the exact document body the seeder must write.
 *
 * WHY this mirrors the pre-validate hook by hand: `bulkWrite()` validates the
 * raw update operators — it does NOT run document middleware, even with
 * `runValidators: true`. The hook in CodingProblem.js does three things this
 * function therefore has to do itself:
 *
 *   1. derive `slug`          — otherwise the upsert filter and the inserted
 *                                field disagree and each re-seed risks a
 *                                duplicate-key error
 *   2. derive `points`        — the seed data omits it; without this every
 *                                problem stores points: 0, so maxScore is 0,
 *                                every submission scores 0 and the leaderboard
 *                                is permanently empty
 *   3. mirror `hiddenTestCases` from the hidden test cases — the grader and
 *                                admin read paths read that mirror, and it would
 *                                simply be absent
 *
 * Prefer fixing the hook and calling it over adding a fourth place that knows
 * about it.
 */
const buildSeedBody = (problem, { resetStats = false } = {}) => {
  const testCases = problem.testCases.map((tc) => ({
    input: tc.input,
    expectedOutput: tc.expectedOutput,
    hidden: Boolean(tc.hidden),
  }));

  const body = {
    title: problem.title,
    slug: problem.slug || slugifyProblemTitle(problem.title),
    difficulty: problem.difficulty,
    // difficultyLabel is deliberately absent: it is a read-time VIRTUAL, and
    // writing it through $set would create a phantom stored field that then
    // shadows the virtual's real behaviour on subsequent reads.
    points: problem.points ?? getDifficultyPoints(problem.difficulty),
    category: problem.category,
    tags: problem.tags,
    statement: problem.statement,
    constraints: problem.constraints,
    inputFormat: problem.inputFormat,
    outputFormat: problem.outputFormat,
    hints: problem.hints,
    examples: problem.examples,
    starterCode: problem.starterCode,
    testCases,
    hiddenTestCases: testCases
      .filter((tc) => tc.hidden)
      .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput, hidden: true })),
    order: problem.order,
    isActive: true,
  };

  // WHY acceptanceStats is only written on --reset:
  // `acceptanceStats` is a denormalised counter of the submission history, and
  // an ordinary (non-reset) re-seed deliberately PRESERVES that history. Writing
  // zeros here would leave real submissions in the collection while the problem
  // claims it was never attempted — so every acceptance rate and the list-page
  // "N accepted" figure would silently read 0 until each student happened to
  // submit again (only the problem they retry would be corrected).
  //
  // After --reset the submissions really were just deleted above, so the counters
  // are genuinely empty and must be written.
  if (resetStats) {
    body.acceptanceStats = { totalSubmissions: 0, acceptedSubmissions: 0 };
  }

  return body;
};

const seed = async () => {
  await connectDB();

  if (RESET) {
    const { default: CodingSubmission } = await import('./models/CodingSubmission.js');
    const dropped = await CodingProblem.deleteMany({});
    const subs = await CodingSubmission.deleteMany({});
    logger.warn(
      `♻️  Reset — removed ${dropped.deletedCount} problems and ${subs.deletedCount} submissions (history discarded)`
    );
  }

  const operations = PROBLEMS.map((problem) => {
    const body = buildSeedBody(problem, { resetStats: RESET });
    return {
      updateOne: {
        filter: { slug: body.slug },
        update: { $set: body },
        upsert: true,
        runValidators: true,
      },
    };
  });

  const result = await CodingProblem.bulkWrite(operations, { ordered: false });

  const inserted = result.upsertedCount || 0;
  const modified = result.modifiedCount || 0;
  const matched = result.matchedCount || 0;

  logger.info(
    `✅ Coding catalogue seeded: ${inserted} created, ${modified} updated, ${matched} unchanged`
  );
  logger.info(`   Total problems in catalogue: ${await CodingProblem.countDocuments()}`);

  // Post-seed assertions. These are the exact failure modes above, so verify
  // them rather than trusting the bulkWrite to have done the right thing.
  const problems = await CodingProblem.find({}).select('title points testCases hiddenTestCases');
  const zeroPoint = problems.filter((p) => !p.points);
  const missingMirror = problems.filter(
    (p) => p.hiddenTestCases.length !== p.testCases.filter((tc) => tc.hidden).length
  );

  if (zeroPoint.length) {
    throw new Error(
      `Seed produced ${zeroPoint.length} problem(s) with points=0: ${zeroPoint
        .map((p) => p.title)
        .join(', ')}`
    );
  }
  if (missingMirror.length) {
    throw new Error(
      `Seed produced ${missingMirror.length} problem(s) with an out-of-sync hiddenTestCases mirror: ${missingMirror
        .map((p) => p.title)
        .join(', ')}`
    );
  }

  const totalCases = problems.reduce((sum, p) => sum + p.testCases.length, 0);
  logger.info(`   Verified ${problems.length} problems / ${totalCases} test cases, all with points and hidden mirrors`);

  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  process.exit(0);
};

seed().catch((err) => {
  logger.error(`❌ Coding seed failed: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
