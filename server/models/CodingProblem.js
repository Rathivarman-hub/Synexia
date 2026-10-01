import mongoose from 'mongoose';

// ─── Coding Module · Difficulty Taxonomy ──────────────────────────────────────
// WHY: Difficulty lives in exactly one place. The enum, the default point value
// and the human label are declared together so a new tier can never be added to
// the enum without also getting points and a display label.
export const CODING_DIFFICULTIES = [
  'easy',
  'easy-medium',
  'medium',
  'medium-hard',
  'hard',
  'complex',
];

export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  'easy-medium': 'Easy-Medium',
  medium: 'Medium',
  'medium-hard': 'Medium-Hard',
  hard: 'Hard',
  complex: 'Complex',
};

export const DIFFICULTY_POINTS = {
  easy: 10,
  'easy-medium': 20,
  medium: 30,
  'medium-hard': 50,
  hard: 75,
  complex: 100,
};

const DIFFICULTY_RANK = Object.fromEntries(
  CODING_DIFFICULTIES.map((d, i) => [d, i])
);

export const getDifficultyPoints = (difficulty) => DIFFICULTY_POINTS[difficulty] ?? DIFFICULTY_POINTS.easy;

/**
 * The ONE place a problem slug is derived from a title.
 *
 * WHY export it: the admin form relies on the pre-validate hook below, but the
 * seeder and any bulk write bypass document hooks entirely. A second private
 * copy of this regex in the seeder is how you end up with `sum-of-odd-numbers`
 * from the hook and `sum-of-odd-numbers-in-an-array-` from the seeder, splitting
 * one problem into two rows.
 */
export const slugifyProblemTitle = (title) =>
  String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

// ─── Test Case ────────────────────────────────────────────────────────────────
// WHY: A test case is the atomic unit of grading. `_id: false` keeps the
// document lean — 8 problems × ~10 cases × hundreds of submissions would
// otherwise store thousands of pointless 12-byte ObjectIds.
const testCaseSchema = new mongoose.Schema(
  {
    // WHY these two fields are NOT `required: true, trim: true`:
    //
    // 1. `trim: true` CORRUPTS legitimate stdin. These are stdin/stdout problems,
    //    so whitespace is part of the data. "Count Vowels" has a hidden case whose
    //    entire input is three spaces, and trim would rewrite it to "" — the test
    //    would silently stop testing what it was written to test.
    // 2. `required: true` rejects "". Several seeded problems have a hidden case
    //    with an EMPTY input or an EMPTY expected output, because an empty line
    //    is a real answer ("Count Vowels" of an empty line is 0; "Move All
    //    Zeros" with n=0 prints nothing). Mongoose treats "" as a missing value
    //    for strings, so the catalogue could not even be saved.
    //
    // The trade-off is that a blank test case can now be saved by accident, so
    // the maxlength caps are what actually bound a case, and the admin UI
    // highlights empty cases for review.
    input: {
      type: String,
      default: '',
      maxlength: 20000,
      validate: {
        validator: (v) => typeof v === 'string',
        message: 'Input must be a string (it may be empty).',
      },
    },
    expectedOutput: {
      type: String,
      default: '',
      maxlength: 20000,
      validate: {
        validator: (v) => typeof v === 'string',
        message: 'Expected output must be a string (it may be empty).',
      },
    },
    // Sample cases ship to the client so the user can "Run" them locally.
    // Hidden cases are stripped server-side and only ever run on submit.
    hidden: { type: Boolean, default: false },
  },
  { _id: false }
);

const exampleSchema = new mongoose.Schema(
  {
    input: { type: String, default: '' },
    output: { type: String, default: '' },
    explanation: { type: String, default: '' },
  },
  { _id: false }
);

// WHY: an explicit per-language schema (rather than a Map) is what makes
// "starter code stored separately for each language" enforceable. A typo in a
// key is rejected at the model layer instead of silently producing an editor
// with no template.
const starterCodeSchema = new mongoose.Schema(
  {
    python: { type: String, default: '' },
    java: { type: String, default: '' },
    javascript: { type: String, default: '' },
    c: { type: String, default: '' },
    cpp: { type: String, default: '' },
    csharp: { type: String, default: '' },
    go: { type: String, default: '' },
  },
  { _id: false }
);

const codingProblemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    // WHY: the URL segment. Stable so a problem can be linked/bookmarked and
    // renamed later without 404ing every shared link.
    slug: { type: String, unique: true, trim: true, lowercase: true },
    difficulty: {
      type: String,
      enum: CODING_DIFFICULTIES,
      default: 'easy',
      index: true,
    },
    // WHY: points are denormalised onto the problem instead of being looked up
    // from DIFFICULTY_POINTS at read time. Admins can override the tier default
    // (requirement: "Set Points"), so a derived value would silently discard
    // their intent. 0 / undefined means "use the tier default".
    points: { type: Number, min: 0, max: 1000, default: 0 },
    category: { type: String, default: 'arrays', trim: true },
    tags: { type: [String], default: [], index: true },

    statement: { type: String, required: true, trim: true },
    constraints: { type: [String], default: [] },
    inputFormat: { type: String, default: '' },
    outputFormat: { type: String, default: '' },
    hints: { type: [String], default: [] },

    examples: { type: [exampleSchema], default: [] },
    starterCode: { type: starterCodeSchema, default: () => ({}) },

    // WHY: `testCases` is the single source of truth. `hiddenTestCases` is a
    // denormalised mirror maintained by the pre-save hook below, kept because
    // the read path for grading needs ONLY the hidden subset. Two independent
    // fields an admin could edit separately would inevitably desynchronise.
    testCases: { type: [testCaseSchema], default: [] },
    hiddenTestCases: { type: [testCaseSchema], default: [], select: false },

    // Denormalised counters. Why not an aggregate on every list request?
    // Because acceptance rate is displayed on EVERY row of the problems table.
    // Aggregating per page would be 1 pipeline per row. Incrementing on submit
    // makes the list read a single indexed document fetch.
    acceptanceStats: {
      totalSubmissions: { type: Number, default: 0, min: 0 },
      acceptedSubmissions: { type: Number, default: 0, min: 0 },
    },

    isActive: { type: Boolean, default: true },
    // Manual ordering within the catalogue. Lower sorts first.
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
codingProblemSchema.virtual('difficultyLabel').get(function () {
  return DIFFICULTY_LABELS[this.difficulty] || this.difficulty;
});

codingProblemSchema.virtual('difficultyRank').get(function () {
  return DIFFICULTY_RANK[this.difficulty] ?? 0;
});

codingProblemSchema.virtual('acceptanceRate').get(function () {
  const total = this.acceptanceStats?.totalSubmissions || 0;
  if (!total) return 0;
  return Math.round((this.acceptanceStats.acceptedSubmissions / total) * 1000) / 10;
});

// ─── Hooks ────────────────────────────────────────────────────────────────────
// WHY: A slug is generated from the title so the admin form never has to care
// about it, and the pre-validate hook is used (not pre-save) so a duplicate
// slug surfaces as a clean 400 instead of an E11000 at the driver level.
codingProblemSchema.pre('validate', async function () {
  if (!this.slug && this.title) {
    this.slug = slugifyProblemTitle(this.title);
  }
  if (!this.slug) this.slug = `problem-${Date.now()}`;

  // Collapse duplicate slugs so `create` never collides on a shared prefix.
  if (this.isNew) {
    const base = this.slug;
    let suffix = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await mongoose.models.CodingProblem.exists({ slug: `${base}-${suffix}` })) {
      suffix += 1;
    }
    if (suffix > 1) this.slug = `${base}-${suffix}`;
  }

  if (!this.points) this.points = getDifficultyPoints(this.difficulty);

  // Keep the hidden mirror authoritative.
  this.hiddenTestCases = (this.testCases || [])
    .filter((tc) => tc.hidden)
    .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput, hidden: true }));
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
// WHY: The problems table is read on every page load of /coding and is sorted by
// (difficulty, points). This compound index lets Mongo satisfy the filter AND
// the sort from a single index scan — no in-memory sort stage, which is what
// keeps the page O(log n) as the catalogue grows past 1000 problems.
//
// WHY no $text index: student search must support partial/prefix typing
// ("sum of" → "Sum of Odd Numbers"). $text does tokenise but cannot do prefix
// matching without a separate prefix index, so an escaped regex against the
// indexed {isActive, difficulty, points} prefix is both faster to reason about
// and better UX. At catalogue scale this is a bounded collection scan; at a
// scale where that matters, swap the search clause for Atlas Search.
codingProblemSchema.index({ isActive: 1, difficulty: 1, points: -1 });
codingProblemSchema.index({ isActive: 1, order: 1, points: -1 });
codingProblemSchema.index({ category: 1, isActive: 1 });

export const CodingProblem = mongoose.model('CodingProblem', codingProblemSchema);
export default CodingProblem;
