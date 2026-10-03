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
