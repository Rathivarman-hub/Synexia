import DebuggingProblem from '../models/DebuggingProblem.js';
import PROBLEMS from '../seedData/codingProblems.js';
import { getStarterTemplate, LANGUAGE_KEYS } from '../config/languages.js';
import { deleteCachePattern } from '../utils/cache.js';
import logger from '../config/logger.js';

const LEVELS = [
  { difficulty: 'easy', points: 5 },
  { difficulty: 'easy', points: 7 },
  { difficulty: 'easy-medium', points: 10 },
  { difficulty: 'medium', points: 12 },
  { difficulty: 'medium', points: 15 },
  { difficulty: 'medium-hard', points: 16 },
  { difficulty: 'hard', points: 17 },
  { difficulty: 'complex', points: 18 },
];

const TITLES = [
  'Sum of Odd Numbers',
  'Missing Number',
  'Reverse Integer',
  'Palindrome Number',
  'Search Element',
  'Second Largest Distinct Number',
  'Count Vowels',
  'Move Zeros To End',
];

const SLUGS = [
  'debug-sum-of-odd-numbers',
  'debug-missing-number',
  'debug-reverse-integer',
  'debug-palindrome-number',
  'debug-search-element',
  'debug-second-largest-distinct-number',
  'debug-count-vowels',
  'debug-move-zeros-to-end',
];

const formatDescription = (problem) => {
  const constraints = (problem.constraints || []).map((constraint) => `- ${constraint}`).join('\n');
  const examples = (problem.examples || []).map((example, index) => [
    `Example ${index + 1}:`,
    'Input:',
    '```',
    example.input,
    '```',
    'Output:',
    '```',
    example.output,
    '```',
    ...(example.explanation ? [`Explanation: ${example.explanation}`] : []),
  ].join('\n')).join('\n\n');

  return [
    problem.statement,
    constraints && `Constraints:\n${constraints}`,
    `Input format: ${problem.inputFormat}`,
    `Output format: ${problem.outputFormat}`,
    examples && `Examples:\n${examples}`,
  ].filter(Boolean).join('\n\n');
};

const legacyDescription = (problem) =>
  `${problem.statement}\n\nInput format: ${problem.inputFormat}\nOutput format: ${problem.outputFormat}`;

export const buildDebuggingSeedRecord = (problem, index) => {
  const templates = Object.fromEntries(
    LANGUAGE_KEYS.map((language) => [language, getStarterTemplate(language)])
  );
  const testCases = problem.testCases || [];
  const sample = testCases.find((testCase) => !testCase.hidden) || { input: '', expectedOutput: '' };
  const levelMeta = LEVELS[index];

  return {
    level: index + 1,
    title: TITLES[index],
    slug: SLUGS[index],
    assessmentType: 'debugging',
    description: formatDescription(problem),
    difficulty: levelMeta.difficulty,
    points: levelMeta.points,
    languageTemplates: templates,
    boilerplateCode: templates,
    sampleInput: sample.input,
    sampleOutput: sample.expectedOutput,
    visibleTestCases: testCases
      .filter((testCase) => !testCase.hidden)
      .map(({ input, expectedOutput }) => ({ input, expectedOutput })),
    hiddenTestCases: testCases
      .filter((testCase) => testCase.hidden)
      .map(({ input, expectedOutput }) => ({ input, expectedOutput })),
    isActive: true,
    order: index + 1,
  };
};

export const seedDebuggingProblems = async () => {
  const operations = PROBLEMS.flatMap((problem, index) => {
    const body = buildDebuggingSeedRecord(problem, index);
    const {
      languageTemplates,
      boilerplateCode,
      ...insertOnlyFields
    } = body;

    return [
      {
        updateOne: {
          filter: { slug: body.slug },
          update: {
            $setOnInsert: insertOnlyFields,
            $set: { languageTemplates, boilerplateCode },
            $unset: { solutionCode: '', missingLinePosition: '' },
          },
          upsert: true,
          runValidators: true,
        },
      },
      {
        updateOne: {
          filter: { slug: body.slug, description: legacyDescription(problem) },
          update: { $set: { description: body.description } },
          runValidators: true,
        },
      },
    ];
  });
  const result = await DebuggingProblem.bulkWrite(operations, { ordered: false });
  await deleteCachePattern('debugging:*');
  logger.info(`Debugging catalogue checked: ${result.upsertedCount || 0} created, existing questions preserved`);
  return result;
};

export default { seedDebuggingProblems };
