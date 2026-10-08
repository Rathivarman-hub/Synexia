import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiCheck, FiCircle, FiTarget, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { getDifficultyMeta } from './DifficultyBadge';
import api from '../api/axios';
import { useAssessmentSession } from '../context/AssessmentSessionContext';
import './ProblemNavigator.css';

/**
 * Left-hand problem navigator.
 *
 * WHY it is a rail and not a modal/dropdown: a LeetCode-style workspace needs the
 * whole set visible at all times so a student can see how many problems are left
 * and jump between them without losing their editor state (drafts are persisted
 * per problem+language, so switching is cheap).
 *
 * WHY status comes from /coding/stats/me/problems and not from the catalogue
 * list: that endpoint is already a single grouped aggregation keyed per problem
 * (`getUserProblemStatusMap`) and it returns solved/attempted/none plus the best
 * score. Fetching the catalogue list as well would mean a second overlapping
 * query for data the server already computed.
 *
 * WHY onCatalogLoaded exists: the parent needs the same ordering for its
 * previous/next controls, and re-fetching the list there would be a second
 * request for one payload. The rail loads it once and hands it up.
 */
const ProblemNavigator = ({
  onCatalogLoaded,
  collapsed,
  onToggle,
  isDebugging = false,
}) => {
  const { slug: currentSlug } = useParams();
  const { assessmentQuestions } = useAssessmentSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api
      .get(isDebugging ? '/debugging/stats/me/problems' : '/coding/stats/me/problems')
      .then(({ data }) => {
        if (cancelled) return;
        // The endpoint is ordered server-side by (order, points) — the same order
        // the catalogue page uses — so the rail is a stable numbered list.
        const catalogue = data.data || [];
        const questionOrder = new Map(assessmentQuestions.map((question, index) => [question.slug, index]));
        setRows(assessmentQuestions.length
          ? catalogue
            .filter((problem) => questionOrder.has(problem.slug))
            .sort((a, b) => questionOrder.get(a.slug) - questionOrder.get(b.slug))
          : catalogue);
      })
      .catch(() => {
        // A failed navigator must not take the workspace down: the student can
        // still read the statement, run code and submit the assessment. Only the rail degrades.
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentQuestions, isDebugging]);

  // Publish the ordering to the parent for previous/next navigation.
  useEffect(() => {
    onCatalogLoaded?.(rows);
  }, [rows, onCatalogLoaded]);

  // WHY a modifier comparison instead of measuring scrollTop: with 8 problems the
  // rail rarely scrolls, and reading scrollTop would need a scroll listener plus a
  // ref for a purely cosmetic highlight.
  const tone = (r) => {
    if (r.slug === currentSlug) return 'is-current';
    if (r.status === 'solved') return 'is-solved';
    if (r.status === 'attempted') return 'is-attempted';
    return 'is-todo';
  };

  const solvedCount = rows.filter((r) => r.status === 'solved').length;
  const attemptedCount = rows.filter((r) => r.status === 'attempted').length;
  const total = rows.length;
  const pct = total > 0 ? Math.round((solvedCount / total) * 100) : 0;

  // Track the active row into view when navigating with the arrow keys.
  useEffect(() => {
    if (!currentSlug) return;
    const el = document.querySelector('.pn-item.is-current');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [currentSlug]);

  if (collapsed) {
    return (
      <nav className="pn pn--collapsed" aria-label="Problem navigator">
        <button type="button" className="pn-toggle pn-toggle--vertical" onClick={onToggle} title="Show problem list">
          <FiChevronRight />
        </button>
        <span className="pn-collapsed-count">{solvedCount}/{total}</span>
      </nav>
    );
  }

  return (
    <nav className="pn" aria-label="Problem navigator">
      <div className="pn-head">
        <div className="pn-head-row">
          <h2 className="pn-title">Problems</h2>
          <button type="button" className="pn-toggle" onClick={onToggle} title="Hide problem list">
            <FiChevronLeft />
          </button>
        </div>

        <div className="pn-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Problems solved">
          <div className="pn-progress-track">
            <div className="pn-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="pn-progress-label">
            <strong>{solvedCount}</strong> of {total} solved
          </span>
        </div>

        {/* WHY show "attempted" separately: a student needs to know which problems
            they have already burnt time on, otherwise the rail looks like a wall of
            unstarted work. */}
        {attemptedCount > 0 && (
          <span className="pn-progress-sub">
            {attemptedCount} in progress
          </span>
        )}
      </div>

      <ol className="pn-list">
        {loading && <li className="pn-loading">Loading…</li>}

        {!loading && rows.length === 0 && (
          <li className="pn-loading">No problems published yet.</li>
        )}

        {!loading &&
          rows.map((r, i) => {
            const meta = getDifficultyMeta(r.difficulty);
            return (
              <li key={r._id}>
                <Link
                  to={`/${isDebugging ? 'debugging' : 'coding'}/problems/${r.slug}`}
                  className={`pn-item ${tone(r)}`}
                  title={r.title}
                  aria-current={r.slug === currentSlug ? 'page' : undefined}
                >
                  <span className="pn-num">
                    {r.status === 'solved' ? <FiCheck aria-label="Solved" /> : r.status === 'attempted' ? <FiTarget aria-label="Attempted" /> : i + 1}
                  </span>
                  <span className="pn-item-body">
                    <span className="pn-item-title">{r.title}</span>
                    <span className="pn-item-meta">
                      <span className="pn-dot" style={{ background: meta.color }} aria-hidden="true" />
                      {r.difficultyLabel || meta.label}
                      <span className="pn-sep">·</span>
                      {r.points} pts
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
      </ol>

      <div className="pn-legend">
        <span><FiCheck /> Solved</span>
        <span><FiTarget /> Attempted</span>
        <span><FiCircle /> Not started</span>
      </div>
    </nav>
  );
};

export default ProblemNavigator;
