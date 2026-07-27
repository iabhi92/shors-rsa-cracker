// Redirects `import katex from 'katex'` (used internally by react-katex) to the untouched
// global instance loaded via a plain <script> tag in index.html -- see the comment there for
// why: the bundler corrupts KaTeX's own copy of this module. Aliased in vite.config.ts.
declare global {
  interface Window {
    katex: unknown
  }
}

export default window.katex
