import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { FaArrowRight, FaUniversity, FaUserCircle } from 'react-icons/fa';
import { FiCode, FiCheckCircle, FiInbox, FiClock } from 'react-icons/fi';
import api from '../../api/axios';
import './coding-shared.css';
import './StudentDashboard.css';

// ─── Small presentational pieces ───────────────────────────────────────────────
// WHY these are local rather than shared components: the coding centre has its own
// richer `DifficultyBadge`/`CodeConsole`, and these three tiles are the only place
// that needs a bare label + number. Pulling them into `components/` would add a
// file with a single consumer.

const CodingStatCard = ({ icon: Icon, label, value, hint, tone = 'var(--primary)' }) => (
  <div className="dash-coding-stat">
    <span className="dash-coding-stat-icon" style={{ color: tone }} aria-hidden="true">
      <Icon />
    </span>
    <div className="dash-coding-stat-body">
      <span className="dash-coding-stat-value">{value}</span>
      <span className="dash-coding-stat-label">{label}</span>
      {hint && <span className="dash-coding-stat-hint">{hint}</span>}
    </div>
  </div>
);

/**
 * Progress bar for solved / total problems. Rendered inline (not a component) so
 * the width calculation stays next to the number it visualises.
 */
const CodingProgressBar = ({ solved, total }) => {
  // WHY the guard: the server already sends a 0-progress value when there are no
  // active problems, but a fresh install can briefly have total === 0. Dividing
  // by zero there yields NaN%, and the browser silently collapses the bar to 0
  // width — the card would read as "0% complete" rather than "nothing to do yet".
  const pct = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;

  return (
    <div className="dash-coding-progress">
      <div className="dash-coding-progress-head">
        <span>Problems solved</span>
        <span className="dash-coding-progress-count">
          {solved} <span className="dash-coding-progress-total">/ {total}</span>
        </span>
      </div>
      <div
        className="dash-coding-progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Coding problems solved"
      >
        <div className="dash-coding-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="dash-coding-progress-pct">{pct}% complete</span>
    </div>
  );
};

const StudentDashboard = () => {
  const { user } = useAuth();

  // ─── Coding stats ───────────────────────────────────────────────────────────
  // WHY this fetch is allowed to fail silently: a student who has never opened
  // the coding centre has no stats, but they must still get a working dashboard.
  // Rejecting the render (or surfacing an error toast) because an optional card
  // 404'd would take the assessment CTA down with it. So the card renders in a
  // neutral "no data yet" state and the rest of the dashboard is unaffected.
  const [coding, setCoding] = useState(null);
  const [codingFailed, setCodingFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get('/coding/stats/me')
      .then((res) => {
        if (cancelled) return;
        setCoding(res.data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setCodingFailed(true);
      });

    // WHY the cancel flag: React 18 StrictMode double-invokes effects in dev.
    // Without it, the first (abandoned) request could resolve last and overwrite
    // `coding` with a response for a component that has already unmounted.
    return () => {
      cancelled = true;
    };
  }, []);

  // A failed fetch and an empty result are the same thing to the user here, so
  // they share one branch. `coding` is null until the request settles.
  const hasCoding = !codingFailed && coding !== null;
  return (
    <div className="page-wrapper">
      <Container>
        {/* Welcome banner */}
        <div className="techiz-card fade-in mb-4" style={{ padding: '32px', background: 'linear-gradient(135deg,rgba(108,99,255,0.1),rgba(0,212,170,0.1))' }}>
          <Row className="align-items-center">
            <Col>
              <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                <FaUserCircle className="welcome-icon" aria-hidden="true" /> Welcome back, {user?.name?.split(' ')[0]}!
              </h2>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                {user?.college && <><FaUniversity className="welcome-detail-icon" aria-hidden="true" /> {user.college}</>} {user?.rollNumber && `· Roll: ${user.rollNumber}`}
              </p>
            </Col>
            <Col xs="auto">
              <Link to="/coding/problems" className="btn-techiz">Solve Problems <FaArrowRight aria-hidden="true" /></Link>
            </Col>
          </Row>
        </div>

        {/* ─── Coding ──────────────────────────────────────────────────────── */}
        <Row className="mb-4">
          <Col md={12}>
            <div className="techiz-card dash-coding-card h-100">
              <div className="dash-coding-head">
                <div>
                  <h3 className="dash-coding-title">
                    <FiCode aria-hidden="true" /> Coding Practice
                  </h3>
                  <p className="dash-coding-subtitle">
                    Solve problems in Python, Java, JavaScript, C, C++, C# or Go.
                  </p>
                </div>
                <Link to="/coding/problems" className="btn-techiz btn-techiz--sm">
                  Browse problems <FaArrowRight aria-hidden="true" />
                </Link>
              </div>

              {hasCoding ? (
                <>
                  <CodingProgressBar solved={coding.problemsSolved} total={coding.totalProblems} />
                  <Row className="g-3 mt-1">
                    <Col xs={6}>
                      <CodingStatCard
                        icon={FiCheckCircle}
                        label="Solved"
                        value={coding.problemsSolved}
                        tone="var(--success)"
                      />
                    </Col>
                    <Col xs={6}>
                      <CodingStatCard
                        icon={FiCode}
                        label="Coding score"
                        value={coding.codingScore ?? 0}
                        hint={`${coding.acceptedSubmissions ?? 0} accepted`}
                        tone="var(--primary)"
                      />
                    </Col>
                  </Row>
                </>
              ) : (
                <div className="dash-coding-empty">
                  <p>
                    {codingFailed
                      ? 'Coding stats are unavailable right now.'
                      : 'No coding activity yet.'}
                  </p>
                  <p className="dash-coding-empty-hint">
                    Pick a problem, run your solution against the samples, then submit it to earn points.
                  </p>
                  <Link to="/coding/problems" className="btn-techiz btn-techiz--sm">
                    Start your first problem <FaArrowRight aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </Col>

        </Row>

        {/* ─── Recent Submissions ───────────────────────────────────── */}
        {hasCoding && coding.recentSubmissions && coding.recentSubmissions.length > 0 && (
          <div className="techiz-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                <FiInbox aria-hidden="true" /> Recent Submissions
              </h3>
              <Link to="/coding/submissions" className="btn-outline-techiz btn-techiz--sm">
                View all <FaArrowRight aria-hidden="true" />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {coding.recentSubmissions.slice(0, 5).map((s) => {
                const STATUS_COLOR = {
                  accepted: 'var(--success)',
                  partial: 'var(--warning)',
                  'wrong-answer': 'var(--danger)',
                  'compile-error': 'var(--danger)',
                  'runtime-error': 'var(--danger)',
                  'time-limit-exceeded': 'var(--warning)',
                  'internal-error': 'var(--text-muted)',
                };
                const color = STATUS_COLOR[s.status] || 'var(--text-muted)';
                const label = (s.status || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                const prob = s.problemId;
                return (
                  <div key={s._id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: `${color}1A`, color, flexShrink: 0 }}>
                      {label}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {prob ? prob.title : 'Unknown problem'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FiClock size={11} />
                      {new Date(s.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </Container>
    </div>
  );
};

export default StudentDashboard;
