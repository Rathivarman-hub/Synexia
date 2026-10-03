import CodingProblem, {
  slugifyProblemTitle,
  getDifficultyPoints,
} from '../models/CodingProblem.js';
import PROBLEMS from '../seedData/codingProblems.js';
import logger from '../config/logger.js';

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

export const seedCodingProblems = async ({
  preserveExisting = false,
  resetStats = false,
} = {}) => {
  const operations = PROBLEMS.map((problem) => {
    const body = buildSeedBody(problem, { resetStats });
    return {
      updateOne: {
        filter: { slug: body.slug },
        update: preserveExisting ? { $setOnInsert: body } : { $set: body },
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
    preserveExisting
      ? `✅ Coding catalogue checked: ${inserted} created, ${matched} existing preserved`
      : `✅ Coding catalogue seeded: ${inserted} created, ${modified} updated, ${matched} unchanged`
  );

  if (preserveExisting) return result;

  logger.info(`   Total problems in catalogue: ${await CodingProblem.countDocuments()}`);

  const seededSlugs = operations.map(({ updateOne }) => updateOne.filter.slug);
  const problems = await CodingProblem.find({ slug: { $in: seededSlugs } })
    .select('title points testCases +hiddenTestCases');
  const zeroPoint = problems.filter((problem) => !problem.points);
  const missingMirror = problems.filter(
    (problem) => problem.hiddenTestCases.length !== problem.testCases.filter((tc) => tc.hidden).length
  );

  if (zeroPoint.length) {
    throw new Error(
      `Seed produced ${zeroPoint.length} problem(s) with points=0: ${zeroPoint
        .map((problem) => problem.title)
        .join(', ')}`
    );
  }
  if (missingMirror.length) {
    throw new Error(
      `Seed produced ${missingMirror.length} problem(s) with an out-of-sync hiddenTestCases mirror: ${missingMirror
        .map((problem) => problem.title)
        .join(', ')}`
    );
  }

  const totalCases = problems.reduce((sum, problem) => sum + problem.testCases.length, 0);
  logger.info(`   Verified ${problems.length} problems / ${totalCases} test cases, all with points and hidden mirrors`);
  return result;
};
