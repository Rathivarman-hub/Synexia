import asyncHandler from 'express-async-handler';
import CodingProblem from '../models/CodingProblem.js';
import { getUserProblemStatusMap } from '../services/codingLeaderboardService.js';
import { getStarterTemplate, getLanguageManifest, LANGUAGE_KEYS } from '../config/languages.js';
import { CODING_DIFFICULTIES, DIFFICULTY_LABELS } from '../models/CodingProblem.js';
import { getCache, setCache } from '../utils/cache.js';

const LIST_TTL = 120;
const DETAIL_TTL = 300;
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

const SORTABLE = {
  order: { field: 'order' },
  points: { field: 'points' },
  title: { field: 'title' },
  // `difficultyRank` and `acceptanceRate` are VIRTUALS (see CodingProblem.js),
  // so they do not exist as Mongo fields. `.sort({ difficultyRank: -1 })` does not
  // error — it silently sorts by an absent field, i.e. a no-op that makes the
  // "Sort by difficulty" control look broken. The aggregation below therefore
  // materialises both with $addFields so Mongo can genuinely order by them.
  difficulty: { computed: 'difficultyRank' },
  acceptance: { computed: 'acceptanceRate' },
  newest: { field: 'createdAt' },
};

/**
 * $switch expressions mirroring the DIFFICULTY_RANK map and the acceptanceRate
 * virtual, so the aggregation and the document virtuals cannot disagree. A tier
 * missing here falls to `default`, which is why CODING_DIFFICULTIES and this map
 * must be edited together.
 */
const DIFFICULTY_RANK_SWITCH = {
  $switch: {
    branches: CODING_DIFFICULTIES.map((d, i) => ({ case: { $eq: ['$difficulty', d] }, then: i })),
    default: 0,
  },
};

const ACCEPTANCE_RATE_EXPR = {
  $cond: [
    { $gt: [{ $ifNull: ['$acceptanceStats.totalSubmissions', 0] }, 0] },
    {
      $round: [
        {
          $multiply: [
            { $divide: ['$acceptanceStats.acceptedSubmissions', '$acceptanceStats.totalSubmissions'] },
            100,
          ],
        },
        1,
      ],
    },
    0,
  ],
};

/**
 * Convert a lean problem doc into the shape the problems table needs, WITHOUT
 * leaking hidden test cases. Hidden cases never leave the server — not to a
 * student, not in a cached payload, not in an error message.
 */
const toListItem = (problem, status) => ({
  _id: problem._id,
  title: problem.title,
  slug: problem.slug,
  difficulty: problem.difficulty,
  difficultyLabel: problem.difficultyLabel,
  points: problem.points,
  category: problem.category,
  tags: problem.tags,
  acceptanceRate: problem.acceptanceRate,
  totalSubmissions: problem.acceptanceStats?.totalSubmissions || 0,
  ...status,
});

/**
 * @desc    List coding problems (LeetCode-style table)
 * @route   GET /api/coding/problems
 * @access  Private (student)
 */
export const getProblems = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, difficulty, category, search, sortBy = 'points', sortOrder = 'desc' } = req.query;

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const filter = { isActive: true };
  if (difficulty) filter.difficulty = difficulty;
  if (category) filter.category = category;
  if (search && typeof search === 'string' && search.trim()) {
    const rx = { $regex: escapeRegex(search.trim()), $options: 'i' };
    filter.$or = [{ title: rx }, { slug: rx }, { tags: rx }];
  }

  // WHY: `sortBy` is allow-listed to SORTABLE. normalizePagination (used by the
  // assessment module) does not allow-list its field, which is an open sort-field
  // injection surface — this module closes it rather than copying the weakness.
  const sort = SORTABLE[sortBy] || SORTABLE.points;
  const direction = sortOrder === 'asc' ? 1 : -1;
  // Deterministic tie-break on _id keeps pagination stable: without it, two
  // problems with equal points can swap order between requests and a student's
  // page 2 can repeat or skip a row.
  const sortSpec = sort.computed
    ? { [sort.computed]: direction, points: -1, _id: 1 }
    : { [sort.field]: direction, _id: 1 };

  const cacheKey = `coding:problems:list:${JSON.stringify({ filter, sortBy, sortOrder: direction, skip, safeLimit })}`;

  // WHY the cache stores only the *shared* half of the response. The per-user
  // Status column is joined in after the cache read, so one Redis entry serves
  // every student on the page instead of one entry per (user, filter) pair.
  let payload = await getCache(cacheKey);
  let cached = true;

  if (!payload) {
    // difficultyLabel / difficultyRank / acceptanceRate are projected for EVERY
    // sort mode so the cached payload shape does not change when the student
    // changes the sort control (otherwise a shape flip reads as a data bug).
    const addFields = {
      difficultyLabel: {
        $switch: {
          branches: Object.entries(DIFFICULTY_LABELS).map(([key, label]) => ({
            case: { $eq: ['$difficulty', key] },
            then: label,
          })),
          default: '$difficulty',
        },
      },
      difficultyRank: DIFFICULTY_RANK_SWITCH,
      acceptanceRate: ACCEPTANCE_RATE_EXPR,
    };

    const [total, problems] = await Promise.all([
      CodingProblem.countDocuments(filter),
      // WHY aggregate() and not find(): the two computed sort keys have to exist
      // in the pipeline for MongoDB to order by them, and virtuals cannot be
      // materialised by .lean() in a query context.
      CodingProblem.aggregate([
        { $match: filter },
        { $addFields: addFields },
        { $sort: sortSpec },
        { $skip: skip },
        { $limit: safeLimit },
        {
          $project: {
            title: 1, slug: 1, difficulty: 1, difficultyLabel: 1, difficultyRank: 1,
            points: 1, category: 1, tags: 1, order: 1, createdAt: 1,
            acceptanceStats: 1, acceptanceRate: 1,
          },
        },
      ]),
    ]);

    payload = { total, page: safePage, limit: safeLimit, data: problems };
    await setCache(cacheKey, payload, LIST_TTL);
    cached = false;
  }

  // WHY: the difficulty filter dropdown needs the full distinct set, not just the
  // tiers that happen to appear on the current page — otherwise the option
  // disappears when you filter down to a page that has none of it.
  let difficulties = await getCache('coding:problems:difficulties');
  if (!difficulties) {
    difficulties = await CodingProblem.distinct('difficulty', { isActive: true });
    await setCache('coding:problems:difficulties', difficulties, LIST_TTL * 5);
  }

  // Personalisation pass — one indexed aggregation, no N+1 across the page.
  const statusMap = await getUserProblemStatusMap(
    req.user._id,
    payload.data.map((p) => p._id)
  );

  const data = payload.data.map((p) => toListItem(p, statusMap[p._id] || {
    status: 'none',
    solved: false,
    bestScore: 0,
    maxScore: 0,
    totalAttempts: 0,
  }));

  res.json({
    success: true,
    cached,
    total: payload.total,
    page: payload.page,
    limit: payload.limit,
    difficulties,
    data,
  });
});

/**
 * @desc    Get one problem with sample test cases only
 * @route   GET /api/coding/problems/:slug
 * @access  Private (student)
 */
export const getProblem = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `coding:problem:v2:${slug}`;

  // WHY the cache is per-problem, not per-user: the problem body is identical for
  // every student, so it must be cached ONCE and shared. The per-user Status
  // block is joined in *after* the cache read — merging it before setCache()
  // would serve student A's solve state to student B, and would fragment the
  // cache into one entry per user per problem.
  let shared = await getCache(cacheKey);
  let cached = true;

  if (!shared) {
    cached = false;
    const doc = await CodingProblem.findOne({ slug, isActive: true })
      .select('-hiddenTestCases')
      // WHY `lean({ virtuals: true })` and not plain `lean()`: the block below
      // copies difficultyLabel and acceptanceRate off the document, and both are
      // virtuals. A plain .lean() returns raw stored fields, so those two would
      // be `undefined` on the detail payload — the page would render a blank
      // difficulty pill and "NaN%" acceptance.
      .lean({ virtuals: true });
    if (!doc) {
      res.status(404);
      throw new Error('Problem not found');
    }

    const starterCodeTemplates = Object.fromEntries(
      LANGUAGE_KEYS.map((language) => [language, getStarterTemplate(language)])
    );

    shared = {
      _id: doc._id,
      title: doc.title,
      slug: doc.slug,
      difficulty: doc.difficulty,
      difficultyLabel: doc.difficultyLabel,
      points: doc.points,
      category: doc.category,
      tags: doc.tags,
      statement: doc.statement,
      constraints: doc.constraints,
      inputFormat: doc.inputFormat,
      outputFormat: doc.outputFormat,
      hints: doc.hints,
      examples: doc.examples,
      starterCodeTemplates,
      starterCode: Object.fromEntries(
        LANGUAGE_KEYS.map((language) => [
          language,
          doc.starterCode?.[language] || starterCodeTemplates[language],
        ])
      ),
      // Sample cases only. The hidden flag is stripped for the client too —
      // revealing WHICH cases are hidden is a free hint about their shape.
      testCases: (doc.testCases || [])
        .filter((tc) => !tc.hidden)
        .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
      hiddenCount: (doc.testCases || []).filter((tc) => tc.hidden).length,
      acceptanceRate: doc.acceptanceRate,
      totalSubmissions: doc.acceptanceStats?.totalSubmissions || 0,
      languages: getLanguageManifest(),
    };

    await setCache(cacheKey, shared, DETAIL_TTL);
  }

  // Personalisation pass, outside the cached envelope.
  const statusMap = await getUserProblemStatusMap(req.user._id, [shared._id]);
  const problem = {
    ...shared,
    ...(statusMap[shared._id] || { status: 'none', solved: false, bestScore: 0, maxScore: 0, totalAttempts: 0 }),
  };

  res.json({ success: true, cached, data: problem });
});

/**
 * @desc    Starter code for a problem in a chosen language
 * @route   GET /api/coding/problems/:slug/starter?language=python
 * @access  Private (student)
 */
export const getStarterCode = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { language } = req.query;

  const doc = await CodingProblem.findOne({ slug, isActive: true })
    .select('title starterCode')
    .lean();

  if (!doc) {
    res.status(404);
    throw new Error('Problem not found');
  }

  const code = doc.starterCode?.[language] || getStarterTemplate(language);
  res.json({
    success: true,
    data: {
      language,
      code,
      isTemplate: !doc.starterCode?.[language],
      template: code,
    },
  });
});
