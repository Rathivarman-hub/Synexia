import React from 'react';

// ─── Coding difficulty taxonomy (client mirror) ───────────────────────────────
// WHY duplicated instead of fetched: the badge is rendered inside table rows and
// page headers that must paint before any request resolves. The canonical
// source is server/models/CodingProblem.js — keep the two in sync. Values match
// the server enum exactly; a mismatch here would render an "Unknown" pill
// rather than fail loudly, so treat this as a contract, not a preference.
export const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)' },
  { key: 'easy-medium', label: 'Easy-Medium', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.14)' },
  { key: 'medium', label: 'Medium', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.14)' },
  { key: 'medium-hard', label: 'Medium-Hard', color: '#F97316', bg: 'rgba(249, 115, 22, 0.14)' },
  { key: 'hard', label: 'Hard', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.14)' },
  { key: 'complex', label: 'Complex', color: '#D1007A', bg: 'rgba(209, 0, 122, 0.16)' },
];

const LOOKUP = DIFFICULTIES.reduce((acc, d) => {
  acc[d.key] = d;
  return acc;
}, {});

const FALLBACK = { key: 'unknown', label: 'Unknown', color: '#707991', bg: 'rgba(112, 121, 145, 0.14)' };

export const getDifficultyMeta = (key) => LOOKUP[key] || FALLBACK;

export const DifficultyBadge = ({ difficulty, size = 'md' }) => {
  const meta = getDifficultyMeta(difficulty);
  return (
    <span
      className={`difficulty-badge difficulty-badge--${size}`}
      style={{ color: meta.color, background: meta.bg, borderColor: `${meta.color}44` }}
    >
      {meta.label}
    </span>
  );
};

/** Green check / amber dot / hollow ring for the per-row solve status. */
export const StatusBadge = ({ status = 'none' }) => {
  if (status === 'solved') {
    return <span className="status-badge status-badge--solved" title="Solved">Solved</span>;
  }
  if (status === 'attempted') {
    return <span className="status-badge status-badge--attempted" title="Attempted but not yet solved">Attempted</span>;
  }
  return <span className="status-badge status-badge--none" title="Not attempted">Not attempted</span>;
};

export default DifficultyBadge;
