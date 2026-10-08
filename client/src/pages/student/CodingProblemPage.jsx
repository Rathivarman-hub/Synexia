import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { getChangedCodeLength, isStarterCode } from '../../lib/starterCodeValidation';
import MonacoEditor from '../../components/MonacoEditor';
import CodeConsole from '../../components/CodeConsole';
import { DifficultyBadge } from '../../components/DifficultyBadge';
import ProblemNavigator from '../../components/ProblemNavigator';
import AssessmentFinishControl from '../../components/AssessmentFinishControl';
import InlineSpinner from '../../components/InlineSpinner';
import { useAssessmentSession } from '../../context/AssessmentSessionContext';
import {
  FiChevronLeft, FiPlay, FiRotateCcw, FiCopy, FiCheck,
  FiAlertTriangle, FiCode, FiList, FiHelpCircle, FiInbox, FiAlertCircle,
} from 'react-icons/fi';
import './CodingProblemPage.css';

const MIN_EDITOR_HEIGHT = 250;
const MIN_CONSOLE_HEIGHT = 120;
const MAX_CONSOLE_RATIO = 0.6;

const draftKey = (studentId, sessionId, problemId, language, isDebugging = false) =>
  `syn-workspace:v1:${studentId}:${sessionId || 'practice'}:${isDebugging ? 'debugging' : 'coding'}:${problemId}:${language}`;
const MIN_SOLUTION_CHANGE = 20;

/** Monospace, whitespace-preserving rendering of a multi-line I/O example. */
const CodeBlock = ({ text }) => <pre className="coding-io-block">{text === '' ? <em>(empty)</em> : text}</pre>;

const CodingProblemPage = ({ isDebugging = false }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const studentId = user?._id || user?.id || null;
  const {
    assessmentAnswers,
    assessmentSessionId,
    isAssessmentActive,
    isAssessmentSubmitted,
    assessmentSubmitting,
    recordAssessmentAnswer,
    recordAssessmentDraft,
    recordAssessmentEvaluation,
  } = useAssessmentSession();

  const [problem, setProblem] = useState(null);
  const [loadedStudentId, setLoadedStudentId] = useState(null);
  const [serverSavedAnswer, setServerSavedAnswer] = useState(null);
  const [language, setLanguage] = useState(() => {
    return 'python';
  });
  // Preserve each language's student draft while switching editor templates.
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
  const [editorShare, setEditorShare] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('syn-coding-editor-share:v1'));
      return Number.isFinite(saved) && saved >= 30 && saved <= 70 ? saved : 50;
    } catch {
      return 50;
    }
  });
  const [isHorizontalResizing, setIsHorizontalResizing] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const workspaceRef = useRef(null);
  const statementPaneRef = useRef(null);
  const editorPaneRef = useRef(null);
  const editorRef = useRef(null);
  const resizeStartRef = useRef(null);
  const horizontalResizeRef = useRef(false);
  const restoredWorkspaceRef = useRef(null);

  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [consoleError, setConsoleError] = useState('');

  const [execution, setExecution] = useState(null);
  const [problemLocked, setProblemLocked] = useState(false);
  const submissionLocked = isAssessmentSubmitted || assessmentSubmitting || (problemLocked && !isAssessmentActive);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [guardDialog, setGuardDialog] = useState(null);

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

  const handleHorizontalResize = useCallback((event) => {
    if (!horizontalResizeRef.current) return;
    const workspace = workspaceRef.current;
    const statement = statementPaneRef.current;
    if (!workspace || !statement) return;
    const workspaceRight = workspace.getBoundingClientRect().right;
    const contentWidth = workspaceRight - statement.getBoundingClientRect().left;
    if (contentWidth <= 0) return;
    const share = ((workspaceRight - event.clientX) / contentWidth) * 100;
    const nextShare = Math.min(70, Math.max(30, share));
    setEditorShare(nextShare);
    try { localStorage.setItem('syn-coding-editor-share:v1', String(nextShare)); } catch { /* private mode */ }
  }, []);

  const stopHorizontalResize = useCallback(() => {
    horizontalResizeRef.current = false;
    setIsHorizontalResizing(false);
  }, []);

  const startHorizontalResize = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    horizontalResizeRef.current = true;
    setIsHorizontalResizing(true);
  }, []);

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
    if (!isHorizontalResizing) return undefined;
    window.addEventListener('pointermove', handleHorizontalResize);
    window.addEventListener('pointerup', stopHorizontalResize);
    window.addEventListener('pointercancel', stopHorizontalResize);
    return () => {
      window.removeEventListener('pointermove', handleHorizontalResize);
      window.removeEventListener('pointerup', stopHorizontalResize);
      window.removeEventListener('pointercancel', stopHorizontalResize);
    };
  }, [isHorizontalResizing, handleHorizontalResize, stopHorizontalResize]);

  useEffect(() => {
    editorRef.current?.layout();
  }, [editorShare]);

  useEffect(() => {
    editorRef.current?.layout();
  }, [consoleHeight]);

  // WHY a ref for "is this the newest run": a student can hit Run twice quickly,
  // and the slower response must not overwrite the newer result.
  const runSeq = useRef(0);

  const readDraftForLanguage = useCallback((languageKey, template, problemId) => {
    if (!problemId) return template;
    if (!studentId) return template;
    let saved = '';
    try {
      saved = localStorage.getItem(
        draftKey(studentId, isAssessmentActive ? assessmentSessionId : null, problemId, languageKey, isDebugging)
      ) || '';
    } catch { saved = ''; }
    return saved && !isStarterCode(saved, template) ? saved : template;
  }, [studentId, assessmentSessionId, isAssessmentActive, isDebugging]);

  const originalStarterCode = problem?.starterCodeTemplates?.[language] || problem?.starterCode?.[language] || '';
  const assessmentWorkspaceKey = problem && assessmentSessionId
    ? `${studentId}:${assessmentSessionId}:${problem._id}`
    : null;
  const assessmentWorkspaceRestored = !isAssessmentActive
    || !assessmentWorkspaceKey
    || restoredWorkspaceRef.current === assessmentWorkspaceKey;
  const activeAssessmentAnswer = isAssessmentActive && problem
    ? assessmentAnswers[String(problem._id)]
    : null;
  const savedAssessmentCode = activeAssessmentAnswer?.codeByLanguage?.[language]
    ?? (activeAssessmentAnswer?.language === language ? activeAssessmentAnswer.code : undefined);
  const activeAssessmentCode = assessmentWorkspaceRestored
    ? codeByLanguage[language] ?? savedAssessmentCode ?? originalStarterCode
    : savedAssessmentCode ?? readDraftForLanguage(language, originalStarterCode, problem?._id) ?? originalStarterCode;
  const savedAssessmentAnswer = isAssessmentSubmitted && problem
    ? assessmentAnswers[String(problem._id)]
    : null;
  const savedReviewAnswer = savedAssessmentAnswer || serverSavedAnswer;
  const submittedCodeByLanguage = savedReviewAnswer?.codeByLanguage || {};
  const code = isAssessmentActive
    ? activeAssessmentCode
    : savedReviewAnswer?.language === language
      ? savedReviewAnswer.code
      : isAssessmentSubmitted
        ? submittedCodeByLanguage[language] ?? originalStarterCode
        : submittedCodeByLanguage[language] ?? codeByLanguage[language] ?? '';
  const hasUnsubmittedLanguageDraft = Boolean(
    savedReviewAnswer
    && savedReviewAnswer.language !== language
    && (submittedCodeByLanguage[language] || codeByLanguage[language])
    && !isStarterCode(code, originalStarterCode)
  );
  const starterUnmodified = isStarterCode(code, originalStarterCode);
  const changedCodeLength = getChangedCodeLength(code, originalStarterCode);
  const setCode = useCallback((next) => {
    runSeq.current += 1;
    setRunning(false);
    setCodeByLanguage((prev) => ({ ...prev, [language]: next }));
    setRunResult(null);
    setConsoleError('');
    if (isAssessmentActive && problem) {
      recordAssessmentAnswer(problem._id, problem.slug, language, next);
    }
    try {
      if (studentId) {
        localStorage.setItem(
          draftKey(studentId, isAssessmentActive ? assessmentSessionId : null, problem?._id || slug, language, isDebugging),
          next
        );
      }
    } catch { /* quota / private mode */ }
  }, [
    language,
    slug,
    isDebugging,
    studentId,
    assessmentSessionId,
    isAssessmentActive,
    problem,
    recordAssessmentAnswer,
  ]);

  useEffect(() => {
    if (!problem || problem.slug !== slug) return;
    const assessmentKey = `${studentId}:${assessmentSessionId}:${problem._id}`;
    const workspaceKey = isAssessmentActive
      ? assessmentKey
      : `${studentId}:practice:${isDebugging ? 'debugging' : 'coding'}:${problem._id}`;
    if (restoredWorkspaceRef.current === workspaceKey) return;
    restoredWorkspaceRef.current = workspaceKey;

    const answer = isAssessmentActive ? assessmentAnswers[String(problem._id)] : null;
    const restored = { ...(answer?.codeByLanguage || {}) };
    if (answer?.language && answer.code !== undefined) restored[answer.language] = answer.code;
    const templates = problem.starterCodeTemplates || problem.starterCode || {};
    const languageKeys = isDebugging
      ? Object.keys(templates)
      : (problem.languages || []).map(({ key }) => key);
    const restoredLocalDrafts = [];
    languageKeys.forEach((key) => {
      const template = templates[key] || '';
      let localDraft = null;
      try {
        localDraft = localStorage.getItem(
          draftKey(studentId, isAssessmentActive ? assessmentSessionId : null, problem._id, key, isDebugging)
        );
      } catch { /* private mode or unavailable storage */ }

      if (localDraft !== null) {
        const savedCode = restored[key];
        restored[key] = localDraft;
        if (!isStarterCode(localDraft, template) || savedCode !== undefined) {
          restoredLocalDrafts.push([key, localDraft]);
        }
        return;
      }
      if (restored[key] !== undefined) return;
      restored[key] = readDraftForLanguage(key, template, problem._id);
    });
    setCodeByLanguage(restored);
    if (isAssessmentActive) {
      restoredLocalDrafts.forEach(([key, sourceCode]) => {
        recordAssessmentDraft(problem._id, problem.slug, key, sourceCode);
      });
      if (restoredLocalDrafts.some(([key]) => key === language)) {
        recordAssessmentAnswer(problem._id, problem.slug, language, restored[language]);
      }
    }
  }, [
    problem,
    slug,
    studentId,
    assessmentSessionId,
    isAssessmentActive,
    assessmentAnswers,
    isDebugging,
    readDraftForLanguage,
    language,
    recordAssessmentAnswer,
    recordAssessmentDraft,
  ]);

  // ─── Load the problem ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    runSeq.current += 1;
    setLoading(true);
    setLoadError('');
    setProblem(null);
    setLoadedStudentId(null);
    setServerSavedAnswer(null);
    setCodeByLanguage({});
    setRunResult(null);
    setRunning(false);
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
        setLoadedStudentId(studentId);
        setProblemLocked((loaded.totalAttempts || 0) > 0);

        const templates = loaded.starterCodeTemplates || loaded.starterCode || {};
        setLanguage((current) => {
          if (current && templates[current] !== undefined) return current;
          return 'python';
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.response?.data?.message || 'Problem not found.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug, isDebugging, studentId]);

  useEffect(() => {
    if ((!isAssessmentSubmitted && (isAssessmentActive || !problemLocked)) || !problem || problem.slug !== slug) {
      setServerSavedAnswer(null);
      return undefined;
    }

    let cancelled = false;
    api.get(`/${isDebugging ? 'debugging' : 'coding'}/problems/${slug}/saved-answer`)
      .then(({ data }) => {
        if (!cancelled) setServerSavedAnswer(data.data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.response?.data?.message || 'Could not load the saved answer for review.');
          setServerSavedAnswer(null);
        }
      });

    return () => { cancelled = true; };
  }, [isAssessmentSubmitted, isAssessmentActive, problemLocked, problem, slug, isDebugging]);

  // ─── Persist drafts ─────────────────────────────────────────────────────────
  // WHY debounced: writing localStorage on every keystroke is a synchronous
  // main-thread disk write and makes typing feel sticky on a large file.
  useEffect(() => {
    if (!problem || problem.slug !== slug || isAssessmentSubmitted || typeof code !== 'string') return undefined;
    const t = setTimeout(() => {
      try {
        if (studentId) {
          localStorage.setItem(
            draftKey(studentId, isAssessmentActive ? assessmentSessionId : null, problem._id, language, isDebugging),
            code
          );
        }
      } catch { /* quota / private mode */ }
    }, 800);
    return () => clearTimeout(t);
  }, [code, language, problem, slug, isDebugging, isAssessmentSubmitted, studentId, isAssessmentActive, assessmentSessionId]);

  useEffect(() => {
    if (!isAssessmentActive || !assessmentSessionId || !problem || problem.slug !== slug || typeof code !== 'string') return undefined;
    const timer = setTimeout(() => {
      api.put(`/${isDebugging ? 'debugging' : 'coding'}/assessment/draft`, {
        sessionId: assessmentSessionId,
        problemId: problem._id,
        language,
        sourceCode: code,
      }).catch((error) => {
        toast.error(error.response?.data?.message || 'Could not save this assessment draft.');
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [isAssessmentActive, assessmentSessionId, problem, slug, code, language, isDebugging]);

  useEffect(() => {
    if (!isAssessmentSubmitted || !problem || problem.slug !== slug) return;
    const answer = savedReviewAnswer || assessmentAnswers[String(problem._id)];
    if (!answer) return;
    setLanguage(answer.language);
    setCodeByLanguage((current) => ({
      ...current,
      ...(answer.codeByLanguage || {}),
      [answer.language]: answer.code,
    }));
  }, [isAssessmentSubmitted, assessmentAnswers, problem, slug]);

  // ─── Sandbox health ─────────────────────────────────────────────────────────
  // Checked once per problem view so Run can explain an unavailable sandbox
  // before the student starts writing code.
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
    if (assessmentSubmitting) return;
    setShowLanguageMenu(false);
    if (isAssessmentSubmitted) {
      const answer = assessmentAnswers[String(problem._id)];
      let template = problem.starterCodeTemplates?.[nextLanguage]
        || problem.starterCode?.[nextLanguage]
        || '';
      if (isDebugging && !template) {
        try {
          const { data } = await api.get(`/debugging/problems/${slug}`, { params: { language: nextLanguage } });
          template = data.data.languageTemplates?.[nextLanguage] || '';
          if (!template) throw new Error(`No ${nextLanguage} template was returned.`);
          setProblem((current) => ({
            ...current,
            starterCode: { ...current.starterCode, [nextLanguage]: template },
            starterCodeTemplates: { ...current.starterCodeTemplates, [nextLanguage]: template },
          }));
        } catch (err) {
          toast.error(err.response?.data?.message || err.message || `Could not load the ${nextLanguage} template.`);
          return;
        }
      }
      const savedCode = answer?.language === nextLanguage
        ? answer.code
        : answer?.codeByLanguage?.[nextLanguage]
          || template;
      setCodeByLanguage((current) => ({ ...current, [nextLanguage]: savedCode }));
    } else if (isDebugging) {
      try {
        const { data } = await api.get(`/debugging/problems/${slug}`, { params: { language: nextLanguage } });
        const template = data.data.languageTemplates?.[nextLanguage];
        if (!template) throw new Error(`No ${nextLanguage} template was returned.`);
        const savedCode = assessmentAnswers[String(problem._id)]?.codeByLanguage?.[nextLanguage]
          || readDraftForLanguage(nextLanguage, template, problem._id);
        setProblem((current) => ({
          ...current,
          starterCode: { ...current.starterCode, [nextLanguage]: template },
          starterCodeTemplates: { ...current.starterCodeTemplates, [nextLanguage]: template },
        }));
        setCodeByLanguage((current) => ({ ...current, [nextLanguage]: savedCode }));
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || `Could not load the ${nextLanguage} template.`);
        return;
      }
    } else {
      setCodeByLanguage((current) => {
          const template = problem?.starterCodeTemplates?.[nextLanguage]
            || problem?.starterCode?.[nextLanguage]
            || '';
          if (current[nextLanguage] !== undefined) return current;
        return { ...current, [nextLanguage]: readDraftForLanguage(nextLanguage, template, problem._id) };
      });
    }
    setLanguage(nextLanguage);
    runSeq.current += 1;
    setRunning(false);
    setRunResult(null);
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
    if (!problem || running || submissionLocked) return;
    if (!code.trim()) {
      toast.error('Write some code before running.');
      return;
    }

    const seq = runSeq.current + 1;
    runSeq.current = seq;

    setRunning(true);
    setConsoleError('');
    try {
      const { data } = await api.post(isDebugging ? '/debugging/run' : '/coding/run', {
        problemId: problem._id,
        language,
        code,
        ...(isAssessmentActive ? { assessmentSessionId } : {}),
      });
      if (runSeq.current !== seq) return; // a newer run superseded this one
      setRunResult(data.data);
      if (isAssessmentActive && data.data.fullAssessment) {
        recordAssessmentEvaluation(problem._id, language, code, data.data);
      }
    } catch (err) {
      if (runSeq.current !== seq) return;
      handleApiError(err, 'Execution failed.');
    } finally {
      if (runSeq.current === seq) setRunning(false);
    }
  }, [
    problem,
    running,
    submissionLocked,
    code,
    language,
    handleApiError,
    isDebugging,
    isAssessmentActive,
    assessmentSessionId,
    recordAssessmentEvaluation,
  ]);

  const guardAction = useCallback(() => {
    if (starterUnmodified) {
      setGuardDialog({ kind: 'starter' });
      toast.info('Modify the starter code before running.');
      return true;
    }
    if (changedCodeLength < MIN_SOLUTION_CHANGE) {
      setGuardDialog({ kind: 'short' });
      toast.warning('Your code appears incomplete.');
      return true;
    }
    return false;
  }, [starterUnmodified, changedCodeLength]);

  const handleRun = useCallback(() => {
    if (!problem || running || submissionLocked) return;
    if (!code.trim()) {
      toast.error('Write some code before running.');
      return;
    }
    if (!isAssessmentActive && guardAction()) return;
    void executeRun();
  }, [problem, running, submissionLocked, code, isAssessmentActive, guardAction, executeRun]);

  const continueAfterWarning = useCallback(() => {
    setGuardDialog(null);
    if (guardDialog?.kind !== 'short') return;
    void executeRun();
  }, [guardDialog, executeRun]);

  useEffect(() => {
    if (!guardDialog) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setGuardDialog(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [guardDialog]);

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

  if (loading || !problem || problem.slug !== slug || loadedStudentId !== studentId) {
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
    <div
      ref={workspaceRef}
      className="coding-workspace"
      style={{ gridTemplateColumns: `auto minmax(0, ${100 - editorShare}fr) 8px minmax(0, ${editorShare}fr)` }}
    >
      {/* ─── Far left: question navigator ─── */}
      <ProblemNavigator
        collapsed={navCollapsed}
        onToggle={() => setNavCollapsed((v) => !v)}
        onCatalogLoaded={setCatalog}
        isDebugging={isDebugging}
      />

      {/* ─── Centre: problem statement ─── */}
      <section ref={statementPaneRef} className="coding-pane coding-pane--statement" aria-label="Problem statement">
        <div className="coding-statement-head">
          <Link to={isDebugging ? '/debugging/problems' : '/coding/problems'} className="coding-back">
            <FiChevronLeft /> All problems
          </Link>
          <div className="coding-title-row">
            <div className="coding-title-main">
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
            </div>
            {isAssessmentActive && (
              <div className="coding-assessment-global-controls">
                <AssessmentFinishControl />
              </div>
            )}
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
            ...(!isDebugging ? [{ key: 'hints', label: 'Hints', icon: FiHelpCircle }] : []),
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
                {isAssessmentActive
                  ? <><strong>Run Code</strong> evaluates every required assessment test, including hidden cases.</>
                  : <>These are the cases <strong>Run Code</strong> executes. A final assessment submission does not run code again.</>}
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

      <div
        className={`coding-column-resize-handle${isHorizontalResizing ? ' is-active' : ''}`}
        role="separator"
        aria-label="Resize problem description and code editor"
        aria-orientation="vertical"
        aria-valuemin={30}
        aria-valuemax={70}
        aria-valuenow={Math.round(editorShare)}
        tabIndex={0}
        onPointerDown={startHorizontalResize}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const direction = event.key === 'ArrowLeft' ? -2 : 2;
          setEditorShare((current) => {
            const nextShare = Math.min(70, Math.max(30, current + direction));
            try { localStorage.setItem('syn-coding-editor-share:v1', String(nextShare)); } catch { /* private mode */ }
            return nextShare;
          });
        }}
      />

      {/* ─── Right: editor ─── */}
      <section ref={editorPaneRef} className="coding-pane coding-pane--editor" aria-label="Code editor">
        <div className="coding-editor-head">
          <div className="coding-lang-wrap">
            <button
              type="button"
              className="coding-lang-btn"
              onClick={() => setShowLanguageMenu((v) => !v)}
              disabled={assessmentSubmitting}
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
                      disabled={assessmentSubmitting}
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
            {isAssessmentSubmitted && (
              <span className="coding-muted" role="status">
                {savedReviewAnswer?.language === language
                  ? 'Submitted answer'
                  : hasUnsubmittedLanguageDraft
                    ? 'Saved code (not submitted)'
                    : `No saved ${currentLanguageLabel} code`}
              </span>
            )}
            <span className={`coding-starter-badge${starterUnmodified ? '' : ' is-modified'}`} role="status">
              <span className="coding-starter-dot" aria-hidden="true" />
              <span>Starter Code:</span>
              <strong>{starterUnmodified ? 'Not Modified' : 'Modified'}</strong>
            </span>
            {!isAssessmentSubmitted && <button
              type="button"
              className="coding-tool-btn"
              disabled={submissionLocked}
              title="Reset to the starter code"
              onClick={() => {
                const starter = problem.starterCodeTemplates?.[language] || problem.starterCode?.[language] || '';
                setCode(starter);
                try {
                  localStorage.removeItem(
                    draftKey(studentId, isAssessmentActive ? assessmentSessionId : null, problem._id, language, isDebugging)
                  );
                } catch { /* ignore */ }
                setRunResult(null);
                toast.info('Editor reset to the starter code.');
              }}
            >
              <FiRotateCcw />
            </button>}
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
            key={`${problem.slug}:${language}`}
            ref={editorRef}
            value={code}
            onChange={setCode}
            language={language}
            readOnly={submissionLocked}
            height="100%"
            onRunShortcut={handleRun}
            ariaLabel={`${currentLanguageLabel} code editor for ${problem.title}`}
          />
        </div>

        <div className="coding-actions">
          <div className="coding-case-summary">
            {runResult ? (
              <span>
                {runResult.passedTests ?? runResult.passedCases ?? runResult.cases?.filter((testCase) => testCase.passed).length ?? 0}/
                {runResult.fullAssessment
                  ? runResult.totalTests ?? runResult.cases?.length ?? 0
                  : runResult.cases?.length ?? 0}{' '}
                {runResult.fullAssessment ? 'assessment tests passed' : 'sample cases passed'}
              </span>
            ) : (
              <span className="coding-muted">
                {isAssessmentActive
                  ? 'Run your code against all assessment test cases.'
                  : 'Run sample cases to check your code.'}
              </span>
            )}
          </div>
          <div className="coding-action-buttons">
            <button
              type="button"
              className="btn-outline-techiz"
              onClick={handleRun}
              disabled={running || sandboxDown || submissionLocked}
              title={`${isAssessmentActive ? 'Run against all assessment test cases' : 'Run against the sample cases'} (F9)`}
            >
              <FiPlay /> {running ? 'Running…' : 'Run Code'}
            </button>
            {isAssessmentSubmitted && <span className="coding-muted">Assessment answers are locked and read-only.</span>}
          </div>
        </div>

        {problemLocked && !isAssessmentActive && !isAssessmentSubmitted && (
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
            result={runResult}
            running={running}
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
              {guardDialog.kind === 'starter' ? 'Starter Code Not Modified' : 'Short Code Warning'}
            </h2>
            <p id="coding-guard-message">
              {guardDialog.kind === 'starter'
                ? 'You have not modified the default code template. Please write some code before running.'
                : 'Your code appears incomplete. Do you still want to run it?'}
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

export default CodingProblemPage;
