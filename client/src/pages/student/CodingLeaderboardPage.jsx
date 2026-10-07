import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import InlineSpinner from '../../components/InlineSpinner';
import { FiAward, FiClock, FiCode, FiDownload, FiRefreshCw } from 'react-icons/fi';
import './CodingLeaderboardPage.css';
import './coding-shared.css';

const rankClass = (rank) =>
  rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';

const PODIUM_TROPHY = { 1: '🥇', 2: '🥈', 3: '🥉' };

const CodingLeaderboardPage = () => {
  const [rows, setRows] = useState([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const board = await api.get('/coding/leaderboard', { params: { limit: 100 } });
      setRows(board.data.data || []);
      setTotalProblems(board.data.totalProblems || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportLeaderboard = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/coding/admin/leaderboard/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'synexia_leaderboard.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not export the leaderboard.');
    } finally {
      setExporting(false);
    }
  };

  const podiumRows = rows.filter((r) => r.rank <= 3).sort((a, b) => a.rank - b.rank);

  if (loading) {
    return <div className="coding-center coding-center-full"><InlineSpinner label="Loading leaderboard…" /></div>;
  }

  if (error) {
    return (
      <div className="coding-center coding-center-full">
        <FiAward size={38} color="var(--danger)" />
        <h3>{error}</h3>
        <button type="button" className="btn-outline-techiz" onClick={load}>
          <FiRefreshCw /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="page-wrapper coding-board-page">

      {/* ─── Hero ──────────────────────────────────────────────── */}
      <div className="lb-hero">
        <div className="lb-hero-inner">
          <div>
            <div className="lb-hero-eyebrow"><FiAward /> Rankings</div>
            <h1 className="lb-hero-title">Leaderboard</h1>
            <p className="lb-hero-sub">
              Ranked by points from coding and debugging problems · {totalProblems > 0 && `${totalProblems} problem${totalProblems === 1 ? '' : 's'} in play · `}
              Top {rows.length} coders shown
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/coding/problems" className="btn-outline-techiz" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
              <FiCode /> Solve Problems
            </Link>
            <button type="button" className="btn-outline-techiz" onClick={exportLeaderboard} disabled={exporting}>
              <FiDownload /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button type="button" className="btn-techiz" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiRefreshCw /> Refresh
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="coding-empty">
          <FiAward size={36} />
          <h3>No scores yet</h3>
          <p>No student accounts are registered yet. Students will appear here with their current scores.</p>
          <Link to="/coding/problems" className="btn-techiz" style={{ marginTop: 8 }}>
            Be the first →
          </Link>
        </div>
      ) : (
        <>
          {/* ─── Podium (top 3) ──────────────────────────────── */}
          {podiumRows.length >= 1 && (
            <div className="lb-podium">
              {podiumRows.map((r) => (
                <div key={r.userId} className={`lb-podium-card lb-podium-card--${r.rank}`}>
                  <span className="lb-podium-trophy">{PODIUM_TROPHY[r.rank]}</span>
                  <div className="lb-podium-avatar">
                    {r.avatar
                      ? <img src={r.avatar} alt="" />
                      : (r.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="lb-podium-name">{r.name || 'Anonymous'}</div>
                  <div className="lb-podium-score">{Number(r.totalPoints ?? r.totalScore ?? 0).toLocaleString()}</div>
                  <div className="lb-podium-label">points</div>
                  <div className="lb-podium-solved">
                    {r.problemsSolved} solved · {r.accuracy}% acc
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Full Table ──────────────────────────────────── */}
          <div className="lb-table-card">
            <table className="lb-table">
              <thead>
                <tr>
                  <th style={{ width: '7%' }}>Rank</th>
                  <th style={{ width: '24%' }}>Student</th>
                  <th style={{ width: '16%' }}>College</th>
                  <th style={{ width: '12%' }}>Points</th>
                  <th style={{ width: '11%' }}>Solved</th>
                  <th style={{ width: '13%' }}>Accuracy</th>
                  <th style={{ width: '17%' }}>Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  return (
                    <tr key={r.userId}>
                      <td>
                        <span className={`lb-rank-badge ${rankClass(r.rank)}`}>{r.rank}</span>
                      </td>
                      <td>
                        <div className="lb-student-cell">
                          <div className="lb-avatar">
                            {r.avatar
                              ? <img src={r.avatar} alt="" />
                              : (r.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="lb-student-name">
                            {r.name}
                          </span>
                        </div>
                      </td>
                      <td className="coding-muted">{r.college || '—'}</td>
                      <td className="lb-score-cell">{Number(r.totalPoints ?? r.totalScore ?? 0).toLocaleString()} pts</td>
                      <td>
                        {r.problemsSolved}
                        <span className="coding-sub-note">/{r.problemsAttempted} tried</span>
                      </td>
                      <td>
                        <span className="lb-acc-bar" aria-hidden="true">
                          <span style={{ width: `${Math.min(100, r.accuracy || 0)}%` }} />
                        </span>
                        <span className="coding-sub-note">{r.accuracy}%</span>
                      </td>
                      <td className="coding-muted">
                        <FiClock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {r.lastActivity ? new Date(r.lastActivity).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CodingLeaderboardPage;
