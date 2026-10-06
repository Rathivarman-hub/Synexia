import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import './AssessmentSessionContext.css';

export const MAX_WARNINGS = 3;

const AssessmentSessionContext = createContext(null);

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
  const [startedAt, setStartedAt] = useState(null);
  const activeRef = useRef(false);
  const endedRef = useRef(false);
  const warningCountRef = useRef(0);
  const warningEventsRef = useRef([]);
  const lastTransitionRef = useRef(null);
  const autoSubmitRef = useRef(null);

  const registerAutoSubmit = useCallback((submitter) => {
    autoSubmitRef.current = submitter;
    return () => {
      if (autoSubmitRef.current === submitter) autoSubmitRef.current = null;
    };
  }, []);

  const finishAssessment = useCallback(async (count, events, violation) => {
    if (endedRef.current) return;
    endedRef.current = true;
    activeRef.current = false;
    setAssessmentEnded(true);
    setAssessmentStarted(false);
    setWarningDialog({ final: true, count, violation });

    const submitter = autoSubmitRef.current;
    if (submitter) {
      void Promise.resolve()
        .then(() => submitter({
          warningCount: count,
          warningEvents: events,
          elapsedSeconds: startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0,
        }))
        .catch((error) => {
          console.error('Automatic assessment submission failed:', error);
        });
    }

    await exitFullscreen();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setWarningDialog(null);
    navigate('/dashboard', { replace: true });
  }, [navigate, startedAt]);

  const recordWarning = useCallback((type) => {
    if (!activeRef.current || endedRef.current) return;
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
    setWarningDialog({ final: nextCount >= MAX_WARNINGS, count: nextCount, violation: type });

    if (nextCount >= MAX_WARNINGS) {
      void finishAssessment(nextCount, nextEvents, type);
    }
  }, [finishAssessment]);

  const startAssessment = useCallback(async (element) => {
    if (activeRef.current) return;
    await requestFullscreen(element || document.documentElement);
    activeRef.current = true;
    endedRef.current = false;
    warningCountRef.current = 0;
    warningEventsRef.current = [];
    lastTransitionRef.current = null;
    setAssessmentStarted(true);
    setAssessmentEnded(false);
    setWarningCount(0);
    setWarningEvents([]);
    setWarningDialog(null);
    setStartedAt(Date.now());
  }, []);

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

  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const value = {
    assessmentStarted,
    assessmentEnded,
    isAssessmentActive: assessmentStarted && !assessmentEnded,
    warningCount,
    warningEvents,
    elapsedSeconds,
    maxWarnings: MAX_WARNINGS,
    startAssessment,
    continueAfterWarning,
    registerAutoSubmit,
  };

  return (
    <AssessmentSessionContext.Provider value={value}>
      {children}
      {warningDialog && (
        <div className="assessment-warning-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="assessment-warning-title">
          <section className="assessment-warning-modal">
            <div className="assessment-warning-mark" aria-hidden="true"><FiAlertTriangle /></div>
            <h2 id="assessment-warning-title">
              {warningDialog.final ? 'Assessment ended' : 'Assessment warning'}
            </h2>
            <p>
              {warningDialog.final
                ? `Warning limit reached (${warningDialog.count}/${MAX_WARNINGS}). Returning to the student dashboard.`
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
