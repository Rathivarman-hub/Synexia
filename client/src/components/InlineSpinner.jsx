import React from 'react';

/**
 * Inline loading indicator.
 *
 * WHY this exists instead of reusing the shared <Spinner>: that component is a
 * full-viewport `loading-screen` (min-height: 100vh). Dropping it inside the
 * editor pane or a table cell would blank the whole page and push the layout
 * down, which is exactly the wrong behaviour for a refresh.
 */
const InlineSpinner = ({ label = '', size = 26 }) => (
  <div className="inline-spinner" role="status" aria-live="polite">
    <span
      className="inline-spinner-ring"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 9)) }}
      aria-hidden="true"
    />
    {label ? <span className="inline-spinner-label">{label}</span> : <span className="visually-hidden">Loading</span>}
  </div>
);

export default InlineSpinner;
