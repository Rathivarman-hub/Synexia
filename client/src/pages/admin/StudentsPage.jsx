import React, { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiChevronUp, FiDownload, FiSearch, FiTrash2, FiUsers } from 'react-icons/fi';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import { DifficultyBadge } from '../../components/DifficultyBadge';
import './StudentsPage.css';

const PAGE_SIZE = 15;

// WHY the labels live here: the server returns raw `language` keys, and the
// client `csharp` key maps to the ".NET" label used everywhere else in the app.
// A second mapping in the admin table would be one more place to forget.
const LANGUAGE_LABELS = {
  python: 'Python',
  javascript: 'JavaScript',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: '.NET',
  go: 'Go',
};

/**
 * Verdict colours for the submission history.
 *
 * WHY a map instead of ternaries: the MCQ version this replaced had exactly two
 * states ("completed" vs everything else) and got by with a ternary. A judge
 * returns seven distinct statuses, and an unrecognised one falling through to a
 * neutral pill is far better than inheriting the wrong semantic colour.
 */
const STATUS_TONE = {
  accepted: { color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.15)', label: 'Accepted' },
  partial: { color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.15)', label: 'Partial' },
  'wrong-answer': { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)', label: 'Wrong answer' },
  'runtime-error': { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)', label: 'Runtime error' },
  'compile-error': { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)', label: 'Compile error' },
  'time-limit-exceeded': { color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.15)', label: 'Time limit' },
  'internal-error': { color: 'var(--text-muted)', bg: 'rgba(112, 121, 145, 0.15)', label: 'Internal error' },
  'not-attempted': { color: 'var(--text-muted)', bg: 'rgba(112, 121, 145, 0.15)', label: 'Not attempted' },
  'not-evaluated': { color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.15)', label: 'Not evaluated' },
};
const toneFor = (status) => STATUS_TONE[status] || { color: 'var(--text-muted)', bg: 'rgba(112,121,145,0.15)', label: status || 'unknown' };

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [refreshToken, setRefreshToken] = useState(0);

  const [expandedStudent, setExpandedStudent] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [loadingSubs, setLoadingSubs] = useState({});

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        // WHY params instead of string interpolation: a name like "Ada (Lovelace)"
        // would otherwise truncate the query at the "&" or break the URL, silently
        // returning the wrong page of students.
        const { data } = await api.get('/admin/students', { params: { page, limit: PAGE_SIZE, search: search || undefined } });
        setStudents(data.data);
        setTotal(data.total);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    // Debounced so typing in the search box does not fire a request per keystroke.
    const t = setTimeout(fetch, 300);
    return () => clearTimeout(t);
  }, [page, search, refreshToken]);

  // A new search result set invalidates any open drill-down, which was keyed to a
  // student that may no longer be on the page.
  useEffect(() => {
    setExpandedStudent(null);
    setSelectedStudentIds([]);
  }, [page, search]);

  const pageSelected = students.length > 0 && students.every((student) => selectedStudentIds.includes(student._id));
  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((selected) => selected.includes(studentId)
      ? selected.filter((id) => id !== studentId)
      : [...selected, studentId]);
  };
  const togglePageSelection = () => {
    const visibleIds = new Set(students.map((student) => student._id));
    setSelectedStudentIds((selected) => pageSelected
      ? selected.filter((id) => !visibleIds.has(id))
      : [...new Set([...selected, ...visibleIds])]);
  };

  const handleDeleteSelected = async () => {
    if (!selectedStudentIds.length || deleting) return;
    const confirmed = window.confirm(
      `Permanently delete ${selectedStudentIds.length} selected student${selectedStudentIds.length === 1 ? '' : 's'} and all related submissions, assessment sessions, and final assessments? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { data } = await api.delete('/admin/students', {
        data: { studentIds: selectedStudentIds },
      });
      toast.success(`${data.deletedCount} student${data.deletedCount === 1 ? '' : 's'} and related records deleted`);
      setSelectedStudentIds([]);
      setSubmissions({});
      setRefreshToken((token) => token + 1);
      setPage((currentPage) => Math.min(
        currentPage,
        Math.max(1, Math.ceil((total - data.deletedCount) / PAGE_SIZE))
      ));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete selected students');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/admin/export-students', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      // Must match the filename the server sets on the Content-Disposition header.
      a.download = 'synexia_students.csv';
      a.click();
      // WHY revoke: the object URL pins the whole CSV in memory until the document
      // is unloaded, so a repeated export leaks one copy of the file per click.
      window.URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExpandStudent = async (studentId) => {
    if (expandedStudent === studentId) {
      setExpandedStudent(null);
      return;
    }
    if (!submissions[studentId]) {
      setLoadingSubs((prev) => ({ ...prev, [studentId]: true }));
      try {
        const { data } = await api.get(`/admin/students/${studentId}/submissions`);
        setSubmissions((prev) => ({ ...prev, [studentId]: data.data }));
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load submissions');
      } finally {
        setLoadingSubs((prev) => ({ ...prev, [studentId]: false }));
      }
    }
    setExpandedStudent(studentId);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="page-wrapper admin-page">
      <Container fluid>
        <div className="admin-header fade-in">
          <div>
            <div className="admin-eyebrow"><FiUsers /> Directory</div>
            <h2 className="admin-title">Students</h2>
            <p className="admin-subtitle">{total} registered students and their coding activity</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn-techiz"
              onClick={handleDeleteSelected}
              disabled={selectedStudentIds.length === 0 || deleting}
              style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              <FiTrash2 /> {deleting ? 'Deleting...' : `Delete selected${selectedStudentIds.length ? ` (${selectedStudentIds.length})` : ''}`}
            </button>
            <button className="btn-techiz" onClick={handleExport} disabled={exporting || deleting}>
              <FiDownload /> {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="glass-card mb-4 fade-in" style={{ padding: '14px 20px' }}>
          <div className="admin-search">
            <FiSearch />
            <input className="techiz-input" placeholder="Search by name, email or college" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <Spinner text="Loading students..." /> : (
          <div className="techiz-card p-0 overflow-hidden fade-in">
            <div className="admin-table-wrap">
              <table className="techiz-table admin-table">
                <thead>
                  <tr>
                    <th className="th-center" style={{ width: '4%' }}>
                      <input
                        type="checkbox"
                        aria-label="Select all students on this page"
                        checked={pageSelected}
                        onChange={togglePageSelection}
                        disabled={deleting || students.length === 0}
                      />
                    </th>
                    <th className="th-center" style={{ width: '3%' }}>#</th>
                    <th className="th-left" style={{ width: '13%' }}>Name</th>
                    <th className="th-left" style={{ width: '17%' }}>Email</th>
                    <th className="th-left" style={{ width: '13%' }}>College</th>
                    <th className="th-left" style={{ width: '11%' }}>Team Head Mobile</th>
                    <th className="th-center" style={{ width: '10%' }}>Questions Passed</th>
                    <th className="th-center" style={{ width: '8%' }}>Submissions</th>
                    <th className="th-center" style={{ width: '9%' }}>Best Score</th>
                    <th className="th-center stu-actions-heading" style={{ width: '8%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const stats = s.codingStats || {};
                    const attempts = Number(stats.attempts ?? 0);
                    const solved = Number(stats.problemsSolved ?? 0);

                    return (
                      <React.Fragment key={s._id}>
                        <tr>
                          <td className="td-center">
                            <input
                              type="checkbox"
                              aria-label={`Select ${s.name}`}
                              checked={selectedStudentIds.includes(s._id)}
                              onChange={() => toggleStudentSelection(s._id)}
                              disabled={deleting}
                            />
                          </td>
                          <td className="td-center" style={{ color: 'var(--text-muted)' }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                          <td className="td-left" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                          <td className="td-left" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 220 }}>
                            <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{s.email}</span>
                          </td>
                          <td className="td-left" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 170 }}>
                            <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{s.college || '—'}</span>
                          </td>
                          <td className="td-left" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 150 }}>
                            <span
                              title={s.teamHeadMobileNumber || 'No mobile number provided'}
                              style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}
                            >
                              {s.teamHeadMobileNumber || '—'}
                            </span>
                          </td>
                          <td className="td-center" style={{ fontWeight: 700, color: solved > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{solved}</td>
                          <td className="td-center" style={{ color: 'var(--text-muted)' }}>{attempts}</td>
                          <td className="td-center" style={{ fontWeight: 600, color: 'var(--secondary)' }}>{Math.round(Number(stats.bestScore ?? 0))}%</td>
                          <td className="td-center stu-actions-cell">
                            <button
                              className="admin-icon-button"
                              onClick={() => handleExpandStudent(s._id)}
                              title="View submissions"
                              aria-expanded={expandedStudent === s._id}
                            >
                              {expandedStudent === s._id ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                            </button>
                          </td>
                        </tr>

                        {expandedStudent === s._id && (
                          <tr className="stu-drilldown">
                            <td colSpan={10} style={{ padding: 16 }}>
                              {loadingSubs[s._id] ? (
                                <div className="stu-drilldown-empty">Loading submissions…</div>
                              ) : !submissions[s._id]?.length ? (
                                <div className="stu-drilldown-empty">No submissions yet</div>
                              ) : (
                                <table className="techiz-table stu-sub-table">
                                  <thead>
                                    <tr>
                                      <th>Problem</th>
                                      <th>Language</th>
                                      <th>Verdict</th>
                                      <th>Cases</th>
                                      <th>Activity</th>
                                      <th>Warnings</th>
                                      <th>Submitted</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {submissions[s._id].map((sub) => {
                                      const tone = toneFor(sub.status);
                                      return (
                                        <tr key={sub._id}>
                                          <td>
                                            {sub.problemId?.title || 'Deleted problem'}
                                            {sub.assessmentType && (
                                              <>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                  {sub.questionsPassed}/{sub.questionCount} questions accepted
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                  Final score: {sub.score}/{sub.maxScore}
                                                </div>
                                                <details style={{ marginTop: 6 }}>
                                                  <summary>Question results</summary>
                                                  <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                                                    {(sub.questionResults || []).map((question, index) => {
                                                      const questionTone = toneFor(question.status);
                                                      return (
                                                        <div key={question.questionNumber || index + 1} style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                          <strong style={{ color: 'var(--text-primary)' }}>Question {question.questionNumber || index + 1}</strong>
                                                          {' · '}
                                                          {question.attempted ? 'Attempted' : 'Not attempted'}
                                                          {' · '}
                                                          {LANGUAGE_LABELS[question.language] || question.language || 'Language not recorded'}
                                                          {' · '}
                                                          <span style={{ color: questionTone.color }}>{questionTone.label}</span>
                                                          {' · '}
                                                          {question.passedTests}/{question.totalTests} tests
                                                          {' · '}
                                                          {question.awardedPoints}/{question.maxScore} pts
                                                          <details style={{ marginTop: 4 }}>
                                                            <summary>Submitted source code</summary>
                                                            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                                              {question.code || '(empty answer)'}
                                                            </pre>
                                                          </details>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </details>
                                              </>
                                            )}
                                            {sub.problemId?.difficulty && (
                                              <span className="stu-sub-difficulty">
                                                <DifficultyBadge difficulty={sub.problemId.difficulty} size="sm" />
                                              </span>
                                            )}
                                          </td>
                                          <td>{LANGUAGE_LABELS[sub.language] || sub.language}</td>
                                          <td>
                                            <span className="stu-status-pill" style={{ color: tone.color, background: tone.bg }}>
                                              {tone.label}
                                            </span>
                                          </td>
                                          <td style={{ color: 'var(--text-muted)' }}>{sub.passedCases}/{sub.totalCases}</td>
                                          <td>
                                            {sub.activityType
                                              ? sub.activityType
                                              : ({
                                                'manual-submit': 'Manual',
                                                'warning-limit': 'Warning Limit',
                                                'time-limit': 'Time Expired',
                                              }[sub.assessmentReason] || 'Final assessment')}
                                          </td>
                                          <td>
                                            <span>{sub.warningCount || 0}/3</span>
                                            {sub.warningEvents?.length > 0 && (
                                              <details>
                                                <summary>History</summary>
                                                <ul>
                                                  {sub.warningEvents.map((event, index) => (
                                                    <li key={`${event.type}-${event.occurredAt}-${index}`}>
                                                      {event.type.replaceAll('-', ' ')} · {new Date(event.occurredAt).toLocaleString('en-IN')}
                                                    </li>
                                                  ))}
                                                </ul>
                                              </details>
                                            )}
                                          </td>
                                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(sub.submittedAt).toLocaleString('en-IN')}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                              <p className="stu-drilldown-note">
                                Source code is withheld from this view. Use “Review code” on a specific submission if a submission needs investigating for academic integrity.
                              </p>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {students.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No students found.</div>}
            </div>
            {totalPages > 1 && (
              <div style={{ padding: '12px 20px', display: 'flex', gap: 8, justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
                <button className="admin-icon-button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} title="Previous page"><FiChevronLeft /></button>
                <span style={{ padding: '4px 12px', color: 'var(--text-muted)' }}>Page {page}/{totalPages}</span>
                <button className="admin-icon-button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} title="Next page"><FiChevronRight /></button>
              </div>
            )}
          </div>
        )}
      </Container>
    </div>
  );
};

export default StudentsPage;
