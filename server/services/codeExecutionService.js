import axios from 'axios';
import logger from '../config/logger.js';
import { getLanguage, LANGUAGE_KEYS } from '../config/languages.js';

// ─── Coding Module · Code Execution Service ───────────────────────────────────
// WHY: User-submitted source NEVER touches this process. It is forwarded to an
// isolated third-party sandbox (Judge0 or Piston) that owns the compilers and
// the kernel-level containment. This service is deliberately a thin, well-tested
// adapter: provider quirks, auth, base64 transport, timeouts, output caps and
// status normalisation all live here so controllers stay free of vendor detail.
//
// Provider is selected by CODE_EXECUTION_PROVIDER = judge0 | piston.
// If it is unset or unknown the module reports "unconfigured" instead of
// throwing, so the rest of the platform (and the UI) still boots cleanly.

const PROVIDER = (process.env.CODE_EXECUTION_PROVIDER || 'piston').trim().toLowerCase();
const SUPPORTED_PROVIDERS = ['judge0', 'piston'];
const PISTON_DEFAULT_URL = 'https://emkc.org/api/v2/piston';
const PISTON_PUBLIC_HOST = 'emkc.org';

// WHY: hard ceilings. Without them a user can submit an infinite loop and
// occupy a sandbox slot (cost/rate-limit) far longer than a legitimate
// compile+run needs, and a program that prints gigabytes would blow up our
// response size before the provider's own limit kicks in.
const REQUEST_TIMEOUT_MS = Number(process.env.CODE_EXEC_TIMEOUT_MS) || 20000;
const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 700;
const MAX_OUTPUT_BYTES = 32 * 1024;
const MAX_SOURCE_BYTES = 64 * 1024;

const clampOutput = (value) => {
  if (typeof value !== 'string') return '';
  if (value.length <= MAX_OUTPUT_BYTES) return value;
  return `${value.slice(0, MAX_OUTPUT_BYTES)}\n... [output truncated]`;
};

const decode = (value) => {
  if (value === null || value === undefined || value === '') return '';
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    // Provider may ignore base64_encoded for some fields — fall back to raw.
    return String(value);
  }
};

const encode = (value) => Buffer.from(value ?? '', 'utf8').toString('base64');

const isConfigured = () => {
  if (!SUPPORTED_PROVIDERS.includes(PROVIDER)) return false;
  if (PROVIDER === 'piston') {
    const endpoint = process.env.PISTON_API_URL || PISTON_DEFAULT_URL;
    try {
      return new URL(endpoint).hostname !== PISTON_PUBLIC_HOST;
    } catch {
      return false;
    }
  }
  if (process.env.JUDGE0_API_KEY) return true;
  const url = process.env.JUDGE0_API_URL;
  return Boolean(url && !url.includes('rapidapi.com'));
};

// ─── HTTP clients (created lazily so env is fully loaded and connections are
// pooled only when the module is actually used) ───────────────────────────────
let judge0Client = null;
let pistonClient = null;

const getJudge0Client = () => {
  if (judge0Client) return judge0Client;
  // WHY: a self-hosted Judge0 needs no key and no RapidAPI host header, which is
  // why both are conditional rather than hardcoded.
  judge0Client = axios.create({
    baseURL: process.env.JUDGE0_API_URL || 'https://ce.judge0.com',
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      'content-type': 'application/json',
      ...(process.env.JUDGE0_API_KEY ? { 'X-RapidAPI-Key': process.env.JUDGE0_API_KEY } : {}),
      ...(process.env.JUDGE0_HOST ? { 'X-RapidAPI-Host': process.env.JUDGE0_HOST } : {}),
    },
  });
  return judge0Client;
};

const getPistonClient = () => {
  if (pistonClient) return pistonClient;
  pistonClient = axios.create({
    baseURL: process.env.PISTON_API_URL || PISTON_DEFAULT_URL,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'content-type': 'application/json' },
  });
  return pistonClient;
};

// ─── Judge0 status id → normalised status ─────────────────────────────────────
// WHY: Judge0 has 14 discrete status ids. Mapping them here (once) instead of
// in the grader means the grader only ever deals with 5 semantic outcomes.
const JUDGE0_STATUS_MAP = {
  3: 'ok',
  4: 'wrong-answer',
  5: 'time-limit-exceeded',
  6: 'compile-error',
  7: 'runtime-error', // SIGSEGV
  8: 'runtime-error', // SIGXFSZ
  9: 'runtime-error', // SIGFPE
  10: 'runtime-error', // SIGABRT
  11: 'runtime-error', // NZEC
  12: 'runtime-error', // Other
  13: 'internal-error',
  14: 'runtime-error', // Exec Format Error
};

const judge0Run = async ({ meta, code, stdin, timeLimitMs }) => {
  const client = getJudge0Client();
  const payload = {
    language_id: meta.judge0Id,
    source_code: encode(code),
    stdin: encode(stdin),
    cpu_time_limit: Math.ceil((timeLimitMs || 5000) / 1000),
    wall_time_limit: Math.ceil((timeLimitMs || 5000) / 1000) + 1,
    memory_limit: 128000, // KB — Judge0's hard ceiling is 128 MB
  };

  let data = (
    await client.post('/submissions?base64_encoded=true&wait=true', payload)
  ).data;

  // WHY: `wait=true` is best-effort. Under load the provider can still return
  // { token } with status "In Queue". Polling is what makes RUN CODE reliable
  // instead of intermittently showing an empty console.
  const isPending = !data.status || (data.status && data.status.id <= 2);
  if (isPending && data.token) {
    for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      // eslint-disable-next-line no-await-in-loop
      data = (await client.get(`/submissions/${data.token}?base64_encoded=true`)).data;
      if (data.status && data.status.id > 2) break;
    }
  }

  const statusId = data?.status?.id;
  const compileOutput = clampOutput(decode(data.compile_output));
  const stdout = clampOutput(decode(data.stdout));
  const stderr = clampOutput(decode(data.stderr));
  const message = clampOutput(decode(data.message));

  let status = JUDGE0_STATUS_MAP[statusId] || 'internal-error';
  if (!data.status) status = 'internal-error';

  let error = compileOutput || message || stderr || '';
  if (status === 'time-limit-exceeded' && !error) error = 'Time limit exceeded.';

  return {
    status,
    output: status === 'ok' ? stdout : '',
    error: error.trim(),
    exitCode: typeof data.exit_code === 'number' ? data.exit_code : null,
    // Judge0 reports CPU seconds as a string; the rest of the platform uses ms.
    executionTime: data.time ? Math.round(Number(data.time) * 1000) : 0,
    memoryUsageKB: Number.isFinite(Number(data.memory)) ? Math.max(0, Number(data.memory)) : 0,
  };
};

// ─── Piston ───────────────────────────────────────────────────────────────────
const pistonRun = async ({ meta, code, stdin, timeLimitMs }) => {
  const client = getPistonClient();
  const limit = timeLimitMs || 5000;
  const { data } = await client.post('/execute', {
    language: meta.piston.language,
    version: meta.piston.version,
    files: [{ name: meta.filename, content: code }],
    stdin: stdin ?? '',
    run_timeout: limit,
    run_cpu_time: limit,
    compile_timeout: Math.max(10000, Math.ceil(limit * 2)),
    compile_cpu_time: Math.max(10000, Math.ceil(limit * 2)),
    // WHY: Piston reports the process exit code but distinguishes compile
    // failure via the presence of a `compile` stage with a non-zero code.
    compile_memory_limit: Number(process.env.CODE_MEMORY_LIMIT_BYTES) || 134217728,
    run_memory_limit: Number(process.env.CODE_MEMORY_LIMIT_BYTES) || 134217728,
  });

  const run = data?.run || {};
  const compile = data?.compile || {};
  const runStatus = String(run.status || '').toUpperCase();
  const compileStatus = String(compile.status || '').toUpperCase();
  const compileFailed = data?.compile && (compile.code !== 0 || compile.signal);
  const timedOut = runStatus === 'TO' || compileStatus === 'TO' ||
    ['SIGKILL', 'SIGTERM'].includes(run.signal) || ['SIGKILL', 'SIGTERM'].includes(compile.signal) ||
    (data.message || '').toLowerCase().includes('timed out');

  let status = 'ok';
  let error = '';

  if (timedOut) {
    status = 'time-limit-exceeded';
    error = `Time limit exceeded (${limit} ms).`;
  } else if (compileFailed) {
    status = 'compile-error';
    error = clampOutput(compile.stderr || compile.stdout || 'Compilation failed.');
  } else if (runStatus === 'XX' || !data?.run) {
    status = 'internal-error';
    error = clampOutput(run.stderr || run.message || data?.message || 'Piston returned no execution result.');
  } else if (run.signal || ['RE', 'SG', 'OL', 'EL'].includes(runStatus) || (run.code !== undefined && run.code !== 0)) {
    status = 'runtime-error';
    error = clampOutput(run.stderr || run.message || run.output || `Process exited with code ${run.code ?? 'unknown'}.`);
  }

  return {
    status,
    output: status === 'ok' ? clampOutput(run.stdout || '') : '',
    error: error.trim(),
    exitCode: typeof run.code === 'number' ? run.code : null,
    executionTime: Number.isFinite(Number(run.wall_time)) ? Math.round(Number(run.wall_time)) : 0,
    memoryUsageKB: Number.isFinite(Number(run.memory)) ? Math.max(0, Math.ceil(Number(run.memory) / 1024)) : 0,
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute one program once against a single stdin payload.
 * Never throws for user-code failures — those are returned as a status.
 * Throws only for infrastructure problems (bad language, source too large).
 */
export const runOnce = async ({ language, code, stdin = '', timeLimitMs = 5000 }) => {
  const meta = getLanguage(language);
  if (!meta) {
    const err = new Error(`Unsupported language: ${language}`);
    err.status = 400;
    throw err;
  }
  if (typeof code !== 'string' || code.trim() === '') {
    const err = new Error('Code is empty');
    err.status = 400;
    throw err;
  }
  if (Buffer.byteLength(code, 'utf8') > MAX_SOURCE_BYTES) {
    const err = new Error('Code exceeds the maximum allowed size');
    err.status = 400;
    throw err;
  }

  if (!SUPPORTED_PROVIDERS.includes(PROVIDER)) {
    const err = new Error(`Unsupported code execution provider: ${PROVIDER}`);
    err.status = 503;
    throw err;
  }
  if (!isConfigured()) {
    const err = new Error(
      PROVIDER === 'piston'
        ? 'The public Piston API is restricted. Set PISTON_API_URL to a reachable self-hosted Piston API.'
        : 'Code execution is not configured. Set JUDGE0_API_URL to a reachable Judge0 API.'
    );
    err.status = 503;
    throw err;
  }
  if (PROVIDER === 'piston') return pistonRun({ meta, code, stdin, timeLimitMs });
  return judge0Run({ meta, code, stdin, timeLimitMs });
};

/**
 * Run the same program against N independent inputs.
 *
 * WHY bounded concurrency instead of Promise.all: every case is a separate
 * sandbox invocation, so an unbounded fan-out would trip the provider's rate
 * limiter and get the whole user throttled. Batches of 3 keep latency low
 * without hammering the upstream quota. A 60 s budget caps worst case for a
 * submission with many hidden cases.
 */
export const runBatch = async ({ language, code, inputs, timeLimitMs = 5000, concurrency = 3, budgetMs = 60000 }) => {
  const startedAt = Date.now();
  const list = Array.isArray(inputs) ? inputs : [];
  const results = new Array(list.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      if (Date.now() - startedAt > budgetMs) {
        results[index] = {
          status: 'internal-error',
          output: '',
          error: 'Judging timed out — too many test cases to process in time.',
          exitCode: null,
          executionTime: 0,
          memoryUsageKB: 0,
        };
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        results[index] = await runOnce({ language, code, stdin: list[index], timeLimitMs });
      } catch (err) {
        logger.error(`Execution failed [${language}]: ${err.message}`);
        const statusCode = err.response?.status;
        let error = 'Sandbox error. Please try again.';
        if (PROVIDER === 'judge0' && (statusCode === 429 || !err.response)) {
          error = 'Judge0 is busy, try again';
        } else if (statusCode === 401 || statusCode === 403) {
          error = `The ${PROVIDER} provider rejected its credentials or host configuration.`;
        } else if (statusCode === 429) {
          error = 'The execution provider rate limit was reached. Try again shortly.';
        } else if (statusCode >= 500) {
          error = 'The execution provider is temporarily unavailable. Try again shortly.';
        } else if (statusCode === 400) {
          error = clampOutput(err.response?.data?.message || 'The execution provider rejected this runtime request.');
        } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
          error = 'The execution provider request timed out. Try again shortly.';
        }
        results[index] = {
          status: 'internal-error',
          output: '',
          error,
          exitCode: null,
          executionTime: 0,
          memoryUsageKB: 0,
        };
      }
    }
  };

  const workerCount = PROVIDER === 'judge0'
    ? 1
    : Math.min(concurrency, Math.max(1, list.length));
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
};

export const getExecutionStatus = () => ({
  provider: SUPPORTED_PROVIDERS.includes(PROVIDER) ? PROVIDER : 'unknown',
  configured: isConfigured(),
  languages: LANGUAGE_KEYS,
});

// Named export as well as default: codingSubmissionController imports
// { getExecutionStatus, isConfigured } directly, and an import of a symbol that
// only exists on `default` fails at module-load time — i.e. the whole server
// refuses to boot, with an error that points at the import line rather than the
// missing export.
export { isConfigured };

export default { runOnce, runBatch, getExecutionStatus, isConfigured };
