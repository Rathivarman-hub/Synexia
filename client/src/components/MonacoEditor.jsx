import React, { forwardRef, useState, useCallback, useRef, useEffect, useImperativeHandle } from 'react';
import Editor from '@monaco-editor/react';
import { MONACO_LANGUAGE_BY_KEY } from '../lib/monacoLanguages';
import { useTheme } from '../context/ThemeContext';

// ─── MonacoEditor ─────────────────────────────────────────────────────────────
// WHY Monaco is loaded through a dynamic `import()` rather than a static one:
// Monaco is ~4.5 MB of grammar, tokeniser and worker code. A static import from
// anywhere in the App graph puts it in the initial download, so a student who
// only ever takes an MCQ assessment would pay that cost on every cold start.
// `lib/monaco` is only reached once this component actually mounts, i.e. when
// someone opens a problem and starts writing code.
//
// WHY rendering is gated on that import: `@monaco-editor/react` falls back to
// fetching Monaco from the jsDelivr CDN unless `loader.config({ monaco })` has
// already run. If `<Editor>` mounted first it would silently start a CDN
// download — broken on a locked-down campus network and a third-party runtime
// dependency. Gating the render is what makes the local bundle authoritative.
//
// WHY the fallback textarea is not optional: if the worker bundle fails to load
// (a proxy that strips workers, an old browser), a blank white rectangle is
// unusable. A plain <textarea> still lets the student write and submit code, so
// the failure mode is degraded rather than blocking.
const MonacoEditor = forwardRef(({
  value,
  onChange,
  language = 'python',
  height = '100%',
  readOnly = false,
  onRunShortcut,
  onSubmitShortcut,
  ariaLabel = 'Code editor',
}, ref) => {
  const { isDark } = useTheme();
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const editorRef = useRef(null);

  useImperativeHandle(ref, () => ({
    layout: () => editorRef.current?.layout(),
  }), []);

  const monacoLanguage = MONACO_LANGUAGE_BY_KEY[language] || 'plaintext';

  useEffect(() => {
    let cancelled = false;
    import('../lib/monaco')
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => {
        if (cancelled) return;
        // Fall back to the plain textarea rather than rendering a dead pane.
        setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  // WHY keep the value in a ref: re-registering this listener on every keystroke
  // would detach/reattach the command on each character, which is measurably
  // janky for a large file. Read the latest value through the ref instead.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const shortcutsRef = useRef({ onRunShortcut, onSubmitShortcut });
  shortcutsRef.current = { onRunShortcut, onSubmitShortcut };

  const handleBeforeMount = useCallback((monaco) => {
    // WHY disable semantic diagnostics for JS/TS: student submissions are
    // standalone stdin/stdout programs, not modules in a project. Monaco's
    // default JS settings flag `require` and top-level `return` as errors, which
    // would paint red squiggles on perfectly correct solutions and undermine
    // confidence in the editor. Syntax errors still surface through the judge.
    const jsConfig = monaco.languages.typescript?.javascriptDefaults;
    if (jsConfig) {
      jsConfig.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        allowJs: true,
        checkJs: false,
        noLib: false,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      });
      jsConfig.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });
    }
  }, []);

  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    setReady(true);

    editor.addCommand(monaco.KeyCode.F9, () => shortcutsRef.current.onRunShortcut?.());
    editor.addCommand(monaco.KeyCode.F12, () => shortcutsRef.current.onSubmitShortcut?.());

    // WHY focus the editor on mount: a student who clicked through to this page
    // expects to start typing, not hunt for the pane first.
    editor.focus();
  }, []);

  if (loadError) {
    return (
      <div className="monaco-fallback" role="region" aria-label={ariaLabel}>
        <div className="monaco-fallback-notice">
          The rich editor could not be loaded. A basic editor is shown instead — your
          code will still run and submit normally.
        </div>
        <textarea
          className="monaco-fallback-textarea"
          value={value}
          onChange={(e) => onChangeRef.current?.(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          aria-label={ariaLabel}
          style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.85rem' }}
        />
      </div>
    );
  }

  return (
    <div className={`monaco-wrapper${ready ? ' is-ready' : ''}`} style={{ height }}>
      {ready ? (
        <Editor
          height={height}
          language={monacoLanguage}
          value={value}
          theme={isDark ? 'synexia-dark' : 'synexia-light'}
          onChange={(next) => onChangeRef.current?.(next ?? '')}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          loading={<div className="monaco-loading">Loading editor…</div>}
          options={{
            readOnly,
            domReadOnly: readOnly,
            ariaLabel,
            // ─── Required by the brief
            fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
            fontSize: 13.5,
            lineHeight: 21,
            lineNumbers: 'on',
            // ─── LeetCode-style ergonomics
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            insertSpaces: true,
            detectIndentation: true,
            bracketPairColorization: { enabled: true },
            guides: { indentation: true, bracketPairs: true },
            renderLineHighlight: 'line',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            padding: { top: 14, bottom: 14 },
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            fixedOverflowWidgets: true,
            // Keep undo/redo working across Ctrl+Z after a language switch.
            unicodeHighlight: { ambiguousCharacters: false },
          }}
        />
      ) : (
        // WHY a real placeholder rather than the textarea: Monaco is a
        // one-time ~4.5 MB fetch on first visit. Showing the textarea
        // immediately would let a student start typing into a control that is
        // about to be replaced, losing the keystrokes.
        <div className="monaco-loading">Loading editor…</div>
      )}
    </div>
  );
});

MonacoEditor.displayName = 'MonacoEditor';

export default MonacoEditor;
