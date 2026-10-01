import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import InlineSpinner from '../../components/InlineSpinner';
import {
  FiInbox, FiChevronLeft, FiChevronRight, FiCode, FiCheck, FiX,
  FiAlertTriangle, FiAlertCircle, FiClock, FiArrowLeft,
} from 'react-icons/fi';
import './SubmissionsPage.css';
import './coding-shared.css';

// ─── Status metadata ──────────────────────────────────────────────────────────
const STATUS_META = {
  accepted:             { label: 'Accepted',          cls: 'accepted',           icon: FiCheck },
  partial:              { label: 'Partial',            cls: 'partial',            icon: FiAlertTriangle },
  'wrong-answer':       { label: 'Wrong Answer',      cls: 'wrong-answer',       icon: FiX },
  'compile-error':      { label: 'Compile Error',     cls: 'compile-error',      icon: FiAlertTriangle },
  'runtime-error':      { label: 'Runtime Error',     cls: 'runtime-error',      icon: FiAlertTriangle },
  'time-limit-exceeded':{ label: 'Time Limit',        cls: 'time-limit-exceeded',icon: FiClock },
  'internal-error':     { label: 'Internal Error',    cls: 'internal-error',     icon: FiAlertCircle },
};

const LANG_LABELS = {
  python: 'Python', java: 'Java', javascript: 'JavaScript',
  c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go',
};

const StatusBadgeLocal = ({ status, isRun }) => {
  if (isRun) {
    return <span className="sub-status sub-status--run"><FiCode size={11} /> Run</span>;
  }
  const meta = STATUS_META[status] || { label: status, cls: 'internal-error', icon: FiAlertCircle };
  const Icon = meta.icon;
  return (
    <span className={`sub-status sub-status--${meta.cls}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
};

const PAGE_SIZE = 15;

const SubmissionsPage = () => {
  const location = useLocation();
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [includeRuns, setIncludeRuns] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (langFilter) params.language = langFilter;
      if (includeRuns) params.includeRuns = 'true';

      const { data } = await api.get('/coding/submissions/me', { params });
      setSubmissions(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not load submissions.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, langFilter, includeRuns]);

  useEffect(() => { setPage(1); }, [statusFilter, langFilter, includeRuns]);
  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatMs = (ms) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="submissions-page">

      {/* ─── Hero ──────────────────────────────────────────────── */}
      <div className="submissions-hero">
        <div className="submissions-hero-text">
          <div className="submissions-hero-eyebrow">
            <FiInbox /> Submission History
          </div>
          <h1 className="submissions-hero-title">My Submissions</h1>
          <p className="submissions-hero-sub">
            {total} submission{total === 1 ? '' : 's'} · All your coded attempts in one place
          </p>
        </div>
        <div className="submissions-hero-actions">
          <Link to="/coding/problems" className="btn-outline-techiz" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
            <FiArrowLeft /> Problems
          </Link>
        </div>
      </div>

      {location.state?.assessmentAutoSubmitted && (
        <div className="coding-verdict coding-verdict--warning" role="status">
          <FiAlertTriangle className="coding-verdict-icon" />
          <div className="coding-verdict-main">
            <strong>Assessment automatically submitted</strong>
            <span>The warning limit was reached. Your submitted code is locked and available from its problem entry below.</span>
          </div>
        </div>
      )}

      {/* ─── Filters ───────────────────────────────────────────── */}
      <div className="submissions-filters">
        <select
          className="submissions-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          className="submissions-filter-select"
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          aria-label="Filter by language"
        >
          <option value="">All Languages</option>
          {Object.entries(LANG_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <label className="submissions-include-runs">
          <input
            type="checkbox"
            checked={includeRuns}
            onChange={(e) => setIncludeRuns(e.target.checked)}
          />
          Include "Run" attempts
        </label>
      </div>

      {/* ─── Error ─────────────────────────────────────────────── */}
      {error && <div className="coding-error-banner" role="alert">{error}</div>}

      {/* ─── Table ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="coding-center" style={{ minHeight: 280 }}>
          <InlineSpinner label="Loading submissions…" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="submissions-empty">
          <div className="submissions-empty-icon"><FiInbox /></div>
          <h3>No submissions yet</h3>
          <p>
            {statusFilter || langFilter
              ? 'No submissions match those filters. Try clearing them.'
              : 'Pick a problem, write your solution and hit Submit to get started.'}
          </p>
          <Link to="/coding/problems" className="btn-techiz" style={{ marginTop: 8 }}>
            Browse Problems →
          </Link>
        </div>
      ) : (
        <div className="submissions-table-card">
          <table className="submissions-table">
            <thead>
              <tr>
                <th style={{ width: '24%' }}>Problem</th>
                <th style={{ width: '16%' }}>Status</th>
                <th style={{ width: '11%' }}>Language</th>
                <th style={{ width: '11%' }}>Score</th>
                <th style={{ width: '12%' }}>Test Cases</th>
                <th style={{ width: '10%' }}>Time</th>
                <th style={{ width: '16%' }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const prob = s.problemId;
                return (
                  <tr key={s._id}>
                    <td>
                      {prob ? (
                        <Link
                          to={`/coding/problems/${prob.slug}`}
                          className="sub-problem-link"
                        >
                          {prob.title}
                        </Link>
                      ) : (
                        <span className="coding-sub-note">Problem removed</span>
                      )}
                    </td>
                    <td>
                      <StatusBadgeLocal status={s.status} isRun={s.isRun} />
                    </td>
                    <td>
                      <span className="sub-lang">{LANG_LABELS[s.language] || s.language}</span>
                    </td>
                    <td>
                      <span className="sub-score">{s.score ?? 0}</span>
                      <span className="sub-score-max">/{s.maxScore ?? 0}</span>
                    </td>
                    <td>
                      {s.totalCases > 0 ? (
                        <span className="coding-sub-note">
                          {s.passedCases}/{s.totalCases} passed
                        </span>
                      ) : (
                        <span className="coding-sub-note">—</span>
                      )}
                    </td>
                    <td className="sub-time">{formatMs(s.executionTime)}</td>
                    <td className="sub-time">{formatDate(s.submittedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Pagination ────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav className="submissions-pager" aria-label="Pagination">
          <button
            type="button"
            className="submissions-pager-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <FiChevronLeft /> Previous
          </button>
          <span className="submissions-pager-label">Page {page} of {totalPages}</span>
          <button
            type="button"
            className="submissions-pager-btn"
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

export default SubmissionsPage;
