import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import api from '../api/axios';
import { MONACO_LANGUAGE_BY_KEY } from '../lib/monacoLanguages';
import './AssessmentSessionContext.css';

export const MAX_WARNINGS = 3;
export const ASSESSMENT_DURATION_SECONDS = 90 * 60;
export const ASSESSMENT_QUESTION_COUNT = 8;

const AssessmentSessionContext = createContext(null);
const DRAFT_PREFIX = 'syn-coding-draft:v2:';
const DEBUG_DRAFT_PREFIX = 'syn-debug-draft:v2:';
const LANGUAGE_PREFIX = 'syn-assessment-language:v1:';

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;

const requestFullscreen = (element) => {
  const target = element || document.documentElement;
  if (target.requestFullscreen) return target.requestFullscreen();
  if (target.webkitRequestFullscreen) return Promise.resolve(target.webkitRequestFullscreen());
  return Promise.reject(new Error('Fullscreen mode is not supported by this browser.'));
};

const exitFullscreen = () => {
  if (document.exitFullscreen) return document.exitFullscreen().catch(() => {});
  if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  return Promise.resolve();
};

const sameTransition = (previous, type, now) => {
  if (!previous || now - previous.at > 900) return false;
  if (previous.type === type) return true;
  return (previous.type === 'escape' && type === 'fullscreen-exit') ||
    (previous.type === 'fullscreen-exit' && type === 'escape') ||
    (previous.type === 'visibility-hidden' && type === 'window-blur') ||
    (previous.type === 'window-blur' && type === 'visibility-hidden');
};

export const AssessmentSessionProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [assessmentEnded, setAssessmentEnded] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [warningEvents, setWarningEvents] = useState([]);
  const [warningDialog, setWarningDialog] = useState(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [assessmentType, setAssessmentType] = useState(null);
  const [assessmentSessionId, setAssessmentSessionId] = useState(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState({});
  const [assessmentSubmission, setAssessmentSubmission] = useState(null);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);
  const [assessmentLoaded, setAssessmentLoaded] = useState(false);
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
  const [assessmentSubmitError, setAssessmentSubmitError] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const activeRef = useRef(false);
  const endedRef = useRef(false);
  const warningCountRef = useRef(0);
  const warningEventsRef = useRef([]);
  const lastTransitionRef = useRef(null);
  const finishInProgressRef = useRef(false);
  const warningWriteRef = useRef(Promise.resolve());

  const recordAssessmentAnswer = useCallback((questionId, slug, language, code) => {
    if (endedRef.current || finishInProgressRef.current || !questionId || !slug || !language || typeof code !== 'string') return;
    setAssessmentAnswers((current) => ({
      ...current,
      [questionId]: { questionId, slug, language, code },
    }));
  }, []);

  const finishAssessment = useCallback(async (count, events, violation, reason) => {
    if (endedRef.current || finishInProgressRef.current) return;
    if (!assessmentSessionId || !assessmentType) {
      setAssessmentSubmitError('The assessment session is unavailable. Reload the assessment before submitting.');
      return;
    }

    finishInProgressRef.current = true;
    setAssessmentSubmitting(true);
    setAssessmentSubmitError('');
    await warningWriteRef.current;
    const savedAnswers = { ...assessmentAnswers };
    const answers = assessmentQuestions.map((question) => {
      const saved = savedAnswers[String(question._id)];
      let language = saved?.language || 'python';
      let code = saved?.code;
      if (code === undefined) {
        const prefix = assessmentType === 'debugging' ? DEBUG_DRAFT_PREFIX : DRAFT_PREFIX;
        let preferredLanguage = 'python';
        try { preferredLanguage = localStorage.getItem(`${LANGUAGE_PREFIX}${question.slug}`) || preferredLanguage; } catch { /* private mode */ }
        const languages = [preferredLanguage, ...Object.keys(MONACO_LANGUAGE_BY_KEY).filter((key) => key !== preferredLanguage)];
        const availableLanguage = languages.find((key) => {
          try {
            return localStorage.getItem(`${prefix}${question.slug}:${key}`) !== null;
          } catch {
            return false;
          }
        });
        language = availableLanguage || 'python';
        try {
          code = localStorage.getItem(`${prefix}${question.slug}:${language}`) || '';
        } catch {
          code = '';
        }
      }
      const codeByLanguage = {};
      const prefix = assessmentType === 'debugging' ? DEBUG_DRAFT_PREFIX : DRAFT_PREFIX;
      for (const languageKey of Object.keys(MONACO_LANGUAGE_BY_KEY)) {
        try {
          const draft = localStorage.getItem(`${prefix}${question.slug}:${languageKey}`);
          if (draft !== null) codeByLanguage[languageKey] = draft;
        } catch { /* private mode */ }
      }
      try {
        const latestCode = localStorage.getItem(`${prefix}${question.slug}:${language}`);
        if (latestCode !== null) code = latestCode;
      } catch { /* private mode */ }
      codeByLanguage[language] = code || '';
      return { questionId: question._id, language, code: code || '', codeByLanguage };
    });

    let submission;
    try {
      const { data } = await api.post(`/${assessmentType}/assessment/submit`, {
        sessionId: assessmentSessionId,
        answers,
        warningCount: count,
        warningEvents: events,
        reason,
      });
      submission = data.data;
    } catch (error) {
      finishInProgressRef.current = false;
      setAssessmentSubmitting(false);
      setAssessmentSubmitError(error.response?.data?.message || 'Could not submit the assessment. Please try again.');
      return;
    }

    endedRef.current = true;
    activeRef.current = false;
    setAssessmentSubmitted(true);
    setAssessmentSubmission(submission);
    warningCountRef.current = submission.warningCount || 0;
    warningEventsRef.current = submission.warningEvents || [];
    setWarningCount(warningCountRef.current);
    setWarningEvents(warningEventsRef.current);
    setAssessmentAnswers(Object.fromEntries((submission.answers || []).map((answer) => [
      String(answer.questionId),
      {
        questionId: String(answer.questionId),
        slug: answer.slug,
        language: answer.language,
        code: answer.code,
        codeByLanguage: answer.codeByLanguage || {},
      },
    ])));
    setAssessmentEnded(true);
    setAssessmentStarted(false);
    setAssessmentSubmitting(false);
    setWarningDialog({ final: true, count, violation, reason });
    await exitFullscreen();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setWarningDialog(null);
    navigate('/dashboard', { replace: true });
  }, [assessmentAnswers, assessmentQuestions, assessmentSessionId, assessmentType, navigate]);

  const recordWarning = useCallback((type) => {
    if (!activeRef.current || endedRef.current || finishInProgressRef.current || warningCountRef.current >= MAX_WARNINGS) return;
    const now = Date.now();
    if (sameTransition(lastTransitionRef.current, type, now)) return;
    lastTransitionRef.current = { type, at: now };

    const event = { type, occurredAt: new Date(now).toISOString() };
    const nextCount = warningCountRef.current + 1;
    const nextEvents = [...warningEventsRef.current, event].slice(-MAX_WARNINGS);
    warningCountRef.current = nextCount;
    warningEventsRef.current = nextEvents;
    setWarningCount(nextCount);
    setWarningEvents(nextEvents);
    setWarningDialog({ final: false, count: nextCount, violation: type });

    const warningWrite = warningWriteRef.current.then(() => api.post(`/${assessmentType}/assessment/warning`, {
      sessionId: assessmentSessionId,
      event,
    })).then(({ data }) => {
      const savedCount = data.data.warningCount;
      const savedEvents = data.data.warningEvents;
      warningCountRef.current = savedCount;
      warningEventsRef.current = savedEvents;
      setWarningCount(savedCount);
      setWarningEvents(savedEvents);
      if (savedCount >= MAX_WARNINGS) {
        void finishAssessment(savedCount, savedEvents, type, 'warning-limit');
      }
    }).catch((error) => {
      if (error.response?.status === 409 && (finishInProgressRef.current || endedRef.current)) return;
      console.error('Assessment warning could not be recorded:', error);
      setAssessmentSubmitError(error.response?.data?.message || 'A warning could not be saved. Please keep the assessment open and retry.');
    });
    warningWriteRef.current = warningWrite;
  }, [assessmentSessionId, assessmentType, finishAssessment]);

  const startAssessment = useCallback(async (element, type) => {
    if (activeRef.current) return;
    if (!['coding', 'debugging'].includes(type)) throw new Error('Assessment type is required.');
    await requestFullscreen(element || document.documentElement);
    let sessionData;
    try {
      const { data } = await api.post(`/${type}/assessment/start`);
      sessionData = data.data;
    } catch (error) {
      await exitFullscreen();
      throw error;
    }
    if (!Array.isArray(sessionData.questions) || sessionData.questions.length !== ASSESSMENT_QUESTION_COUNT) {
      await exitFullscreen();
      throw new Error(`This assessment requires ${ASSESSMENT_QUESTION_COUNT} published questions.`);
    }
    activeRef.current = true;
    endedRef.current = false;
    finishInProgressRef.current = false;
    warningWriteRef.current = Promise.resolve();
    warningCountRef.current = sessionData.warningCount || 0;
    warningEventsRef.current = sessionData.warningEvents || [];
    lastTransitionRef.current = null;
    setAssessmentSessionId(sessionData._id);
    setAssessmentType(type);
    setAssessmentQuestions(sessionData.questions);
    setAssessmentAnswers({});
    setAssessmentSubmission(null);
    setAssessmentSubmitted(false);
    setAssessmentSubmitError('');
    setAssessmentLoaded(true);
    const sessionStartedAt = new Date(sessionData.startedAt).getTime();
    setClockNow(sessionStartedAt);
    setAssessmentStarted(true);
    setAssessmentEnded(false);
    setWarningCount(warningCountRef.current);
    setWarningEvents(warningEventsRef.current);
    setWarningDialog(null);
    setStartedAt(sessionStartedAt);
    return sessionData.questions;
  }, []);

  const endAssessment = useCallback(
    (reason = 'manual-submit') => finishAssessment(warningCountRef.current, warningEventsRef.current, null, reason),
    [finishAssessment]
  );

  const loadAssessment = useCallback(async (type) => {
    const { data } = await api.get(`/${type}/assessment/me`);
    if (activeRef.current) return;
    setAssessmentType(type);
    if (data.data.submitted) {
      const submission = data.data.submission;
      activeRef.current = false;
      endedRef.current = true;
      warningCountRef.current = submission.warningCount || 0;
      warningEventsRef.current = submission.warningEvents || [];
      setWarningCount(warningCountRef.current);
      setWarningEvents(warningEventsRef.current);
      setAssessmentSubmitError('');
      setAssessmentSubmission(submission);
      setAssessmentSubmitted(true);
      setAssessmentStarted(false);
      setAssessmentEnded(true);
      setAssessmentSessionId(String(submission.sessionId));
      setAssessmentQuestions(submission.answers.map((answer) => ({
        _id: String(answer.questionId),
        title: answer.title,
        slug: answer.slug,
      })));
      setAssessmentAnswers(Object.fromEntries(submission.answers.map((answer) => [
        String(answer.questionId),
        {
          questionId: String(answer.questionId),
          slug: answer.slug,
          language: answer.language,
          code: answer.code,
          codeByLanguage: answer.codeByLanguage || {},
        },
      ])));
      setAssessmentLoaded(true);
      return;
    }
    setAssessmentSubmitted(false);
    setAssessmentSubmission(null);
    endedRef.current = false;
    if (data.data.session) {
      const session = data.data.session;
      const sessionStartedAt = new Date(session.startedAt).getTime();
      activeRef.current = true;
      finishInProgressRef.current = false;
      warningWriteRef.current = Promise.resolve();
      lastTransitionRef.current = null;
      warningCountRef.current = session.warningCount || 0;
      warningEventsRef.current = session.warningEvents || [];
      setAssessmentStarted(true);
      setAssessmentEnded(false);
      setWarningCount(warningCountRef.current);
      setWarningEvents(warningEventsRef.current);
      setStartedAt(sessionStartedAt);
      setClockNow(Date.now());
      setAssessmentSessionId(String(data.data.session._id));
      setAssessmentQuestions(session.questions);
    } else {
      activeRef.current = false;
      warningCountRef.current = 0;
      warningEventsRef.current = [];
      setWarningCount(0);
      setWarningEvents([]);
      setAssessmentSessionId(null);
      setAssessmentQuestions([]);
      setAssessmentAnswers({});
      setStartedAt(null);
    }
    setAssessmentLoaded(true);
  }, []);

  useEffect(() => {
    const match = location.pathname.match(/^\/(coding|debugging)\/problems(?:\/|$)/);
    if (!match || activeRef.current) return undefined;
    let cancelled = false;
    setAssessmentLoaded(false);
    loadAssessment(match[1])
      .catch((error) => {
        if (!cancelled) {
          console.error('Could not load the saved assessment:', error);
          setAssessmentLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [loadAssessment, location.pathname]);

  const continueAfterWarning = useCallback(async () => {
    if (endedRef.current) return;
    setWarningDialog(null);
    await requestFullscreen(fullscreenElement() || document.documentElement);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (activeRef.current && !fullscreenElement()) recordWarning('fullscreen-exit');
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && activeRef.current && !warningDialog?.final) {
        recordWarning('escape');
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeRef.current) recordWarning('visibility-hidden');
    };
    const onWindowBlur = () => {
      if (activeRef.current) recordWarning('window-blur');
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [recordWarning, warningDialog?.final]);

  useEffect(() => {
    if (!activeRef.current || /^\/(?:coding|debugging)\/problems(?:\/|$)/.test(location.pathname)) return;
    activeRef.current = false;
    endedRef.current = true;
    setAssessmentStarted(false);
    setAssessmentEnded(true);
    setWarningDialog(null);
    void exitFullscreen();
  }, [location.pathname]);

  useEffect(() => {
    if (!assessmentStarted) return undefined;
    const tick = () => setClockNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [assessmentStarted, startedAt]);

  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((clockNow - startedAt) / 1000)) : 0;
  const remainingSeconds = Math.max(0, ASSESSMENT_DURATION_SECONDS - elapsedSeconds);

  useEffect(() => {
    if (!assessmentStarted || remainingSeconds > 0) return;
    void finishAssessment(
      warningCountRef.current,
      warningEventsRef.current,
      null,
      'time-limit'
    );
  }, [assessmentStarted, finishAssessment, remainingSeconds]);

  useEffect(() => {
    if (!assessmentStarted || warningCount < MAX_WARNINGS) return;
    void finishAssessment(warningCount, warningEvents, null, 'warning-limit');
  }, [assessmentStarted, finishAssessment, warningCount, warningEvents]);

  const value = {
    assessmentStarted,
    assessmentEnded,
    isAssessmentActive: assessmentStarted && !assessmentEnded,
    warningCount,
    warningEvents,
    elapsedSeconds,
    remainingSeconds,
    assessmentQuestions,
    assessmentType,
    assessmentSessionId,
    assessmentAnswers,
    assessmentSubmission,
    assessmentSubmitted,
    assessmentLoaded,
    assessmentSubmitting,
    assessmentSubmitError,
    maxWarnings: MAX_WARNINGS,
    startAssessment,
    endAssessment,
    continueAfterWarning,
    recordAssessmentAnswer,
    loadAssessment,
  };

  return (
    <AssessmentSessionContext.Provider value={value}>
      {children}
      {warningDialog && (
        <div className="assessment-warning-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="assessment-warning-title">
          <section className="assessment-warning-modal">
            <div className="assessment-warning-mark" aria-hidden="true"><FiAlertTriangle /></div>
            <h2 id="assessment-warning-title">
              {warningDialog.final
                ? warningDialog.reason === 'time-limit'
                  ? 'Time is up'
                  : warningDialog.reason === 'manual-submit'
                    ? 'Assessment submitted'
                    : 'Assessment ended'
                : 'Assessment warning'}
            </h2>
            <p>
              {warningDialog.final
                ? warningDialog.reason === 'time-limit'
                  ? 'The 90-minute time limit has ended. Returning to the student dashboard.'
                  : warningDialog.reason === 'manual-submit'
                    ? 'Your eight answers have been saved in one final submission. Returning to the student dashboard.'
                    : `Warning limit reached (${warningDialog.count}/${MAX_WARNINGS}). Returning to the student dashboard.`
                : `A fullscreen or focus violation was detected. Warning ${warningDialog.count} of ${MAX_WARNINGS}.`}
            </p>
            {!warningDialog.final && (
              <button type="button" className="assessment-warning-primary" onClick={continueAfterWarning} autoFocus>
                Return to assessment
              </button>
            )}
          </section>
        </div>
      )}
    </AssessmentSessionContext.Provider>
  );
};

export const useAssessmentSession = () => {
  const context = useContext(AssessmentSessionContext);
  if (!context) throw new Error('useAssessmentSession must be used inside AssessmentSessionProvider');
  return context;
};

export default AssessmentSessionContext;
