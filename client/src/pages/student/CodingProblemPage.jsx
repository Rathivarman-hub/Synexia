import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { getChangedCodeLength, isStarterCode } from '../../lib/starterCodeValidation';
import MonacoEditor from '../../components/MonacoEditor';
import CodeConsole from '../../components/CodeConsole';
import { DifficultyBadge } from '../../components/DifficultyBadge';
import ProblemNavigator from '../../components/ProblemNavigator';
import InlineSpinner from '../../components/InlineSpinner';
import { useAssessmentSession } from '../../context/AssessmentSessionContext';
import { useElapsedTimer, useProblemTimeTracker, formatElapsed } from '../../hooks/useElapsedTimer';
import {
  FiChevronLeft, FiPlay, FiUploadCloud, FiRotateCcw, FiCopy, FiCheck, FiX,
  FiAlertTriangle, FiCode, FiList, FiHelpCircle, FiInbox, FiClock, FiAlertCircle,
} from 'react-icons/fi';
import './CodingProblemPage.css';

const DRAFT_PREFIX = 'syn-coding-draft:v2:';
const VERDICT = {
  accepted: { tone: 'success', icon: FiCheck },
  'wrong-answer': { tone: 'danger', icon: FiX },
  partial: { tone: 'warning', icon: FiAlertTriangle },
  'compile-error': { tone: 'danger', icon: FiAlertTriangle },
  'runtime-error': { tone: 'danger', icon: FiAlertTriangle },
  'time-limit-exceeded': { tone: 'warning', icon: FiAlertTriangle },
  'internal-error': { tone: 'muted', icon: FiAlertCircle },
  ok: { tone: 'success', icon: FiCheck },
};
const MIN_EDITOR_HEIGHT = 250;
const MIN_CONSOLE_HEIGHT = 120;
const MAX_CONSOLE_RATIO = 0.6;

const draftKey = (slug, language, isDebugging = false) =>
  `${isDebugging ? 'syn-debug-draft:v1:' : DRAFT_PREFIX}${slug}:${language}`;
const MIN_SOLUTION_CHANGE = 20;

/** Monospace, whitespace-preserving rendering of a multi-line I/O example. */
const CodeBlock = ({ text }) => <pre className="coding-io-block">{text === '' ? <em>(empty)</em> : text}</pre>;

const CodingProblemPage = ({ isDebugging = false }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { registerAutoSubmit } = useAssessmentSession();

  const [problem, setProblem] = useState(null);
  const [language, setLanguage] = useState('python');
  // codeByLanguage keeps every language's draft alive across switches. A single
  // `code` string would silently discard the C++ solution the moment a student
  // peeked at the Python starter.
  const [codeByLanguage, setCodeByLanguage] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState('description');
  // The rail is a fixed third of the workspace, so on a laptop it competes with
  // the editor. Defaulting it open on desktop and closed below 1200px keeps the
  // editor full-width where space is tight.
  const [navCollapsed, setNavCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1200
  );
  const [consoleHeight, setConsoleHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const editorPaneRef = useRef(null);
  const editorRef = useRef(null);
  const resizeStartRef = useRef(null);

  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consoleError, setConsoleError] = useState('');

  const [execution, setExecution] = useState(null);
  const [problemLocked, setProblemLocked] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [guardDialog, setGuardDialog] = useState(null);

  // ─── Timers ────────────────────────────────────────────────────────────────
  // Session timer: total time in the workspace. Problem timer: per-problem time,
  // which is what the rail displays and what a submission reports.
  const { elapsedMs: sessionMs } = useElapsedTimer({ running: true });
  const { timeSpentByProblem, liveSeconds } = useProblemTimeTracker(slug);

  // WHY a ticking clock value held in state rather than reading performance.now()
  // during render: the navigator also displays the live segment for the problem
  // being worked on, and a render-only read would freeze it at whatever value the
  // last unrelated re-render happened to see. One shared tick keeps the header
  // timer and the rail in lockstep, and it uses the same time base as
  // useProblemTimeTracker (both are performance.now()) so the two never disagree.
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const problemSeconds = problem ? liveSeconds(problem._id, now) : 0;

  const handleResizePointerMove = useCallback((event) => {
    const start = resizeStartRef.current;
    const paneHeight = editorPaneRef.current?.clientHeight || 0;
    if (!start || !paneHeight) return;

    const maxConsoleHeight = Math.max(
      MIN_CONSOLE_HEIGHT,
      Math.min(Math.floor(paneHeight * MAX_CONSOLE_RATIO), paneHeight - MIN_EDITOR_HEIGHT)
    );
    const nextHeight = start.height - (event.clientY - start.y);
    setConsoleHeight(Math.min(maxConsoleHeight, Math.max(MIN_CONSOLE_HEIGHT, nextHeight)));
  }, []);

  const stopResize = useCallback(() => {
    resizeStartRef.current = null;
    setIsResizing(false);
  }, []);

  const startResize = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resizeStartRef.current = { y: event.clientY, height: consoleHeight };
    setIsResizing(true);
  }, [consoleHeight]);

  useEffect(() => {
    if (!isResizing) return undefined;
    window.addEventListener('pointermove', handleResizePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
    return () => {
      window.removeEventListener('pointermove', handleResizePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
  }, [isResizing, handleResizePointerMove, stopResize]);

  useEffect(() => {
    editorRef.current?.layout();
  }, [consoleHeight]);

  // WHY a ref for "is this the newest run": a student can hit Run twice quickly,
  // and the slower response must not overwrite the newer verdict.
  const runSeq = useRef(0);

  const code = codeByLanguage[language] ?? '';
  const originalStarterCode = problem?.starterCode?.[language] ?? '';
  const starterUnmodified = isStarterCode(code, originalStarterCode);
  const changedCodeLength = getChangedCodeLength(code, originalStarterCode);
  const setCode = useCallback((next) => {
    setCodeByLanguage((prev) => ({ ...prev, [language]: next }));
  }, [language]);

  // ─── Load the problem ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setRunResult(null);
    setSubmitResult(null);
    setConsoleError('');

    api.get(
      isDebugging ? `/debugging/problems/${slug}` : `/coding/problems/${slug}`,
      isDebugging ? { params: { language: 'python' } } : undefined
    )
      .then(({ data }) => {
        if (cancelled) return;
        const loaded = isDebugging
          ? {
            ...data.data,
            statement: data.data.description,
            testCases: data.data.visibleTestCases || [],
            starterCode: data.data.languageTemplates || {},
            starterCodeTemplates: data.data.languageTemplates || {},
          }
          : data.data;
        setProblem(loaded);
        setProblemLocked((loaded.totalAttempts || 0) > 0);

        // Replace an unchanged generic-template draft from older sessions with
        // the problem-specific starter code; keep any student-edited draft.
        const restored = {};
        const starters = loaded.starterCode || {};
        const templates = loaded.starterCodeTemplates || {};
        (isDebugging ? [{ key: 'python' }] : loaded.languages || []).forEach((l) => {
          let saved = '';
          try { saved = localStorage.getItem(draftKey(slug, l.key, isDebugging)) || ''; } catch { saved = ''; }
          restored[l.key] = saved && !isStarterCode(saved, templates[l.key])
            ? saved
            : starters[l.key] || '';
        });
        setCodeByLanguage(restored);
        setLanguage('python');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.response?.data?.message || 'Problem not found.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug, isDebugging]);

  // ─── Persist drafts ─────────────────────────────────────────────────────────
  // WHY debounced: writing localStorage on every keystroke is a synchronous
  // main-thread disk write and makes typing feel sticky on a large file.
  useEffect(() => {
    if (!problem || !code) return undefined;
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey(slug, language, isDebugging), code); } catch { /* quota / private mode */ }
    }, 800);
    return () => clearTimeout(t);
  }, [code, language, problem, slug, isDebugging]);

  // ─── Sandbox health ─────────────────────────────────────────────────────────
  // Checked once per problem view. If the sandbox is unconfigured the Run and
  // Submit buttons are disabled with an explanation, instead of letting the
  // student type a full solution and only then hit a 503.
  useEffect(() => {
    let cancelled = false;
    api.get('/coding/execution-status')
      .then(({ data }) => { if (!cancelled) setExecution(data.data); })
      .catch(() => { if (!cancelled) setExecution({ configured: false, provider: 'unknown' }); });
    return () => { cancelled = true; };
  }, []);

  const languages = problem?.languages || [];
  const currentLanguageLabel = languages.find((l) => l.key === language)?.label || language;
  const sandboxDown = execution !== null && execution.configured === false;

  const selectLanguage = async (nextLanguage) => {
    setShowLanguageMenu(false);
    if (isDebugging && !problem?.starterCode?.[nextLanguage]) {
      try {
        const { data } = await api.get(`/debugging/problems/${slug}`, { params: { language: nextLanguage } });
        const template = data.data.languageTemplates?.[nextLanguage] || '';
        setProblem((current) => ({
          ...current,
          starterCode: { [nextLanguage]: template },
          starterCodeTemplates: { [nextLanguage]: template },
        }));
        setCodeByLanguage((current) => {
          if (current[nextLanguage] !== undefined) return current;
          let saved = '';
          try { saved = localStorage.getItem(draftKey(slug, nextLanguage, true)) || ''; } catch { saved = ''; }
          return { ...current, [nextLanguage]: saved && !isStarterCode(saved, template) ? saved : template };
        });
      } catch (err) {
        toast.error(err.response?.data?.message || `Could not load the ${nextLanguage} template.`);
        return;
      }
    }
    setLanguage(nextLanguage);
    setRunResult(null);
    setSubmitResult(null);
  };

  const handleApiError = useCallback((err, fallback) => {
    const message = err.response?.data?.message || fallback;
    setConsoleError(message);
    if (err.response?.status === 409 && message.includes('already been submitted')) {
      setProblemLocked(true);
    }
    if (err.response?.status === 503) setExecution({ ...(execution || {}), configured: false });
    toast.error(message);
  }, [execution]);

  // ─── Run: sample cases only, never scored ──────────────────────────────────
  const executeRun = useCallback(async () => {
    if (!problem || running || problemLocked) return;
    if (!code.trim()) {
      toast.error('Write some code before running.');
      return;
    }

    const seq = runSeq.current + 1;
    runSeq.current = seq;

    setRunning(true);
    setConsoleError('');
    setSubmitResult(null);
    try {
      const { data } = await api.post(isDebugging ? '/debugging/run' : '/coding/run', { problemId: problem._id, language, code });
      if (runSeq.current !== seq) return; // a newer run superseded this one
      setRunResult(data.data);
    } catch (err) {
      if (runSeq.current !== seq) return;
      handleApiError(err, 'Execution failed.');
    } finally {
      if (runSeq.current === seq) setRunning(false);
    }
  }, [problem, running, problemLocked, code, language, handleApiError, isDebugging]);

  // ─── Submit: samples + hidden cases, scored and ranked ─────────────────────
  const executeSubmit = useCallback(async ({ assessment: assessmentMeta = {}, codeOverride } = {}) => {
    if (!problem || submitting || problemLocked) return;
    const submissionCode = codeOverride ?? code;
    if (!submissionCode.trim()) {
      toast.error('Write some code before submitting.');
      return;
    }

    setSubmitting(true);
    setConsoleError('');
    setRunResult(null);
    try {
      const { data } = await api.post(isDebugging ? '/debugging/submit' : '/coding/submit', {
        problemId: problem._id,
        language,
        code: submissionCode,
        assessment: assessmentMeta,
      });
      setSubmitResult(data.data);
      // WHY re-fetch: the server just changed this problem's acceptance rate and
      // the student's Status pill. Keeping the stale copy would leave the page
      // claiming "Not attempted" on a problem they just solved.
      try {
        const { data: fresh } = await api.get(
          isDebugging ? `/debugging/problems/${slug}` : `/coding/problems/${slug}`,
          isDebugging ? { params: { language } } : undefined
        );
        const loaded = isDebugging
          ? {
            ...fresh.data,
            statement: fresh.data.description,
            testCases: fresh.data.visibleTestCases || [],
            starterCode: fresh.data.languageTemplates || {},
            starterCodeTemplates: fresh.data.languageTemplates || {},
          }
          : fresh.data;
        setProblem(loaded);
        setProblemLocked((loaded.totalAttempts || 0) > 0);
      } catch { /* non-fatal: the verdict is already on screen */ }
    } catch (err) {
      handleApiError(err, 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }, [problem, submitting, problemLocked, code, language, slug, handleApiError, isDebugging]);

  const submitAssessmentAfterWarning = useCallback(async (assessment) => {
    if (!problem) return;
    const submissionCode = code.trim() ? code : originalStarterCode;
    if (!submissionCode.trim()) return;
    await executeSubmit({ assessment: { ...assessment, reason: 'warning-limit' }, codeOverride: submissionCode });
  }, [problem, code, originalStarterCode, executeSubmit]);

  useEffect(() => registerAutoSubmit(submitAssessmentAfterWarning), [registerAutoSubmit, submitAssessmentAfterWarning]);

  const guardAction = useCallback((action) => {
    if (starterUnmodified) {
      setGuardDialog({ kind: 'starter', action });
      toast.info('Modify the starter code before running or submitting.');
      return true;
    }
    if (changedCodeLength < MIN_SOLUTION_CHANGE) {
      setGuardDialog({ kind: 'short', action });
      toast.warning('Your solution appears incomplete.');
      return true;
    }
    return false;
  }, [starterUnmodified, changedCodeLength]);

  const handleRun = useCallback(() => {
    if (!problem || running || problemLocked) return;
    if (!code.trim()) {
      toast.error('Write some code before running.');
      return;
    }
    if (guardAction('run')) return;
    void executeRun();
  }, [problem, running, problemLocked, code, guardAction, executeRun]);

  const handleSubmit = useCallback(() => {
    if (!problem || submitting || problemLocked) return;
    if (!code.trim()) {
      toast.error('Write some code before submitting.');
      return;
    }
    if (guardAction('submit')) return;
    void executeSubmit();
  }, [problem, submitting, problemLocked, code, guardAction, executeSubmit]);

  const continueAfterWarning = useCallback(() => {
    const pendingAction = guardDialog?.action;
    setGuardDialog(null);
    if (guardDialog?.kind !== 'short') return;
    if (pendingAction === 'run') void executeRun();
    if (pendingAction === 'submit') void executeSubmit();
  }, [guardDialog, executeRun, executeSubmit]);

  useEffect(() => {
    if (!guardDialog) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setGuardDialog(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [guardDialog]);

  // ─── Keyboard shortcuts (also bound to F9 / F12 inside Monaco) ─────────────
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit]);

  const verdict = useMemo(() => {
    if (!submitResult) return null;
    const meta = VERDICT[submitResult.status] || VERDICT.internalError;
    return { ...meta, ...submitResult };
  }, [submitResult]);

  // Ordered catalogue of every published problem, lifted up from the navigator.
  // WHY the rail owns it: the rail already loads the ordered list, and duplicating
  // the request here would mean two round-trips for one list. The parent only
  // needs the order for previous/next.
  const [catalog, setCatalog] = useState([]);

  // ─── Prev / next across the whole set ──────────────────────────────────────
  // WHY navigate() rather than a Link: previous/next has to be a no-op at the two
  // ends of the list, and the "Next problem" button in the verdict has to be
  // hidden when there is no next problem — neither is expressible with a plain
  // <Link to> that always renders.
  const neighbour = useCallback(
    (delta) => {
      const idx = catalog.findIndex((p) => p.slug === slug);
      if (idx === -1) return null;
      return catalog[idx + delta] || null;
    },
    [catalog, slug]
  );

  const goToNeighbour = useCallback(
    (delta) => {
      const target = neighbour(delta);
      if (target) navigate(`/${isDebugging ? 'debugging' : 'coding'}/problems/${target.slug}`);
    },
    [neighbour, navigate, isDebugging]
  );

  const prevProblem = neighbour(-1);
  const nextProblem = neighbour(1);

  // Arrow-key navigation, but ONLY when focus is not inside the editor: Monaco
  // owns the arrow keys for cursor movement, and stealing them would break
  // writing code.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.altKey && e.shiftKey)) return;
      const t = e.target;
      // Monaco renders its input into a textarea; bail out for any editable-ish
      // target so Alt+Shift+Arrow still works from anywhere else on the page.
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); goToNeighbour(-1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); goToNeighbour(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goToNeighbour]);

  if (loading) {
    return <div className="coding-center coding-center-full"><InlineSpinner /></div>;
  }

  if (loadError) {
    return (
      <div className="coding-center coding-center-full">
        <FiAlertCircle size={40} color="var(--danger)" />
        <h3>{loadError}</h3>
        <Link to={isDebugging ? '/debugging/problems' : '/coding/problems'} className="btn-outline-techiz">
          <FiChevronLeft /> Back to problems
        </Link>
      </div>
    );
  }

  return (
    <div className="coding-workspace">
      {/* ─── Far left: question navigator ─── */}
      <ProblemNavigator
        collapsed={navCollapsed}
        onToggle={() => setNavCollapsed((v) => !v)}
        timeSpentByProblem={timeSpentByProblem}
        liveSeconds={liveSeconds}
        now={now}
        onCatalogLoaded={setCatalog}
        isDebugging={isDebugging}
      />

      {/* ─── Centre: problem statement ─── */}
      <section className="coding-pane coding-pane--statement" aria-label="Problem statement">
        <div className="coding-statement-head">
          <Link to={isDebugging ? '/debugging/problems' : '/coding/problems'} className="coding-back">
            <FiChevronLeft /> All problems
          </Link>
          <h1 className="coding-title">{problem.title}</h1>
          <div className="coding-meta-row">
            <DifficultyBadge difficulty={problem.difficulty} />
            <span className="coding-points-pill">{problem.points} pts</span>
            {!isDebugging && problem.hiddenCount > 0 && (
              <span className="coding-meta-note">{problem.hiddenCount} hidden test{problem.hiddenCount === 1 ? '' : 's'}</span>
            )}
            {problem.totalSubmissions > 0 && (
              <span className="coding-meta-note">{problem.acceptanceRate}% acceptance</span>
            )}
          </div>

          {/* Timer: elapsed on this problem, and elapsed in the session.
              WHY show both: "how long have I been on this" and "how long have I
              been working" answer different questions, and a single number
              cannot distinguish a stuck problem from a long session. */}
          <div className="coding-timers">
            <span className="coding-timer" title="Time on this problem">
              <FiClock /> {formatElapsed(problemSeconds * 1000)}
            </span>
            <span className="coding-timer coding-timer--muted" title="Total time in this session">
              session {formatElapsed(sessionMs)}
            </span>
          </div>

          <div className="coding-stepper">
            {/* WHY disabled rather than hidden: the student needs to see that a
                previous/next exists in this workspace, and a button that does
                nothing on the first/last problem would read as a broken control. */}
            <button
              type="button"
              className="coding-stepper-btn"
              onClick={() => goToNeighbour(-1)}
              disabled={!prevProblem}
              title={prevProblem ? `Previous: ${prevProblem.title}` : 'This is the first problem'}
            >
              <FiChevronLeft /> Prev
            </button>
            <button
              type="button"
              className="coding-stepper-btn"
              onClick={() => goToNeighbour(1)}
              disabled={!nextProblem}
              title={nextProblem ? `Next: ${nextProblem.title}` : 'This is the last problem'}
            >
              Next <FiChevronLeft className="coding-stepper-flip" />
            </button>
          </div>
        </div>

        <div className="coding-tabs" role="tablist">
          {[
            { key: 'description', label: 'Description', icon: FiList },
            { key: 'examples', label: 'Examples', icon: FiInbox },
            ...(!isDebugging ? [
              { key: 'submissions', label: 'Submissions', icon: FiClock },
              { key: 'hints', label: 'Hints', icon: FiHelpCircle },
            ] : []),
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              className={activeTab === key ? 'is-active' : ''}
              onClick={() => setActiveTab(key)}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        <div className="coding-tab-body">
          {activeTab === 'description' && (
            <>
              <p className="coding-statement">{problem.statement}</p>
              {problem.inputFormat && (
                <>
                  <h3 className="coding-h3">Input format</h3>
                  <pre className="coding-io-block">{problem.inputFormat}</pre>
                </>
              )}
              {problem.outputFormat && (
                <>
                  <h3 className="coding-h3">Output format</h3>
                  <pre className="coding-io-block">{problem.outputFormat}</pre>
                </>
              )}
              {problem.constraints?.length > 0 && (
                <>
                  <h3 className="coding-h3">Constraints</h3>
                  <ul className="coding-constraints">
                    {problem.constraints.map((c, i) => <li key={i}><code>{c}</code></li>)}
                  </ul>
                </>
              )}
              {problem.tags?.length > 0 && (
                <div className="coding-tags coding-tags-bottom">
                  {problem.tags.map((t) => <span key={t} className="coding-tag">{t}</span>)}
                </div>
              )}
            </>
          )}

          {activeTab === 'examples' && (
            <>
              <h3 className="coding-h3">Sample test cases</h3>
              <p className="coding-muted">
                These are the cases <strong>Run</strong> executes. Submitting also runs
                {problem.hiddenCount} hidden case{problem.hiddenCount === 1 ? '' : 's'}.
              </p>
              {problem.testCases?.length > 0 ? problem.testCases.map((tc, i) => (
                <div key={i} className="coding-example">
                  <div className="coding-example-head">Example {i + 1}</div>
                  <div className="coding-io-label">Input</div>
                  <CodeBlock text={tc.input} />
                  <div className="coding-io-label">Output</div>
                  <CodeBlock text={tc.expectedOutput} />
                </div>
              )) : <p className="coding-muted">This problem has no public examples.</p>}
            </>
          )}

          {!isDebugging && activeTab === 'submissions' && <SubmissionsTab problemId={problem._id} onReload={handleSubmit} />}

          {!isDebugging && activeTab === 'hints' && (
            <>
              <h3 className="coding-h3">Hints</h3>
              {problem.hints?.length > 0 ? (
                <ol className="coding-hints">
                  {problem.hints.map((h, i) => <li key={i}>{h}</li>)}
                </ol>
              ) : (
                <p className="coding-muted">No hints for this problem. Try the Examples tab.</p>
              )}
            </>
          )}
        </div>
      </section>

      {/* ─── Right: editor ─── */}
      <section ref={editorPaneRef} className="coding-pane coding-pane--editor" aria-label="Code editor">
        <div className="coding-editor-head">
          <div className="coding-lang-wrap">
            <button
              type="button"
              className="coding-lang-btn"
              onClick={() => setShowLanguageMenu((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={showLanguageMenu}
            >
              <FiCode /> {currentLanguageLabel} ▾
            </button>
            {showLanguageMenu && (
              <ul className="coding-lang-menu" role="listbox">
                {languages.map((l) => (
                  <li key={l.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={l.key === language}
                      className={l.key === language ? 'is-active' : ''}
                      onClick={() => { void selectLanguage(l.key); }}
                    >
                      {l.label}
                      {l.key === language && <FiCheck />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="coding-editor-tools">
            <span className={`coding-starter-badge${starterUnmodified ? '' : ' is-modified'}`} role="status">
              <span className="coding-starter-dot" aria-hidden="true" />
              <span>Starter Code:</span>
              <strong>{starterUnmodified ? 'Not Modified' : 'Modified'}</strong>
            </span>
            <button
              type="button"
              className="coding-tool-btn"
              title="Reset to the starter code"
              onClick={() => {
                const starter = problem.starterCode?.[language] || '';
                setCode(starter);
                try { localStorage.removeItem(draftKey(slug, language, isDebugging)); } catch { /* ignore */ }
                setRunResult(null);
                setSubmitResult(null);
                toast.info('Editor reset to the starter code.');
              }}
            >
              <FiRotateCcw />
            </button>
            <button
              type="button"
              className="coding-tool-btn"
              title="Copy code"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  toast.success('Code copied.');
                } catch {
                  toast.error('Could not access the clipboard.');
                }
              }}
            >
              <FiCopy />
            </button>
          </div>
        </div>

        <div className="coding-editor-body">
          <MonacoEditor
            ref={editorRef}
            value={code}
            onChange={setCode}
            language={language}
            height="100%"
            onRunShortcut={handleRun}
            onSubmitShortcut={handleSubmit}
            ariaLabel={`${currentLanguageLabel} code editor for ${problem.title}`}
          />
        </div>

        {/* Verdict: shown above the console so it is impossible to miss. */}
        {verdict && (
          <div className={`coding-verdict coding-verdict--${verdict.tone}`} role="status">
            <verdict.icon className="coding-verdict-icon" />
            <div className="coding-verdict-main">
              <strong>{verdict.message || `${verdict.passedCases}/${verdict.totalCases} test cases passed`}</strong>
              <span>
                {verdict.status === 'accepted'
                  ? `Full marks — ${verdict.score}/${verdict.maxScore} points`
                  : `${verdict.passedCases}/${verdict.totalCases} passed · ${verdict.score}/${verdict.maxScore} points`}
                {verdict.rank != null && ` · Rank #${verdict.rank}`}
              </span>
            </div>
            {verdict.status === 'accepted' && nextProblem && (
              <button
                type="button"
                className="coding-verdict-next"
                onClick={() => goToNeighbour(1)}
              >
                Next problem →
              </button>
            )}
          </div>
        )}

        <div className="coding-actions">
          <div className="coding-case-summary">
            {runResult ? (
              <span>
                {runResult.cases?.filter((c) => c.passed).length ?? 0}/{runResult.cases?.length ?? 0} sample cases passed
              </span>
            ) : (
              <span className="coding-muted">Ctrl + Enter to submit</span>
            )}
          </div>
          <div className="coding-action-buttons">
            <button
              type="button"
              className="btn-outline-techiz"
              onClick={handleRun}
              disabled={running || submitting || sandboxDown || problemLocked}
              title="Run against the sample cases (F9)"
            >
              <FiPlay /> {running ? 'Running…' : 'Run'}
            </button>
            <button
              type="button"
              className="btn-techiz"
              onClick={handleSubmit}
              disabled={submitting || running || sandboxDown || problemLocked}
              title="Submit for grading (Ctrl + Enter)"
            >
              <FiUploadCloud /> {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>

        {problemLocked && (
          <div className="coding-locked-note" role="status">
            <FiAlertCircle /> This problem has already been submitted and is locked.
          </div>
        )}

        {sandboxDown && (
          <div className="coding-sandbox-warning" role="alert">
            <FiAlertTriangle />
            Code execution is not configured on the server
            {execution?.provider && ` (provider: ${execution.provider})`}. Ask an administrator to set
            JUDGE0_API_KEY or CODE_EXECUTION_PROVIDER.
          </div>
        )}

        <div
          className={`coding-editor-resize-handle${isResizing ? ' is-active' : ''}`}
          role="separator"
          aria-label="Resize editor and console"
          aria-orientation="horizontal"
          onPointerDown={startResize}
        >
          <span /><span /><span />
        </div>
        <div className="coding-console-shell" style={{ height: `${consoleHeight}px` }}>
          <CodeConsole
            result={submitResult || runResult}
            running={running || submitting}
            error={consoleError}
          />
        </div>
      </section>

      {guardDialog && (
        <div
          className="coding-guard-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGuardDialog(null);
          }}
        >
          <section
            className="coding-guard-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coding-guard-title"
            aria-describedby="coding-guard-message"
          >
            <div className="coding-guard-mark" aria-hidden="true">
              <FiAlertTriangle />
            </div>
            <h2 id="coding-guard-title">
              {guardDialog.kind === 'starter'
                ? guardDialog.action === 'run' ? 'Starter Code Not Modified' : 'Cannot Submit Starter Code'
                : 'Short Solution Warning'}
            </h2>
            <p id="coding-guard-message">
              {guardDialog.kind === 'starter'
                ? guardDialog.action === 'run'
                  ? 'You have not modified the default code template. Please write your solution before running.'
                  : 'You must write a solution before submitting.'
                : 'Your solution appears incomplete. Do you still want to continue?'}
            </p>
            <div className="coding-guard-actions">
              {guardDialog.kind === 'starter' ? (
                <button type="button" className="coding-guard-primary" onClick={() => setGuardDialog(null)} autoFocus>
                  Continue Editing
                </button>
              ) : (
                <>
                  <button type="button" className="coding-guard-secondary" onClick={() => setGuardDialog(null)}>
                    Cancel
                  </button>
                  <button type="button" className="coding-guard-primary" onClick={continueAfterWarning} autoFocus>
                    Continue
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

// ─── Submissions tab ──────────────────────────────────────────────────────────
const SubmissionsTab = ({ problemId, onReload }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/coding/submissions/me', { params: { problemId, limit: 20 } })
      .then(({ data }) => { if (!cancelled) setRows(data.data || []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [problemId]);

  const openRow = async (id) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setDetail(null);
    try {
      const { data } = await api.get(`/coding/submissions/${id}`);
      setDetail(data.data);
    } catch {
      setDetail({ error: 'Could not load that submission.' });
    }
  };

  if (loading) return <div className="coding-center"><InlineSpinner /></div>;
  if (rows.length === 0) {
    return (
      <div className="coding-empty coding-empty--inline">
        <FiClock size={28} />
        <p>You have not submitted a solution for this problem yet.</p>
      </div>
    );
  }

  return (
    <div className="coding-submissions">
      {rows.map((s) => {
        const meta = VERDICT[s.status] || VERDICT.internalError;
        const Icon = meta.icon;
        const isOpen = expanded === s._id;
        return (
          <div key={s._id} className={`coding-sub-row coding-verdict--${meta.tone}`}>
            <button type="button" className="coding-sub-summary" onClick={() => openRow(s._id)}>
              <Icon />
              <span className="coding-sub-status">{meta.label}</span>
              <span className="coding-sub-score">{s.score}/{s.maxScore}</span>
              <span className="coding-sub-lang">{s.language}</span>
              <span className="coding-sub-time">
                {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : ''}
              </span>
            </button>
            {isOpen && (
              <div className="coding-sub-detail">
                {!detail && <div className="coding-center"><InlineSpinner size={16} /></div>}
                {detail?.error && <p className="coding-muted">{detail.error}</p>}
                {detail?.code && <CodeBlock text={detail.code} />}
                {detail?.problemId && (
                  <button type="button" className="btn-outline-techiz coding-tool-btn-text" onClick={onReload}>
                    Re-submit current code
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CodingProblemPage;
