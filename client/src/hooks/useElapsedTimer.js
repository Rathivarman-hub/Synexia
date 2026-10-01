import React, { useEffect, useRef, useState } from 'react';

/**
 * Elapsed-time tracking for the coding workspace.
 *
 * WHY this counts UP rather than down: the deleted MCQ module used a countdown
 * with auto-submit on expiry, which is correct for a fixed 10-question quiz but
 * wrong for a LeetCode-style workspace. A student thinking through an algorithm
 * should not have a red clock pushing them to submit broken code, and there is
 * no "paper" to submit. So this tracks time spent, which is what actually gets
 * reported on a submission.
 *
 * WHY it lives in a ref-driven interval instead of `Date.now()` deltas: a
 * `setInterval` that decrements a counter drifts by up to a second per tick when
 * the tab is throttled in the background. Accumulating real elapsed milliseconds
 * from performance.now() and only re-rendering the display once a second keeps
 * the number honest even after the tab was hidden for minutes.
 */
export const useElapsedTimer = ({ running = true, onReset } = {}) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (!running) return undefined;

    // Resume from wherever the last pause left off rather than from zero.
    startedAtRef.current = performance.now();

    const tick = setInterval(() => {
      const total = accumulatedRef.current + (performance.now() - startedAtRef.current);
      setElapsedMs(Math.floor(total));
    }, 1000);

    return () => {
      clearInterval(tick);
      // Fold the running segment into the accumulated total so a pause/resume or
      // an unmount does not lose the time already spent.
      if (startedAtRef.current !== null) {
        accumulatedRef.current += performance.now() - startedAtRef.current;
        startedAtRef.current = null;
      }
    };
  }, [running]);

  const reset = () => {
    accumulatedRef.current = 0;
    startedAtRef.current = running ? performance.now() : null;
    setElapsedMs(0);
    onReset?.();
  };

  return { elapsedMs, reset };
};

/** "7:04" / "1:02:33" — seconds are what a student reads, so drop them at 60. */
export const formatElapsed = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/**
 * Per-problem time tracker.
 *
 * WHY the key changes instead of calling reset(): navigating between problems
 * must bank the time spent on the one being left. `timeSpentByProblem` is
 * therefore accumulated on unmount/change, which is what gets displayed in the
 * navigator and reported to the grader.
 */
export const useProblemTimeTracker = (problemId) => {
  const [timeSpentByProblem, setTimeSpentByProblem] = useState({});
  const activeFromRef = useRef(null);

  useEffect(() => {
    if (!problemId) return undefined;
    activeFromRef.current = performance.now();

    return () => {
      const started = activeFromRef.current;
      activeFromRef.current = null;
      if (started === null) return;
      const spent = Math.floor((performance.now() - started) / 1000);
      if (spent <= 0) return;
      setTimeSpentByProblem((prev) =>
        prev
          ? { ...prev, [problemId]: (prev[problemId] || 0) + spent }
          : prev
      );
    };
  }, [problemId]);

  /** Seconds on the current problem, including the live segment. */
  const liveSeconds = (problemId, now) => {
    const banked = timeSpentByProblem?.[problemId] || 0;
    const live =
      activeFromRef.current !== null && now ? Math.floor((now - activeFromRef.current) / 1000) : 0;
    return banked + Math.max(0, live);
  };

  return { timeSpentByProblem, liveSeconds };
};

export default useElapsedTimer;
