import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { normalizeOutput } from '../services/codingGraderService.js';
import PROBLEMS from '../seedData/codingProblems.js';

// ─── Reference solutions ──────────────────────────────────────────────────────
const REFERENCE = {
  'sum-of-odd-numbers-in-an-array': (input) => {
    const d = input.trim().split(/\s+/);
    const n = Number(d[0]);
    return String(d.slice(1, 1 + n).map(Number).filter((x) => x % 2 !== 0).reduce((a, b) => a + b, 0));
  },
  'find-missing-number-in-an-array': (input) => {
    const d = input.trim().split(/\s+/);
    const n = Number(d[0]);
    const nums = d.slice(1, n).map(Number);
    const expected = (n * (n + 1)) / 2;
    return String(expected - nums.reduce((a, b) => a + b, 0));
  },
  'reverse-an-integer': (input) => {
    return String(input.trim()).split('').reverse().join('').replace(/^0+/, '') || '0';
  },
  'check-palindrome-number': (input) => {
    const x = Number(input.trim());
    return x >= 0 && String(x) === String(x).split('').reverse().join('')
      ? 'Palindrome'
      : 'Not Palindrome';
  },
  'search-element-in-array': (input) => {
    const d = input.trim().split(/\s+/);
    const n = Number(d[0]);
    const nums = d.slice(1, 1 + n).map(Number);
    const k = Number(d[1 + n]);
    return nums.includes(k) ? 'Found' : 'Not Found';
  },
  'find-second-largest-distinct-element-without-sorting': (input) => {
    const d = input.trim().split(/\s+/);
    const n = Number(d[0]);
    const nums = d.slice(1, 1 + n).map(Number);
    let largest = -Infinity;
    let second = -Infinity;
    for (const x of nums) {
      if (x > largest) { second = largest; largest = x; }
      else if (x < largest && x > second) { second = x; }
    }
    return String(second === -Infinity ? -1 : second);
  },
  'count-vowels-in-a-string': (input) => {
    const line = input.replace(/\r?\n$/, '');
    return String([...line].filter((c) => 'aeiouAEIOU'.includes(c)).length);
  },
  'move-all-zeros-to-the-end-of-an-array': (input) => {
    const d = input.trim().split(/\s+/);
    const n = Number(d[0]);
    const nums = d.slice(1, 1 + n).map(Number);
    return nums.filter((x) => x !== 0).concat(nums.filter((x) => x === 0)).join(' ');
  },
};

// ─── Runner ───────────────────────────────────────────────────────────────────
let failures = 0;
let checks = 0;

for (const problem of PROBLEMS) {
  const slug = problem.slug || problem.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  const ref = REFERENCE[slug];
  const cases = problem.testCases || [];

  if (!ref) {
    console.log(`SKIP  ${problem.title} - no reference solution registered`);
    failures += 1;
    continue;
  }

  const sampleCount = cases.filter((c) => !c.hidden).length;
  const hiddenCount = cases.filter((c) => c.hidden).length;
  let problemFailures = 0;

  for (const [i, tc] of cases.entries()) {
    checks += 1;
    let actual;
    try {
      actual = ref(tc.input);
    } catch (err) {
      actual = `THREW: ${err.message}`;
    }
    if (normalizeOutput(actual) !== normalizeOutput(tc.expectedOutput)) {
      problemFailures += 1;
      failures += 1;
      const label = tc.hidden ? 'hidden ' : 'sample ';
      console.log(`  FAIL ${problem.title} [${label}case ${i + 1}]`);
      console.log(`       input     ${JSON.stringify(tc.input)}`);
      console.log(`       expected  ${JSON.stringify(tc.expectedOutput)}`);
      console.log(`       reference ${JSON.stringify(actual)}`);
    }
  }

  if (problemFailures === 0) {
    console.log(`OK    ${problem.title}  (${sampleCount} sample, ${hiddenCount} hidden, ${cases.length} total)`);
  }
}

// ─── Extra invariants ─────────────────────────────────────────────────────────
console.log('');
const problems = PROBLEMS;

const expectedProblems = [
  ['Sum of Odd Numbers in an Array', 'easy', 5],
  ['Find Missing Number in an Array', 'easy', 7],
  ['Reverse Integer', 'easy', 10],
  ['Check Palindrome Number', 'easy', 12],
  ['Search Element in Array', 'easy', 15],
  ['Find Second Largest Distinct Element', 'easy', 16],
  ['Count Vowels in String', 'easy', 17],
  ['Move All Zeros To End', 'easy', 18],
];

for (const [index, [title, difficulty, points]] of expectedProblems.entries()) {
  const problem = problems[index];
  if (!problem || problem.title !== title || problem.difficulty !== difficulty || problem.points !== points) {
    console.log(`FAIL  Q${index + 1} must be "${title}" (${difficulty}, ${points} points)`);
    failures += 1;
  }
}

if (problems.length !== 8) {
  console.log(`FAIL  expected 8 problems, found ${problems.length}`);
  failures += 1;
}

const titles = new Set();
for (const p of problems) {
  if (titles.has(p.title)) {
    console.log(`FAIL  duplicate title: ${p.title}`);
    failures += 1;
  }
  titles.add(p.title);

  if (!p.starterCode || Object.keys(p.starterCode).length !== 7) {
    console.log(`FAIL  ${p.title}: starterCode must cover exactly 7 languages, found ${Object.keys(p.starterCode || {}).length}`);
    failures += 1;
  }
  for (const lang of ['python', 'java', 'javascript', 'c', 'cpp', 'csharp', 'go']) {
    if (!p.starterCode?.[lang] || p.starterCode[lang].trim().length < 20) {
      console.log(`FAIL  ${p.title}: starterCode.${lang} is missing or too short`);
      failures += 1;
    }
  }

  const cases = p.testCases || [];
  if (cases.filter((c) => !c.hidden).length < 1) {
    console.log(`FAIL  ${p.title}: needs at least one sample test case`);
    failures += 1;
  }
  if (cases.filter((c) => c.hidden).length < 2) {
    console.log(`FAIL  ${p.title}: needs at least two hidden test cases`);
    failures += 1;
  }

  // No sample case may duplicate a hidden case - otherwise "Run" leaks the answer.
  const sampleKey = new Set(cases.filter((c) => !c.hidden).map((c) => c.input));
  for (const h of cases.filter((c) => c.hidden)) {
    if (sampleKey.has(h.input)) {
      console.log(`FAIL  ${p.title}: hidden case duplicates a sample case (leaks the answer on Run)`);
      failures += 1;
    }
  }
}

// ─── Starter code must compile ────────────────────────────────────────────────
// WHY temp files instead of stdin: `python -m py_compile` and `javac` both
// REQUIRE a filename operand, and `g++ -x c++ -` (stdin) does not support every
// construct. Writing to the OS temp dir makes the check match what the real
// judge actually does — compile a file.
console.log('');
const TMP = os.tmpdir();
const OUT = (name) => path.join(TMP, name);
let stamp = Date.now();

// WHY per-language temp dirs instead of one shared dir: the C# check has to
// build a .csproj, and `dotnet build` resolves sibling project files relative to
// the project it is given. Sharing the dir with the .java/.c/.cpp scratch files
// would leave stray sources in the project directory.
const langTmp = (lang) => {
  const dir = OUT(`syn_verify_${lang}_${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const cleanupDir = (dir) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* A locked obj/ or bin/ from a killed build is not worth failing the run. */
  }
};

/**
 * C# has no single-file syntax-only mode: `dotnet build` requires a project, and
 * `csc` is not on PATH. So the check materialises a throwaway console project
 * around the starter source.
 *
 * WHY `<RestorePackages>false`: a bare `dotnet build` performs an implicit NuGet
 * restore, which needs network access. This check exists to prove the starter
 * COMPILES, and a starter is pure BCL code with no package references, so the
 * implicit restore buys nothing and turns the check into a network test that
 * fails on an air-gapped machine. Restore is only forced on the very first run
 * (when NuGet has never populated its cache) via the fallback in
 * compileCheck().
 */
const csharpProject = (code) => {
  const dir = langTmp('cs');
  const publicClass = (code.match(/public\s+(?:static\s+|sealed\s+|abstract\s+|partial\s+)*class\s+(\w+)/) || [, 'Program'])[1];

  // Top-level-statements C# starters (e.g. "Console.WriteLine(...)") contain no
  // class declaration at all, so name the file after the project instead.
  const fileName = /public\s+(?:static\s+|sealed\s+|abstract\s+|partial\s+)*class\s+\w+/.test(code)
    ? `${publicClass}.cs`
    : 'Program.cs';

  fs.writeFileSync(path.join(dir, fileName), code, 'utf8');
  fs.writeFileSync(
    path.join(dir, 'verify.csproj'),
    [
      '<Project Sdk="Microsoft.NET.Sdk">',
      '  <PropertyGroup>',
      '    <OutputType>Exe</OutputType>',
      '    <TargetFramework>net8.0</TargetFramework>',
      // Nullable/analyzers are irrelevant here and only add new warnings.
      '    <Nullable>disable</Nullable>',
      '    <EnableNETAnalyzers>false</EnableNETAnalyzers>',
      '    <GenerateDocumentationFile>false</GenerateDocumentationFile>',
      '    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>',
      '    <InvariantGlobalization>true</InvariantGlobalization>',
      '    <RestorePackages>false</RestorePackages>',
      '  </PropertyGroup>',
      '</Project>',
      '',
    ].join('\n'),
    'utf8'
  );

  return [dir, fileName];
};

// Each checker returns { cmd, args, outFile, cleanup } where outFile is the
// ABSOLUTE path the source must be written to (null when the checker writes its
// own files), and cleanup removes any temp artefacts the check created.
const LANG_CHECKERS = {
  python: () => ({
    cmd: 'python',
    args: ['-m', 'py_compile', OUT(`syn_verify_${stamp}.py`)],
    outFile: OUT(`syn_verify_${stamp}.py`),
  }),
  javascript: () => ({
    cmd: 'node',
    args: ['--check', OUT(`syn_verify_${stamp}.js`)],
    outFile: OUT(`syn_verify_${stamp}.js`),
  }),
  c: () => ({
    cmd: 'gcc',
    args: ['-fsyntax-only', OUT(`syn_verify_${stamp}.c`)],
    outFile: OUT(`syn_verify_${stamp}.c`),
  }),
  cpp: () => ({
    cmd: 'g++',
    args: ['-fsyntax-only', OUT(`syn_verify_${stamp}.cpp`)],
    outFile: OUT(`syn_verify_${stamp}.cpp`),
  }),
  // WHY the file name must equal the public class name: javac rejects
  // `public class Main` inside anything other than Main.java, and the judge
  // writes files using exactly this convention. Deriving the name from the
  // source keeps the check faithful to what the sandbox will do.
  java: (code) => {
    const publicClass = (code.match(/public\s+(?:final\s+|abstract\s+)?class\s+(\w+)/) || [, 'Main'])[1];
    const file = OUT(`${publicClass}.java`);
    return { cmd: 'javac', args: ['-d', TMP, file], outFile: file };
  },
  csharp: (code) => {
    const [dir, fileName] = csharpProject(code);
    return {
      cmd: 'dotnet',
      args: ['build', 'verify.csproj', '-nologo', '-v', 'q'],
      cwd: dir,
      outFile: null,
      fileName,
      // `dotnet build` ignores its output type, so this project must actually
      // produce an exe or the compile is not really proven.
      expectsOutput: 'verify.dll',
      cleanup: () => cleanupDir(dir),
    };
  },
  go: () => ({
    cmd: 'go',
    args: ['vet', OUT(`syn_verify_${stamp}.go`)],
    outFile: OUT(`syn_verify_${stamp}.go`),
  }),
};

/**
 * Detect "this toolchain isn't installed here" so it is reported as SKIP rather
 * than as a broken starter template.
 *
 * WHY this is fiddly: on Windows with `shell: true`, a missing binary is NOT
 * surfaced via `res.error` — the shell starts fine, prints "not recognised as an
 * internal or external command" to stderr and exits 1. Judging availability from
 * `res.error` alone would therefore report 40 false failures on a machine with
 * only Node and Python installed, which is exactly the machine this runs on.
 */
const TOOLCHAIN_ABSENT = /is not recognized as an internal or external command|No such file or directory|cannot find the file|command not found|is not installed|No .NET SDKs were found|The application .* does not exist/i;

const toolchainAvailable = (res) => {
  if (res.error) return false;
  const noise = `${res.stderr || ''}${res.stdout || ''}`;
  return !TOOLCHAIN_ABSENT.test(noise);
};

const compileCheck = (title, lang, spec, source) => {
  const { cmd, args, outFile, cwd, fileName, expectsOutput, cleanup } = spec;

  if (outFile) fs.writeFileSync(outFile, source, 'utf8');

  const run = () =>
    spawnSync(cmd, args, {
      encoding: 'utf8',
      timeout: 180000,
      cwd,
      shell: process.platform === 'win32',
    });

  let res = run();

  // The C# project sets <RestorePackages>false</RestorePackages> to stay
  // offline. On the very first run on a machine NuGet has never populated, the
  // targeting pack is missing and the build fails with MSB4019. That is a cold
  // cache, not a bad starter, so retry once WITH restore rather than reporting a
  // false failure.
  const COLD_NUGET_CACHE = /was not found\.?(?:\s|$)|MSB4019|Unable to find package/i;
  if (lang === 'csharp' && res.status !== 0 && toolchainAvailable(res)) {
    const noise = `${res.stderr || ''}${res.stdout || ''}`;
    if (COLD_NUGET_CACHE.test(noise)) {
      console.log(`      retrying ${title} [csharp] with an explicit restore (cold NuGet cache)`);
      res = run();
    }
  }

  if (outFile) fs.unlinkSync(outFile);
  if (cleanup) cleanup();

  if (!toolchainAvailable(res)) {
    console.log(`SKIP  ${title} [${lang}] - ${cmd} not installed on this machine`);
    return;
  }
  if (res.status !== 0) {
    console.log(`FAIL  ${title} [${lang}] starter code does not compile:`);
    console.log(`       ${(res.stderr || res.stdout || '').split('\n').filter(Boolean).slice(0, 6).join('\n       ')}`);
    failures += 1;
    return;
  }

  // WHY assert the artefact for C#: `dotnet build` can exit 0 having skipped the
  // compile (e.g. everything up to date, or a project that resolved to nothing).
  // Checking the expected output exists is what makes the exit code meaningful.
  if (expectsOutput) {
    const built = fs
      .readdirSync(cwd, { recursive: true })
      .some((entry) => String(entry).replace(/\\/g, '/').endsWith(expectsOutput));
    if (!built) {
      console.log(`FAIL  ${title} [${lang}] build reported success but produced no ${expectsOutput}`);
      failures += 1;
      return;
    }
  }

  console.log(`OK    ${title} [${lang}] starter compiles`);
};

for (const p of problems) {
  for (const [lang, checker] of Object.entries(LANG_CHECKERS)) {
    const source = p.starterCode[lang];
    // Bump AFTER building the spec: the paths are already baked in, but the next
    // checker must not collide with this one's temp files.
    const spec = checker(source);
    stamp += 1;
    compileCheck(p.title, lang, spec, source);
  }
}

console.log('');
console.log(`${checks} test cases checked across ${problems.length} problems.`);
if (failures === 0) {
  console.log('ALL CHECKS PASSED');
  process.exit(0);
}
console.log(`${failures} FAILURE(S)`);
process.exit(1);
