import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FiEdit3, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import api from '../../api/axios';
import { DifficultyBadge } from '../../components/DifficultyBadge';
import './DebuggingProblemManagementPage.css';

const LANGUAGES = [
  ['python', 'Python'], ['java', 'Java'], ['javascript', 'JavaScript'], ['c', 'C'],
  ['cpp', 'C++'], ['csharp', 'C#'], ['go', 'Go'],
];
const DIFFICULTIES = ['easy', 'easy-medium', 'medium', 'medium-hard', 'hard', 'complex'];
const emptyLanguages = () => Object.fromEntries(LANGUAGES.map(([key]) => [key, '']));
const emptyCases = () => [{ input: '', expectedOutput: '' }];
const emptyForm = () => ({
  level: 1,
  title: '',
  description: '',
  difficulty: 'easy',
  points: 5,
  languageTemplates: emptyLanguages(),
  boilerplateCode: emptyLanguages(),
  sampleInput: '',
  sampleOutput: '',
  visibleTestCases: emptyCases(),
  hiddenTestCases: emptyCases(),
  isActive: true,
  order: 1,
});

const DebuggingProblemManagementPage = () => {
  const [problems, setProblems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState('python');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [pointsFilter, setPointsFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/debugging/admin/problems');
      setProblems(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load debugging questions.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filteredProblems = useMemo(() => problems.filter((problem) =>
    (!difficultyFilter || problem.difficulty === difficultyFilter) &&
    (!pointsFilter || String(problem.points) === pointsFilter) &&
    (!languageFilter || problem.languages?.includes(languageFilter))
  ), [problems, difficultyFilter, pointsFilter, languageFilter]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setLanguageField = (key, value) => setForm((current) => ({
    ...current,
    [key]: { ...current[key], [activeLanguage]: value },
  }));
  const setTestCase = (group, index, field, value) => setForm((current) => ({
    ...current,
    [group]: current[group].map((testCase, row) => row === index ? { ...testCase, [field]: value } : testCase),
  }));
  const addTestCase = (group) => setForm((current) => ({ ...current, [group]: [...current[group], { input: '', expectedOutput: '' }] }));
  const removeTestCase = (group, index) => setForm((current) => ({
    ...current,
    [group]: current[group].filter((_, row) => row !== index),
  }));

  const startCreate = () => {
    setForm(emptyForm());
    setEditingId(null);
    setActiveLanguage('python');
    setShowForm(true);
  };

  const startEdit = async (problem) => {
    setSaving(true);
    try {
      const { data } = await api.get(`/debugging/admin/problems/${problem._id}`);
      const current = data.data;
      setForm({
        ...emptyForm(),
        ...current,
        languageTemplates: { ...emptyLanguages(), ...current.languageTemplates },
        boilerplateCode: { ...emptyLanguages(), ...current.boilerplateCode },
        visibleTestCases: current.visibleTestCases?.length ? current.visibleTestCases : [],
        hiddenTestCases: current.hiddenTestCases?.length ? current.hiddenTestCases : [],
      });
      setEditingId(current._id);
      setActiveLanguage('python');
      setShowForm(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open that debugging question.');
    } finally {
      setSaving(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || form.description.trim().length < 10) {
      toast.error('Enter a title and a description of at least 10 characters.');
      return;
    }
    if (LANGUAGES.some(([key]) => !form.languageTemplates[key]?.trim())) {
      toast.error('Add a student template for every supported language.');
      return;
    }
    const payload = {
      ...form,
      level: Number(form.level),
      points: Number(form.points),
      order: Number(form.order),
      visibleTestCases: form.visibleTestCases.filter((testCase) => testCase.input !== '' || testCase.expectedOutput !== ''),
      hiddenTestCases: form.hiddenTestCases.filter((testCase) => testCase.input !== '' || testCase.expectedOutput !== ''),
    };
    if (!payload.visibleTestCases.length && !payload.sampleInput && !payload.sampleOutput) {
      toast.error('Add a visible test case or a sample input/output pair.');
      return;
    }
    if (!payload.hiddenTestCases.length) {
      toast.error('Add at least one hidden test case.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/debugging/admin/problems/${editingId}`, payload);
        toast.success('Debugging question updated.');
      } else {
        await api.post('/debugging/admin/problems', payload);
        toast.success('Debugging question created.');
      }
      closeForm();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.errors?.join(', ') || err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (problem) => {
    if (!window.confirm(`Delete "${problem.title}"? Existing submissions will remain in the audit history.`)) return;
    try {
      const { data } = await api.delete(`/debugging/admin/problems/${problem._id}`);
      const past = data.data?.orphanedSubmissions || 0;
      toast.success(`Question deleted. ${past} previous submission${past === 1 ? '' : 's'} kept.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    }
  };

  const renderCases = (group, label) => (
    <div className="coding-tests coding-field--wide">
      <h3>{label}</h3>
      {form[group].map((testCase, index) => (
        <div className="coding-test-row" key={`${group}-${index}`}>
          <div className="coding-field">
            <label className="techiz-label" htmlFor={`${group}-in-${index}`}>Input</label>
            <textarea id={`${group}-in-${index}`} className="techiz-input coding-textarea" rows={3}
              value={testCase.input} onChange={(event) => setTestCase(group, index, 'input', event.target.value)} />
          </div>
          <div className="coding-field">
            <label className="techiz-label" htmlFor={`${group}-out-${index}`}>Expected output</label>
            <textarea id={`${group}-out-${index}`} className="techiz-input coding-textarea" rows={3}
              value={testCase.expectedOutput} onChange={(event) => setTestCase(group, index, 'expectedOutput', event.target.value)} />
          </div>
          <button type="button" className="coding-tool-btn" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            onClick={() => removeTestCase(group, index)}><FiTrash2 /></button>
        </div>
      ))}
      <button type="button" className="btn-outline-techiz" onClick={() => addTestCase(group)}>
        <FiPlus /> Add {label.toLowerCase()}
      </button>
    </div>
  );

  return (
    <div className="page-wrapper admin-page">
      <div className="admin-header">
        <div>
          <span className="admin-eyebrow">Debugging assessment</span>
          <h1 className="admin-title">Debugging Questions</h1>
          <p className="admin-subtitle">Create separate debugging exercises with seven-language templates and private solutions.</p>
        </div>
        <button type="button" className="btn-techiz" onClick={startCreate}><FiPlus /> New debugging question</button>
      </div>

      <div className="coding-toolbar-wrap">
        <select className="coding-filter-select" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} aria-label="Filter debugging by difficulty">
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
        </select>
        <select className="coding-filter-select" value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} aria-label="Filter debugging by language">
          <option value="">All Languages</option>
          {LANGUAGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select className="coding-filter-select" value={pointsFilter} onChange={(event) => setPointsFilter(event.target.value)} aria-label="Filter debugging by points">
          <option value="">All Points</option>
          {[...new Set(problems.map((problem) => problem.points))].sort((a, b) => a - b)
            .map((points) => <option key={points} value={points}>{points} points</option>)}
        </select>
      </div>

      {showForm && (
        <form className="glass-card coding-form-card" onSubmit={save}>
          <div className="coding-form-head">
            <h2>{editingId ? 'Edit debugging question' : 'New debugging question'}</h2>
            <button type="button" className="coding-tool-btn" onClick={closeForm} aria-label="Close form"><FiX /></button>
          </div>
          <div className="coding-form-body coding-form-grid">
            <div className="coding-field">
              <label className="techiz-label" htmlFor="debug-level">Level</label>
              <select id="debug-level" className="techiz-input" value={form.level}
                onChange={(event) => setField('level', event.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((level) => <option key={level} value={level}>Level {level}</option>)}
              </select>
            </div>
            <div className="coding-field">
              <label className="techiz-label" htmlFor="debug-title">Title</label>
              <input id="debug-title" className="techiz-input" value={form.title}
                onChange={(event) => setField('title', event.target.value)} maxLength={200} required />
            </div>
            <div className="coding-field">
              <label className="techiz-label" htmlFor="debug-difficulty">Difficulty</label>
              <select id="debug-difficulty" className="techiz-input" value={form.difficulty}
                onChange={(event) => setField('difficulty', event.target.value)}>
                {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
              </select>
            </div>
            <div className="coding-field">
              <label className="techiz-label" htmlFor="debug-points">Points</label>
              <input id="debug-points" type="number" min="0" max="1000" className="techiz-input"
                value={form.points} onChange={(event) => setField('points', event.target.value)} required />
            </div>
            <div className="coding-field coding-field--wide">
              <label className="techiz-label" htmlFor="debug-description">Description</label>
              <textarea id="debug-description" className="techiz-input coding-textarea" rows={6}
                value={form.description} onChange={(event) => setField('description', event.target.value)} required />
            </div>

            <div className="coding-field coding-field--wide">
              <label className="techiz-label" htmlFor="debug-language">Language authoring view</label>
              <select id="debug-language" className="techiz-input" value={activeLanguage}
                onChange={(event) => setActiveLanguage(event.target.value)}>
                {LANGUAGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            {[
              ['languageTemplates', 'Student code template'],
              ['boilerplateCode', 'Boilerplate code'],
            ].map(([key, label]) => (
              <div className="coding-field coding-field--wide" key={key}>
                <label className="techiz-label" htmlFor={`debug-${key}`}>{label}</label>
                <textarea id={`debug-${key}`} className="techiz-input coding-textarea coding-code-input" rows={12}
                  spellCheck={false} value={form[key][activeLanguage] || ''}
                  onChange={(event) => setLanguageField(key, event.target.value)} />
              </div>
            ))}
            <div className="coding-field">
              <label className="techiz-label" htmlFor="debug-sample-in">Sample input</label>
              <textarea id="debug-sample-in" className="techiz-input coding-textarea" rows={3}
                value={form.sampleInput} onChange={(event) => setField('sampleInput', event.target.value)} />
            </div>
            <div className="coding-field">
              <label className="techiz-label" htmlFor="debug-sample-out">Sample output</label>
              <textarea id="debug-sample-out" className="techiz-input coding-textarea" rows={3}
                value={form.sampleOutput} onChange={(event) => setField('sampleOutput', event.target.value)} />
            </div>
            {renderCases('visibleTestCases', 'Visible test cases')}
            {renderCases('hiddenTestCases', 'Hidden test cases')}
          </div>
          <div className="coding-form-foot">
            <button type="button" className="btn-outline-techiz" onClick={closeForm}>Cancel</button>
            <button type="submit" className="btn-techiz" disabled={saving}>{saving ? 'Saving…' : 'Save question'}</button>
          </div>
        </form>
      )}

      <div className="coding-table-card">
        <table className="coding-problems-table">
          <thead><tr><th>Level</th><th>Title</th><th>Difficulty</th><th>Points</th><th>Languages</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredProblems.map((problem) => (
              <tr key={problem._id}>
                <td>{problem.level}</td>
                <td>{problem.title}</td>
                <td><DifficultyBadge difficulty={problem.difficulty} /></td>
                <td>{problem.points}</td>
                <td>{LANGUAGES.filter(([key]) => problem.languages?.includes(key)).map(([, label]) => label).join(', ')}</td>
                <td>{problem.isActive ? 'Active' : 'Inactive'}</td>
                <td>
                  <button type="button" className="coding-tool-btn" onClick={() => void startEdit(problem)} disabled={saving} aria-label={`Edit ${problem.title}`}><FiEdit3 /></button>
                  <button type="button" className="coding-tool-btn" onClick={() => void remove(problem)} aria-label={`Delete ${problem.title}`}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
            {!filteredProblems.length && <tr><td colSpan="7">No debugging questions match those filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DebuggingProblemManagementPage;
