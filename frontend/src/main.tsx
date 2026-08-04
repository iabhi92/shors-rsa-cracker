import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// React Router matches routes exactly ('/guide', not '/guide/') -- a trailing slash falls
// through to the 404 route with no visible error. GitHub Pages' static-file resolution can add
// one (a request for /guide served from a prerendered guide/index.html on disk keeps the
// browser at /guide/, not /guide), so this normalizes it away before BrowserRouter ever reads
// the path, rather than trying to guess exactly which of GitHub Pages' resolution behaviors
// applies to which of the prerendered file layouts scripts/prerender.mjs produces.
if (window.location.pathname.length > 1 && window.location.pathname.endsWith('/')) {
  const withoutTrailingSlash = window.location.pathname.slice(0, -1) + window.location.search + window.location.hash
  window.history.replaceState(null, '', withoutTrailingSlash)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
