import React, { useState } from 'react';
import { FiCheckCircle, FiXCircle, FiAlertTriangle, FiTerminal } from 'react-icons/fi';

// ─── Status → presentation map ────────────────────────────────────────────────
// WHY a map instead of conditionals in JSX: the console renders judgements
// (accepted / wrong answer / compile error) and these carry a lot of copy. A
// single table keeps the wording, colour and icon in one place and makes an
// unhandled status a visible gap instead of a silent blank row.
const STATUS_META = {
  accepted: { label: 'Accepted', icon: FiCheckCircle, tone: 'success' },
  'wrong-answer': { label: 'Wrong Answer', icon: FiXCircle, tone: 'danger' },
  partial: { label: 'Partially Correct', icon: FiAlertTriangle, tone: 'warning' },
  'runtime-error': { label: 'Runtime Error', icon: FiAlertTriangle, tone: 'danger' },
  'compile-error': { label: 'Compilation Error', icon: FiAlertTriangle, tone: 'danger' },
  'time-limit-exceeded': { label: 'Time Limit Exceeded', icon: FiAlertTriangle, tone: 'warning' },
  'internal-error': { label: 'Judging Error', icon: FiAlertTriangle, tone: 'muted' },
  'not-attempted': { label: 'Not Attempted', icon: FiAlertTriangle, tone: 'muted' },
  'not-evaluated': { label: 'Not Evaluated', icon: FiAlertTriangle, tone: 'warning' },
  ok: { label: 'Executed', icon: FiCheckCircle, tone: 'success' },
};

const TONE_COLOR = {
  success: 'var(--success)',
  danger: 'var(--danger)',
  warning: '#F59E0B',
  muted: 'var(--text-muted)',
};

/**
 * Execution console: verdict header, then stdout / stderr for the selected run.
 * Hidden test cases deliberately show pass/fail only — the server nulls their
 * input and expected output, and this component must not imply otherwise.
 */
const CodeConsole = ({ result, running, error, className = '' }) => {
  const [tab, setTab] = useState('output');

  if (running) {
    return (
      <div className={`code-console ${className}`}>
        <div className="code-console-header">
          <span className="code-console-title"><FiTerminal /> Console</span>
          <span className="code-console-status code-console-status--running">
            <span className="console-spinner" aria-hidden="true" /> Running…
          </span>
        </div>
        <div className="code-console-body code-console-body--placeholder">
          Compiling and executing your code. This can take a few seconds on a cold sandbox.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`code-console ${className}`}>
        <div className="code-console-header">
          <span className="code-console-title"><FiTerminal /> Console</span>
          <span className="code-console-status" style={{ color: 'var(--danger)' }}>Error</span>
        </div>
        <div className="code-console-body">
          <pre className="console-stderr">{error}</pre>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={`code-console ${className}`}>
        <div className="code-console-header">
          <span className="code-console-title"><FiTerminal /> Console</span>
        </div>
        <div className="code-console-body code-console-body--placeholder">
          Press <kbd>Run</kbd> to execute your code against the sample test cases.
        </div>
      </div>
    );
  }

  // WHY this lookup is defensive rather than `STATUS_META[result.status] ||`:
  // the server is the source of truth for these keys, and it may add one (or a
  // provider may pass a raw status through). `meta` is dereferenced on the very
  // next line, so a missing key would throw and blank the whole console instead
  // of degrading to the generic "Judging Error" row.
  const meta = STATUS_META[result.status] ?? STATUS_META['internal-error'];
  const StatusIcon = meta.icon;
  const cases = result.cases || [];
  const firstFailure = cases.find((c) => !c.passed) || cases[0] || {};
  // WHY fall back to `message`: after a Submit, a failing HIDDEN case has its
  // output/error nulled server-side, so the per-case fields are legitimately
  // empty. `message` is the first real diagnostic the grader could produce
  // (compile error, sandbox error) and is the only actionable text in that case.
  const errorText = firstFailure.error || result.message || '';
  const output = tab === 'output' ? (firstFailure.output ?? '') : errorText;

  return (
    <div className={`code-console ${className}`}>
      <div className="code-console-header">
        <span className="code-console-title"><FiTerminal /> Console</span>
        <span className="code-console-status" style={{ color: TONE_COLOR[meta.tone] }}>
          <StatusIcon aria-hidden="true" /> {meta.label}
        </span>
        <div className="code-console-metrics">
          {typeof result.executionTime === 'number' && result.executionTime > 0 && (
            <span className="code-console-time">Runtime {result.executionTime} ms</span>
          )}
          {typeof result.memoryUsageKB === 'number' && result.memoryUsageKB > 0 && (
            <span className="code-console-time">Memory {result.memoryUsageKB} KB</span>
          )}
          {typeof result.passedCases === 'number' && typeof result.failedCases === 'number' && (
            <span className="code-console-time">
              {result.passedCases} passed · {result.failedCases} failed
              {result.fullAssessment && typeof result.totalTests === 'number' ? ` · ${result.totalTests} assessment tests` : ''}
            </span>
          )}
        </div>
      </div>

      {cases.length > 0 && (
        <div className="code-console-tabs" role="tablist" aria-label="Console output">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'output'}
            className={tab === 'output' ? 'is-active' : ''}
            onClick={() => setTab('output')}
          >
            Output
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'error'}
            className={tab === 'error' ? 'is-active' : ''}
            onClick={() => setTab('error')}
          >
            Errors {errorText ? `(${firstFailure.status || result.status})` : ''}
          </button>
        </div>
      )}

      <div className="code-console-body">
        {output
          ? <pre className={tab === 'error' ? 'console-stderr' : 'console-stdout'}>{output}</pre>
          : (
            <span className="code-console-body--placeholder">
              {tab === 'error'
                ? (firstFailure.status === 'ok' ? 'No errors — your program ran to completion.' : 'No error message was reported.')
                : 'Your program printed nothing.'}
            </span>
          )}      </div>
    </div>
  );
};

export default CodeConsole;
