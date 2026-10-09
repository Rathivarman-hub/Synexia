import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { DifficultyBadge, StatusBadge, getDifficultyMeta } from '../../components/DifficultyBadge';
import InlineSpinner from '../../components/InlineSpinner';
import { useAssessmentSession } from '../../context/AssessmentSessionContext';
import AssessmentFinishControl from '../../components/AssessmentFinishControl';
import {
  FiSearch, FiChevronLeft, FiChevronRight, FiCode,
  FiTrendingUp, FiCheckCircle, FiZap, FiArrowRight, FiList,
  FiPlay, FiClock, FiAward, FiLock,
} from 'react-icons/fi';
import './CodingProblemsPage.css';
import './coding-shared.css';

// ─── Sort options ─────────────────────────────────────────────────────────────
// WHY these mirror the server's SORTABLE allow-list exactly: an option the
// server silently ignores (it falls back to points) would make the header look
// broken, so the two lists must not drift.
const SORT_OPTIONS = [
  { value: 'order', label: 'Question Order' },
  { value: 'points', label: 'By Points' },
  { value: 'difficulty', label: 'By Difficulty' },
  { value: 'acceptance', label: 'By Acceptance' },
  { value: 'title', label: 'By Title' },
  { value: 'newest', label: 'Newest First' },
];

const PAGE_SIZE = 20;

const CodingProblemsPage = ({ isDebugging = false }) => {
  const [problems, setProblems] = useState([]);
  const [difficulties, setDifficulties] = useState([]);
  const [pointOptions, setPointOptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [retryingAssessmentStatus, setRetryingAssessmentStatus] = useState(false);
  const [startError, setStartError] = useState('');
  const {
    assessmentStarted,
    assessmentQuestions,
    assessmentSubmitted,
    assessmentLoaded,
    assessmentLoadError,
    startAssessment,
    loadAssessment,
  } = useAssessmentSession();

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [language, setLanguage] = useState('');
  const [points, setPoints] = useState('');
  const [sortBy, setSortBy] = useState('order');
  const [sortOrder, setSortOrder] = useState('asc');

  // WHY debounce: the search box fires on every keystroke, and each keystroke
  // would otherwise hit the server AND churn the shared Redis list cache for
  // every student on the page. 350ms is long enough to coalesce a word and short
  // enough to still feel instant.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // WHY reset to page 1 when a filter changes: page 3 of a filtered set is often
  // empty, and the student would see "no problems" with no obvious cause.
  useEffect(() => { setPage(1); }, [debouncedSearch, difficulty, language, points, sortBy, sortOrder]);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE, sortBy, sortOrder };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (difficulty) params.difficulty = difficulty;
      if (isDebugging && language) params.language = language;
      if (isDebugging && points) params.points = points;

      const { data } = await api.get(isDebugging ? '/debugging/problems' : '/coding/problems', { params });
      setProblems(data.data || []);
      setTotal(data.total || 0);
      if (Array.isArray(data.points)) setPointOptions(data.points);
      if (Array.isArray(data.difficulties) && data.difficulties.length) {
        setDifficulties(data.difficulties);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the problem list.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, difficulty, language, points, sortBy, sortOrder, isDebugging]);

  // ─── Fullscreen ref ─────────────────────────────────────────────────────────
  // ─── Start handler ─────────────────────────────────────────────────────────
  const handleStartAssessment = async () => {
    if (!assessmentLoaded || assessmentLoadError || assessmentSubmitted) return;
    setStarting(true);
    setStartError('');
    try {
      const questions = await startAssessment(null, isDebugging ? 'debugging' : 'coding');
      setPage(1);
      setSearch('');
      setDebouncedSearch('');
      setDifficulty('');
      setLanguage('');
      setPoints('');
      setSortBy('order');
      setSortOrder('asc');
      const { data } = await api.get(isDebugging ? '/debugging/problems' : '/coding/problems', {
        params: isDebugging ? undefined : { page: 1, limit: 50, sortBy: 'order', sortOrder: 'asc' },
      });
      const allProblems = data.data || [];
      const questionSlugs = new Set(questions.map((question) => question.slug));
      setProblems(allProblems.filter((problem) => questionSlugs.has(problem.slug)));
      setTotal(questions.length);
    } catch (err) {
      setStartError(err.response?.data?.message || err.message || 'Could not start the assessment. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const handleRetryAssessmentStatus = async () => {
    setRetryingAssessmentStatus(true);
    try {
      await loadAssessment(isDebugging ? 'debugging' : 'coding');
    } finally {
      setRetryingAssessmentStatus(false);
    }
  };

  useEffect(() => { fetchProblems(); }, [fetchProblems]);

  const visibleProblems = assessmentStarted && assessmentQuestions.length
    ? problems.filter((problem) => assessmentQuestions.some((question) => question.slug === problem.slug))
    : problems;
  const visibleTotal = assessmentStarted ? assessmentQuestions.length : total;
  const totalPages = assessmentStarted ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;

  const stats = useMemo(() => {
    const solved = visibleProblems.filter((p) => p.solved).length;
    const attempted = visibleProblems.filter((p) => p.status === 'attempted').length;
    return {
      solved,
      attempted,
      points: visibleProblems.reduce((sum, problem) => sum + (problem.bestScore || 0), 0),
    };
  }, [visibleProblems]);

  const showLandingScreen = !assessmentStarted || assessmentSubmitted;
  const listPath = isDebugging ? '/debugging/problems' : '/coding/problems';
  const assessmentName = isDebugging ? 'Coding Assessment' : 'Coding Practice';

  // ─── Landing screen ─────────────────────────────────────────────────────────
  if (showLandingScreen) {
    return (
      <div className="coding-list-page">
        <div className="coding-page-hero">
          <div className="coding-hero-content">
            <div className="coding-hero-text">
              <div className="coding-hero-eyebrow">
                <FiCode /> {assessmentName}
              </div>
              <h1 className="coding-hero-title">{isDebugging ? 'Coding Questions' : 'Coding Problems'}</h1>
              <p className="coding-hero-subtitle">
                Write solutions · Judged against hidden test cases
              </p>
            </div>
            <div className="coding-hero-actions">
              {!isDebugging && !assessmentStarted && !assessmentSubmitted && (
                <Link to="/coding/submissions" className="coding-hero-btn coding-hero-btn--primary">
                  <FiList /> My Submissions
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="assessment-landing">
          <div className="assessment-lock-icon"><FiLock /></div>
          <h2 className="assessment-landing-title">
            {assessmentSubmitted
              ? 'Assessment Complete'
              : assessmentLoadError
                ? 'Assessment Status Unavailable'
                : 'Ready to Begin?'}
          </h2>
          <p className="assessment-landing-desc">
            {assessmentSubmitted
              ? 'Your assessment has been submitted and is locked. You can reopen each question to review the saved code.'
              : assessmentLoadError
                ? assessmentLoadError
                : <>Click <strong>Start Assessment</strong> to reveal 8 coding questions.
                  Your answers are saved as one final submission when you finish.</>}
          </p>
          <div className="assessment-info-grid">
            <div className="assessment-info-item">
              <span className="assessment-info-icon"><FiClock /></span>
              <span className="assessment-info-text">1 hour 30 minutes</span>
            </div>
            <div className="assessment-info-item">
              <span className="assessment-info-icon"><FiAward /></span>
              <span className="assessment-info-text">8 questions</span>
            </div>
            <div className="assessment-info-item">
              <span className="assessment-info-icon"><FiZap /></span>
              <span className="assessment-info-text">Hidden test cases</span>
            </div>
          </div>
          {assessmentLoadError ? (
            <button
              type="button"
              className="assessment-start-btn"
              onClick={handleRetryAssessmentStatus}
              disabled={retryingAssessmentStatus}
            >
              {retryingAssessmentStatus
                ? <><span className="assessment-btn-spinner" /> Checking Status…</>
                : 'Retry Status Check'}
            </button>
          ) : (
            <button
              id="start-assessment-btn"
              type="button"
              className="assessment-start-btn"
              onClick={handleStartAssessment}
              disabled={assessmentSubmitted || starting || loading || !assessmentLoaded}
            >
              {starting ? (
                <><span className="assessment-btn-spinner" /> Loading Questions…</>
              ) : loading ? (
                <>Loading Questions…</>
              ) : !assessmentLoaded ? (
                <>Checking Assessment…</>
              ) : assessmentSubmitted ? (
                <>Assessment Submitted</>
              ) : (
                <><FiPlay /> Start Assessment</>
              )}
            </button>
          )}
          {assessmentSubmitted && assessmentQuestions[0] && (
            <div className="assessment-completed-summary" role="status">
              <Link
                to={`${listPath}/${assessmentQuestions[0].slug}`}
                className="coding-hero-btn coding-hero-btn--primary"
              >
                Review submitted code <FiArrowRight />
              </Link>
            </div>
          )}
          {startError && <div className="coding-error-banner" role="alert">{startError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="coding-list-page">

      {/* ─── Hero Header ─────────────────────────────────────────────── */}
      <div className="coding-page-hero">
        <div className="coding-hero-content">
          <div className="coding-hero-text">
            <div className="coding-hero-eyebrow">
              <FiCode /> {assessmentName}
            </div>
            <h1 className="coding-hero-title">{isDebugging ? 'Coding Questions' : 'Coding Problems'}</h1>
            <p className="coding-hero-subtitle">
              {assessmentStarted
                ? `${visibleTotal} assessment questions · 1 hour 30 minutes`
                : `${total} question${total === 1 ? '' : 's'} · Write solutions · Judged against hidden test cases`}
            </p>
            </div>
            <div className="coding-hero-actions">
              {assessmentStarted && <AssessmentFinishControl />}
              {!isDebugging && !assessmentStarted && !assessmentSubmitted && (
            <Link to="/coding/submissions" className="coding-hero-btn coding-hero-btn--primary">
              <FiList /> My Submissions
            </Link>
            )}
          </div>
        </div>
      </div>

      {/* ─── Stats Strip ─────────────────────────────────────────────── */}
      <div className="coding-stats-strip">
        <div className="coding-stat-card">
          <div className="coding-stat-icon coding-stat-icon--solved">
            <FiCheckCircle />
          </div>
          <div className="coding-stat-body">
            <span className="coding-stat-value" style={{ color: 'var(--success)' }}>{stats.solved}</span>
            <span className="coding-stat-label">Solved on this page</span>
          </div>
        </div>
        <div className="coding-stat-card">
          <div className="coding-stat-icon coding-stat-icon--progress">
            <FiTrendingUp />
          </div>
          <div className="coding-stat-body">
            <span className="coding-stat-value" style={{ color: 'var(--warning)' }}>{stats.attempted}</span>
            <span className="coding-stat-label">In progress</span>
          </div>
        </div>
        <div className="coding-stat-card">
          <div className="coding-stat-icon coding-stat-icon--points">
            <FiZap />
          </div>
          <div className="coding-stat-body">
            <span className="coding-stat-value">{stats.points}</span>
            <span className="coding-stat-label">Points earned</span>
          </div>
        </div>
      </div>

      {/* ─── Toolbar ─────────────────────────────────────────────────── */}
      <div className="coding-toolbar-wrap">
        <div className="coding-search-wrap">
          <FiSearch className="coding-search-icon" />
          <input
            type="search"
            className="coding-search-input"
            placeholder="Search by title or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search problems"
            disabled={assessmentStarted}
          />
        </div>

        <select
          className="coding-filter-select"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          aria-label="Filter by difficulty"
          disabled={assessmentStarted}
        >
          <option value="">All Difficulties</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>{getDifficultyMeta(d).label}</option>
          ))}
        </select>

        {isDebugging && (
          <>
            <select className="coding-filter-select" value={language}
              onChange={(e) => setLanguage(e.target.value)} aria-label="Filter by language"
              disabled={assessmentStarted}>
              <option value="">All Languages</option>
              {[
                ['python', 'Python'], ['java', 'Java'], ['javascript', 'JavaScript'], ['c', 'C'],
                ['cpp', 'C++'], ['csharp', 'C#'], ['go', 'Go'],
              ].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select className="coding-filter-select" value={points}
              onChange={(e) => setPoints(e.target.value)} aria-label="Filter by points"
              disabled={assessmentStarted}>
              <option value="">All Points</option>
              {pointOptions.map((value) => (
                <option key={value} value={value}>{value} points</option>
              ))}
            </select>
          </>
        )}

        {!isDebugging && <select
          className="coding-filter-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort by"
          disabled={assessmentStarted}
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>}

        {!isDebugging && <button
          type="button"
          className="coding-sort-btn"
          onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
          aria-label={`Sort ${sortOrder === 'desc' ? 'ascending' : 'descending'}`}
          disabled={assessmentStarted}
        >
          {sortOrder === 'desc' ? '↓ High first' : '↑ Low first'}
        </button>}
      </div>

      {/* ─── Error Banner ────────────────────────────────────────────── */}
      {error && <div className="coding-error-banner" role="alert">{error}</div>}

      {/* ─── Problems Table ───────────────────────────────────────────── */}
      {loading ? (
        <div className="coding-center" style={{ minHeight: 320 }}>
          <InlineSpinner label="Loading problems…" />
        </div>
      ) : visibleProblems.length === 0 ? (
        <div className="coding-empty-state">
          <div className="coding-empty-icon"><FiSearch /></div>
          <h3>No problems match those filters</h3>
          <p>Try a different difficulty, or clear the search box to see all problems.</p>
          <button
            type="button"
            className="btn-outline-techiz"
            onClick={() => { setSearch(''); setDifficulty(''); setLanguage(''); setPoints(''); }}
            style={{ marginTop: 8 }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="coding-table-card coding-table-animate">
          <table className="coding-problems-table">
            <thead>
              <tr>
                <th style={{ width: '4%' }}>#</th>
                <th style={{ width: '34%' }}>Title</th>
                <th style={{ width: '14%' }}>Difficulty</th>
                <th style={{ width: '9%' }}>Points</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '15%' }}>Acceptance</th>
                <th style={{ width: '9%' }}>Tries</th>
                <th style={{ width: '3%' }} aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {visibleProblems.map((p, idx) => (
                <tr key={p._id}>
                  <td className="coding-row-num">{startIdx + idx + 1}</td>
                  <td className="coding-title-col">
                    <Link to={`${listPath}/${p.slug}`} className="coding-title-link">
                      {p.title}
                    </Link>
                    {p.tags?.length > 0 && (
                      <div className="coding-tag-strip">
                        {p.tags.slice(0, 3).map((t) => (
                          <span key={t} className="coding-tag">{t}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td><DifficultyBadge difficulty={p.difficulty} /></td>
                  <td className="coding-pts-cell">{p.points}</td>
                  <td>
                    <StatusBadge status={p.status} />
                    {p.solved && p.maxScore > 0 && p.bestScore < p.maxScore && (
                      <div className="coding-sub-note">best {p.bestScore}/{p.maxScore}</div>
                    )}
                  </td>
                  <td>
                    {p.totalSubmissions > 0 ? (
                      <div className="coding-acceptance-wrap">
                        <span className="coding-acceptance-pct">{p.acceptanceRate}%</span>
                        <span className="coding-acceptance-bar" aria-hidden="true">
                          <span
                            className="coding-acceptance-bar-fill"
                            style={{ width: `${Math.min(100, p.acceptanceRate || 0)}%` }}
                          />
                        </span>
                        <div className="coding-sub-note">{p.totalSubmissions} runs</div>
                      </div>
                    ) : (
                      <span className="coding-sub-note">—</span>
                    )}
                  </td>
                  <td className="coding-pts-cell">{p.totalAttempts || 0}</td>
                  <td>
                    <Link
                      to={`${listPath}/${p.slug}`}
                      className="btn-techiz coding-solve-btn"
                    >
                      Solve <FiArrowRight />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Pagination ──────────────────────────────────────────────── */}
      {!assessmentStarted && totalPages > 1 && (
        <nav className="coding-pager" aria-label="Pagination">
          <button
            type="button"
            className="coding-pager-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <FiChevronLeft /> Previous
          </button>
          <span className="coding-pager-label">Page {page} of {totalPages}</span>
          <button
            type="button"
            className="coding-pager-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next <FiChevronRight />
          </button>
        </nav>
      )}
    </div>
  );
};

export default CodingProblemsPage;
