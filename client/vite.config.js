import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // WHY no manualChunks here: an earlier version forced everything matching
    // /monaco-editor/ — which also matches the `?worker` sub-paths — into one
    // named chunk. That merged the dynamic import's boundary away and Vite
    // emitted a <link rel="modulepreload"> for 4.5 MB of editor on every cold
    // start, including for students who only take MCQ assessments.
    //
    // `src/lib/monaco.js` is loaded with a dynamic import() and Vite's default
    // splitting keeps it (and the Monaco workers) in async chunks that are only
    // fetched when a student actually opens a problem. Verified by the absence
    // of a monaco modulepreload link in dist/index.html.
    chunkSizeWarningLimit: 5500,
  },
  worker: {
    // The `?worker` imports in lib/monaco.js are served through Vite's worker
    // pipeline as ES modules.
    format: 'es',
  },
});
