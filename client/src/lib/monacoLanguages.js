/**
 * Monaco language-id map, kept in its own module with NO monaco-editor import.
 *
 * WHY: this is a 7-line constant, but it is consumed by MonacoEditor on first
 * render, before Monaco is ready. If it lived in `lib/monaco.js` the static
 * import graph would pull all ~4.5 MB of Monaco into the initial bundle, which
 * is exactly what the lazy loading in MonacoEditor exists to avoid.
 *
 * Keys mirror server/config/languages.js; `value` is the id Monaco's built-in
 * language grammars use (note: C# and C++ are `csharp` and `cpp`, not their
 * display names).
 */
export const MONACO_LANGUAGE_BY_KEY = {
  python: 'python',
  java: 'java',
  javascript: 'javascript',
  c: 'c',
  cpp: 'cpp',
  csharp: 'csharp',
  go: 'go',
};

export default MONACO_LANGUAGE_BY_KEY;
