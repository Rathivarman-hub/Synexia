import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

// Vite runs in strict mode, so the global must be declared explicitly.
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// Hand the locally-bundled instance to @monaco-editor/react so it never tries
// to download one from a CDN.
loader.config({ monaco });

// ─── SYNEXIA themes ───────────────────────────────────────────────────────────
// WHY custom themes instead of stock 'vs-dark': the coding page is the one
// screen where the editor dominates the viewport, and a stock theme next to a
// branded navy/magenta shell reads as two different products. These inherit
// from the built-ins so all tokenisation stays correct and only the palette is
// overridden.
monaco.editor.defineTheme('synexia-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6B7A99', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'E6008C' },
    { token: 'string', foreground: '4ADE80' },
    { token: 'number', foreground: 'FBBF24' },
    { token: 'type', foreground: '60A5FA' },
    { token: 'function', foreground: '93C5FD' },
  ],
  colors: {
    'editor.background': '#0B1424',
    'editor.foreground': '#E2E8F0',
    'editorLineNumber.foreground': '#3C4A63',
    'editorLineNumber.activeForeground': '#93C5FD',
    'editorCursor.foreground': '#E6008C',
    'editor.selectionBackground': '#00339966',
    'editor.inactiveSelectionBackground': '#00236644',
    'editor.lineHighlightBackground': '#0F1B2E',
    'editorIndentGuide.background1': '#1E293B',
    'editorIndentGuide.activeBackground1': '#334155',
    'editorGutter.background': '#0B1424',
    'editorWidget.background': '#0E182D',
    'editorWidget.border': '#1E293B',
    'editorSuggestWidget.background': '#0E182D',
    'editorSuggestWidget.border': '#1E293B',
    'scrollbarSlider.background': '#33415555',
    'scrollbarSlider.hoverBackground': '#D1007A55',
    'scrollbarSlider.activeBackground': '#D1007A88',
  },
});

monaco.editor.defineTheme('synexia-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6B7A99', fontStyle: 'italic' },
    { token: 'keyword', foreground: '#B8006C' },
    { token: 'string', foreground: '#047857' },
    { token: 'number', foreground: '#B45309' },
    { token: 'type', foreground: '#1D4ED8' },
    { token: 'function', foreground: '#1E40AF' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#0B132B',
    'editorLineNumber.foreground': '#A8B3C7',
    'editorLineNumber.activeForeground': '#002366',
    'editorCursor.foreground': '#D1007A',
    'editor.selectionBackground': '#0033991A',
    'editor.lineHighlightBackground': '#F4F7FB',
    'editorIndentGuide.background1': '#E2E8F0',
    'editorIndentGuide.activeBackground1': '#94A3B8',
    'editorGutter.background': '#FFFFFF',
    'editorWidget.background': '#FFFFFF',
    'editorSuggestWidget.background': '#FFFFFF',
  },
});

// WHY the language map is NOT here: it is needed on first render, before Monaco
// loads, and importing it from this module would drag all of Monaco into the
// initial bundle. It lives in ./monacoLanguages.js.
export default monaco;
