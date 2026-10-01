import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import InlineSpinner from '../../components/InlineSpinner';
import { DifficultyBadge, getDifficultyMeta } from '../../components/DifficultyBadge';
import {
  FiPlus, FiEdit3, FiTrash2, FiSearch, FiRefreshCw, FiZap, FiSave, FiX,
} from 'react-icons/fi';
import './CodingProblemManagementPage.css';

const DIFFICULTIES = ['easy', 'easy-medium', 'medium', 'medium-hard', 'hard', 'complex'];
const LANGUAGES = [
  ['python', 'Python'], ['java', 'Java'], ['javascript', 'JavaScript'], ['c', 'C'],
  ['cpp', 'C++'], ['csharp', 'C#'], ['go', 'Go'],
];

const emptyForm = () => ({
  title: '',
  difficulty: 'easy',
  points: '',
  category: 'arrays',
  tags: '',
  statement: '',
  constraints: '',
  inputFormat: '',
  outputFormat: '',
  hints: '',
  examples: [{ input: '', output: '', explanation: '' }],
  starterCode: {},
  testCases: [{ input: '', expectedOutput: '', hidden: false }],
});

/** Split a textarea's lines into an array; blank lines are dropped. */
const lines = (text) =>
  String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

const CodingProblemManagementPage = () => {
  const [problems, setProblems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [flushing, setFlushing] = useState(false);
  const [tab, setTab] = useState('content');
  // WHY a dedicated append flow instead of editing testCases in the main form:
  // the PUT endpoint REPLACES the testCases array, and the admin can only read
  // the public subset back. Editing in place would therefore silently destroy
  // every hidden case. Appending is non-destructive and matches the server API.
  const [appendFor, setAppendFor] = useState(null);
  const [appendForm, setAppendForm] = useState({ input: '', expectedOutput: '', hidden: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, adminStats] = await Promise.all([
        api.get('/coding/problems', { params: { limit: 50, sortBy: 'newest' } }),
        api.get('/coding/admin/stats'),
      ]);
      setProblems(list.data.data || []);
      setStats(adminStats.data.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load problems.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = problems.filter((p) =>
    !search.trim() ||
    p.title.toLowerCase().includes(search.trim().toLowerCase()) ||
    p.tags?.some((t) => t.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // ─── Edit: prefill from the list payload, then hydrate the full document ────
  // WHY a second fetch: the list endpoint deliberately omits statement, test cases
  // and starter code to keep the table light. Prefilling from it would silently
  // save an empty problem body over a good one on the next PUT.
  const startEdit = async (problem) => {
    setSaving(true);
    try {
      const { data } = await api.get(`/coding/problems/${problem.slug}`);
      const p = data.data;
      setForm({
        title: p.title,
        difficulty: p.difficulty,
        points: p.points ?? '',
        category: p.category || '',
        tags: (p.tags || []).join(', '),
        statement: p.statement || '',
        constraints: (p.constraints || []).join('\n'),
        inputFormat: p.inputFormat || '',
        outputFormat: p.outputFormat || '',
        hints: (p.hints || []).join('\n'),
        examples: p.examples?.length ? p.examples : [{ input: '', output: '', explanation: '' }],
        starterCode: p.starterCode || {},
        testCases: [{ input: '', expectedOutput: '', hidden: true }],
      });
      setEditingId(p._id);
      setShowForm(true);
      setTab('content');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open that problem.');
    } finally {
      setSaving(false);
    }
  };

  const startCreate = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
    setTab('content');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm()); };

  const buildPayload = () => ({
    title: form.title.trim(),
    difficulty: form.difficulty,
    // Send points only when the admin actually set one; otherwise let the model
    // hook derive the tier default.
    ...(form.points !== '' && { points: Number(form.points) }),
    category: form.category.trim() || 'arrays',
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    statement: form.statement,
    constraints: lines(form.constraints),
    inputFormat: form.inputFormat,
    outputFormat: form.outputFormat,
    hints: lines(form.hints),
    examples: form.examples.filter((e) => e.input || e.output),
    starterCode: form.starterCode,
    // WHY only keep filled cases: sending a row of two empty strings would
    // otherwise become a real test case expecting empty output.
    testCases: form.testCases.filter((tc) => tc.input !== '' || tc.expectedOutput !== ''),
  });

  const save = async () => {
    const payload = buildPayload();
    if (payload.title.length < 3) { toast.error('Title must be at least 3 characters.'); return; }
    if (payload.statement.length < 10) { toast.error('Statement must be at least 10 characters.'); return; }
    if (editingId) {
      // WHY omit testCases on update: the PUT replaces the array wholesale, and
      // the list payload only carried the PUBLIC cases. Sending them back would
      // delete every hidden case. Test cases are managed by the dedicated
      // "Add test cases" endpoint below.
      delete payload.testCases;
    }
    if (payload.testCases?.length === 0 && !editingId) {
      toast.error('Add at least one test case before creating the problem.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/coding/admin/problems/${editingId}`, payload);
        toast.success('Problem updated.');
      } else {
        await api.post('/coding/admin/problems', payload);
        toast.success('Problem created.');
      }
      closeForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (problem) => {
    if (!window.confirm(
      `Delete "${problem.title}"?\n\n` +
      'This cannot be undone. Submissions already made against it are kept but ' +
      'will no longer link to a problem.'
    )) return;
    setDeletingId(problem._id);
    try {
      const { data } = await api.delete(`/coding/admin/problems/${problem._id}`);
      const orphans = data?.data?.orphanedSubmissions || 0;
      toast.success(
        orphans > 0
          ? `Deleted. ${orphans} past submission${orphans === 1 ? '' : 's'} kept as history.`
          : 'Problem deleted.'
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  const flushCache = async () => {
    setFlushing(true);
    try {
      await api.post('/coding/admin/cache/flush');
      toast.success('Coding cache flushed.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cache flush failed.');
    } finally {
      setFlushing(false);
    }
  };

  const submitAppend = async () => {
    if (!appendFor) return;
    if (appendForm.input === '' && appendForm.expectedOutput === '') {
      toast.error('Enter an input and/or an expected output.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post(
        `/coding/admin/problems/${appendFor._id}/test-cases`,
        { testCases: [{ input: appendForm.input, expectedOutput: appendForm.expectedOutput, hidden: appendForm.hidden }], hidden: appendForm.hidden }
      );
      toast.success(
        `Added ${data.data.added} case. Problem now has ${data.data.totalTestCases} total / ${data.data.hiddenTestCases} hidden.`
      );
      setAppendFor(null);
      setAppendForm({ input: '', expectedOutput: '', hidden: true });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add that test case.');
    } finally {
      setSaving(false);
    }
  };

  const addCase = () =>
    setForm((f) => ({ ...f, testCases: [...f.testCases, { input: '', expectedOutput: '', hidden: true }] }));
  const setCase = (i, key, value) =>
    setForm((f) => ({ ...f, testCases: f.testCases.map((tc, j) => (j === i ? { ...tc, [key]: value } : tc)) }));
  const removeCase = (i) =>
    setForm((f) => ({ ...f, testCases: f.testCases.filter((_, j) => j !== i) }));

  return (
    <div className="page-wrapper admin-page">
      <div className="admin-header">
        <div>
          <span className="admin-eyebrow"><FiZap /> Coding module</span>
          <h1 className="admin-title">Coding Problems</h1>
          <p className="admin-subtitle">Author statements, starter code and hidden test cases.</p>
        </div>
        <div className="coding-head-actions">
          <button type="button" className="btn-outline-techiz" onClick={flushCache} disabled={flushing}>
            <FiRefreshCw /> {flushing ? 'Flushing…' : 'Flush cache'}
          </button>
          <button type="button" className="btn-techiz" onClick={startCreate}>
            <FiPlus /> New problem
          </button>
        </div>
      </div>

      {stats && (
        <div className="admin-stat-grid">
          <div className="stat-card admin-stat">
            <span className="stat-number">{stats.activeProblems}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-card admin-stat">
            <span className="stat-number">{stats.inactiveProblems}</span>
            <span className="stat-label">Inactive</span>
          </div>
          <div className="stat-card admin-stat">
            <span className="stat-number">{stats.totalSubmissions}</span>
            <span className="stat-label">Submissions</span>
          </div>
          <div className="stat-card admin-stat">
            <span className="stat-number">{stats.acceptedSubmissions}</span>
            <span className="stat-label">Accepted</span>
          </div>
          <div className="stat-card admin-stat">
            <span className="stat-number">{stats.acceptanceRate}%</span>
            <span className="stat-label">Acceptance</span>
          </div>
        </div>
      )}

      {/* ─── Author form ─── */}
      {showForm && (
        <div className="glass-card coding-form-card">
          <div className="coding-form-head">
            <h2>{editingId ? 'Edit problem' : 'New problem'}</h2>
            <button type="button" className="coding-tool-btn" onClick={closeForm} aria-label="Close form">
              <FiX />
            </button>
          </div>

          <div className="coding-tabs coding-tabs--form" role="tablist">
            {[
              { key: 'content', label: 'Content' },
              { key: 'starters', label: 'Starter code' },
              { key: 'tests', label: 'Test cases' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={tab === t.key ? 'is-active' : ''}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="coding-form-body">
            {tab === 'content' && (
              <div className="coding-form-grid">
                <div className="coding-field coding-field--wide">
                  <label className="techiz-label" htmlFor="cp-title">Title</label>
                  <input id="cp-title" className="techiz-input" value={form.title}
                    onChange={(e) => set('title', e.target.value)} maxLength={200} />
                </div>
                <div className="coding-field">
                  <label className="techiz-label" htmlFor="cp-diff">Difficulty</label>
                  <select id="cp-diff" className="techiz-input" value={form.difficulty}
                    onChange={(e) => set('difficulty', e.target.value)}>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{getDifficultyMeta(d).label}</option>)}
                  </select>
                </div>
                <div className="coding-field">
                  <label className="techiz-label" htmlFor="cp-points">Points</label>
                  <input id="cp-points" type="number" min="0" max="1000" className="techiz-input"
                    placeholder="default for tier" value={form.points}
                    onChange={(e) => set('points', e.target.value)} />
                </div>
                <div className="coding-field">
                  <label className="techiz-label" htmlFor="cp-cat">Category</label>
                  <input id="cp-cat" className="techiz-input" value={form.category}
                    onChange={(e) => set('category', e.target.value)} maxLength={60} />
                </div>
                <div className="coding-field">
                  <label className="techiz-label" htmlFor="cp-tags">Tags (comma separated)</label>
                  <input id="cp-tags" className="techiz-input" value={form.tags}
                    onChange={(e) => set('tags', e.target.value)} placeholder="array, math" />
                </div>
                <div className="coding-field coding-field--wide">
                  <label className="techiz-label" htmlFor="cp-stmt">Problem statement</label>
                  <textarea id="cp-stmt" className="techiz-input coding-textarea" rows={7}
                    value={form.statement} onChange={(e) => set('statement', e.target.value)} />
                </div>
                <div className="coding-field coding-field--wide">
                  <label className="techiz-label" htmlFor="cp-in">Input format</label>
                  <textarea id="cp-in" className="techiz-input coding-textarea" rows={2}
                    value={form.inputFormat} onChange={(e) => set('inputFormat', e.target.value)} />
                </div>
                <div className="coding-field coding-field--wide">
                  <label className="techiz-label" htmlFor="cp-out">Output format</label>
                  <textarea id="cp-out" className="techiz-input coding-textarea" rows={2}
                    value={form.outputFormat} onChange={(e) => set('outputFormat', e.target.value)} />
                </div>
                <div className="coding-field">
                  <label className="techiz-label" htmlFor="cp-cons">Constraints (one per line)</label>
                  <textarea id="cp-cons" className="techiz-input coding-textarea" rows={4}
                    value={form.constraints} onChange={(e) => set('constraints', e.target.value)} />
                </div>
                <div className="coding-field">
                  <label className="techiz-label" htmlFor="cp-hints">Hints (one per line)</label>
                  <textarea id="cp-hints" className="techiz-input coding-textarea" rows={4}
                    value={form.hints} onChange={(e) => set('hints', e.target.value)} />
                </div>
              </div>
            )}

            {tab === 'starters' && (
              <div className="coding-form-grid">
                <p className="coding-muted coding-field--wide">
                  Leave a language blank to fall back to the built-in template for that language.
                </p>
                {LANGUAGES.map(([key, label]) => (
                  <div key={key} className="coding-field coding-field--wide">
                    <label className="techiz-label" htmlFor={`cp-code-${key}`}>{label}</label>
                    <textarea
                      id={`cp-code-${key}`}
                      className="techiz-input coding-textarea coding-code-input"
                      rows={6}
                      spellCheck={false}
                      value={form.starterCode[key] || ''}
                      onChange={(e) => setForm((f) => ({
                        ...f, starterCode: { ...f.starterCode, [key]: e.target.value },
                      }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {tab === 'tests' && (
              <div className="coding-tests">
                <p className="coding-muted">
                  Hidden cases are never sent to the browser. Tick "hidden" for anything a student
                  must not see — the Run button only executes public cases.
                </p>
                {editingId && (
                  <div className="coding-inline-note">
                    You are editing an existing problem. Saving from this tab would REPLACE its
                    entire test-case list and drop every hidden case, so use the
                    <strong> + </strong> button on the problem row to add a case instead.
                  </div>
                )}
                {form.testCases.map((tc, i) => (
                  <div key={i} className="coding-test-row">
                    <div className="coding-field">
                      <label className="techiz-label" htmlFor={`tc-in-${i}`}>Input</label>
                      <textarea id={`tc-in-${i}`} className="techiz-input coding-textarea" rows={2}
                        value={tc.input} onChange={(e) => setCase(i, 'input', e.target.value)} />
                    </div>
                    <div className="coding-field">
                      <label className="techiz-label" htmlFor={`tc-out-${i}`}>Expected output</label>
                      <textarea id={`tc-out-${i}`} className="techiz-input coding-textarea" rows={2}
                        value={tc.expectedOutput} onChange={(e) => setCase(i, 'expectedOutput', e.target.value)} />
                    </div>
                    <div className="coding-test-meta">
                      <label className="coding-checkbox">
                        <input type="checkbox" checked={!!tc.hidden}
                          onChange={(e) => setCase(i, 'hidden', e.target.checked)} />
                        Hidden
                      </label>
                      <button type="button" className="coding-tool-btn" onClick={() => removeCase(i)}
                        aria-label={`Remove test case ${i + 1}`}><FiTrash2 /></button>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-outline-techiz" onClick={addCase}>
                  <FiPlus /> Add test case
                </button>
              </div>
            )}
          </div>

          <div className="coding-form-foot">
            <button type="button" className="btn-outline-techiz" onClick={closeForm}>Cancel</button>
            <button type="button" className="btn-techiz" onClick={save} disabled={saving}>
              <FiSave /> {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create problem'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Table ─── */}
      <div className="admin-action-bar" style={{ marginBottom: 16 }}>
        <div className="admin-search">
          <FiSearch />
          <input type="search" className="techiz-input" placeholder="Search problems…"
            value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search problems" />
        </div>
      </div>

      {loading ? (
        <div className="coding-center"><InlineSpinner /></div>
      ) : (
        <div className="admin-table-wrap techiz-card">
          <table className="techiz-table coding-table">
            <thead>
              <tr>
                <th className="coding-title-head" style={{ width: '32%' }}>Title</th>
                <th className="th-center" style={{ width: '14%' }}>Difficulty</th>
                <th className="th-center" style={{ width: '10%' }}>Points</th>
                <th className="th-center" style={{ width: '12%' }}>Submissions</th>
                <th className="th-center" style={{ width: '12%' }}>Acceptance</th>
                <th className="coding-actions-head" style={{ width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id}>
                  <td className="td-title">
                    <span className="coding-title-link">{p.title}</span>
                    {p.tags?.length > 0 && (
                      <div className="coding-tags">
                        {p.tags.slice(0, 3).map((t) => <span key={t} className="coding-tag">{t}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="td-center"><DifficultyBadge difficulty={p.difficulty} /></td>
                  <td className="td-center coding-points-cell">{p.points}</td>
                  <td className="td-center coding-points-cell">{p.totalSubmissions}</td>
                  <td className="td-center">{p.totalSubmissions > 0 ? `${p.acceptanceRate}%` : '—'}</td>
                  <td className="coding-actions-cell">
                    <div className="question-actions-cell">
                      <button type="button" className="admin-icon-button" title="Add test case"
                        onClick={() => { setAppendFor(p); setAppendForm({ input: '', expectedOutput: '', hidden: true }); }}>
                        <FiPlus />
                      </button>
                      <button type="button" className="admin-icon-button" title="Edit"
                        onClick={() => startEdit(p)} disabled={saving}><FiEdit3 /></button>
                      <button type="button" className="admin-icon-button" title="Delete"
                        onClick={() => remove(p)} disabled={deletingId === p._id}><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="coding-muted td-center">No problems match “{search}”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Append a test case (non-destructive) ─── */}
      {appendFor && (
        <div className="coding-modal-backdrop" role="dialog" aria-modal="true" aria-label="Add test case">
          <div className="coding-modal glass-card">
            <div className="coding-form-head">
              <h2>Add a test case</h2>
              <button type="button" className="coding-tool-btn" onClick={() => setAppendFor(null)} aria-label="Close">
                <FiX />
              </button>
            </div>
            <p className="coding-muted">Appending to <strong>{appendFor.title}</strong>. Existing cases are kept.</p>
            <div className="coding-field">
              <label className="techiz-label" htmlFor="ap-in">Input</label>
              <textarea id="ap-in" className="techiz-input coding-textarea" rows={3}
                value={appendForm.input} onChange={(e) => setAppendForm((f) => ({ ...f, input: e.target.value }))} />
            </div>
            <div className="coding-field">
              <label className="techiz-label" htmlFor="ap-out">Expected output</label>
              <textarea id="ap-out" className="techiz-input coding-textarea" rows={2}
                value={appendForm.expectedOutput}
                onChange={(e) => setAppendForm((f) => ({ ...f, expectedOutput: e.target.value }))} />
            </div>
            <label className="coding-checkbox">
              <input type="checkbox" checked={appendForm.hidden}
                onChange={(e) => setAppendForm((f) => ({ ...f, hidden: e.target.checked }))} />
              Hidden (never shown to students, only run on submit)
            </label>
            <div className="coding-form-foot">
              <button type="button" className="btn-outline-techiz" onClick={() => setAppendFor(null)}>Cancel</button>
              <button type="button" className="btn-techiz" onClick={submitAppend} disabled={saving}>
                <FiSave /> {saving ? 'Adding…' : 'Add case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodingProblemManagementPage;
