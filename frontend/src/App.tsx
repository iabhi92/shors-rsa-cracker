import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import HomePage from './pages/HomePage'

const GuidePage = lazy(() => import('./pages/GuidePage'))
const RsaLabPage = lazy(() => import('./pages/RsaLabPage'))
const SecurityLabPage = lazy(() => import('./pages/SecurityLabPage'))
const SecurityDashboardPage = lazy(() => import('./pages/SecurityDashboardPage'))
const ClassicalAttackPage = lazy(() => import('./pages/ClassicalAttackPage'))
const ClassicalBenchmarkPage = lazy(() => import('./pages/ClassicalBenchmarkPage'))
const QuantumFundamentalsPage = lazy(() => import('./pages/QuantumFundamentalsPage'))
const QftPage = lazy(() => import('./pages/QftPage'))
const ShorLabPage = lazy(() => import('./pages/ShorLabPage'))
const CircuitExplorerPage = lazy(() => import('./pages/CircuitExplorerPage'))
const SimulatorComparisonPage = lazy(() => import('./pages/SimulatorComparisonPage'))
const ResourceEstimatePage = lazy(() => import('./pages/ResourceEstimatePage'))
const IbmHardwarePage = lazy(() => import('./pages/IbmHardwarePage'))
const DocPage = lazy(() => import('./pages/DocPage'))
const DocsIndexPage = lazy(() => import('./pages/DocsIndexPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spinner label="Loading page…" />}>
      {children}
    </Suspense>
  )
}

export default function App() {
  return (
    // BASE_URL is Vite's own base-path env var, set from vite.config.ts's `base` option --
    // '/' locally and in the Docker/nginx setup, '/shors-rsa-cracker/' on GitHub Pages, where
    // the app is served from a subpath rather than the domain root. Without this, every
    // internal Link/navigate() resolves against '/', which strips the subpath from the URL
    // entirely on click (landing on the wrong origin-root page instead of a route under it).
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="guide" element={<LazyPage><GuidePage /></LazyPage>} />
          <Route path="rsa" element={<LazyPage><RsaLabPage /></LazyPage>} />
          <Route path="malleability-lab" element={<LazyPage><SecurityLabPage /></LazyPage>} />
          <Route path="classical-attacks" element={<LazyPage><ClassicalAttackPage /></LazyPage>} />
          <Route path="classical-benchmark" element={<LazyPage><ClassicalBenchmarkPage /></LazyPage>} />
          <Route path="quantum-fundamentals" element={<LazyPage><QuantumFundamentalsPage /></LazyPage>} />
          <Route path="qft" element={<LazyPage><QftPage /></LazyPage>} />
          <Route path="shor" element={<LazyPage><ShorLabPage /></LazyPage>} />
          <Route path="circuit-explorer" element={<LazyPage><CircuitExplorerPage /></LazyPage>} />
          <Route path="simulator-comparison" element={<LazyPage><SimulatorComparisonPage /></LazyPage>} />
          <Route path="resource-estimate" element={<LazyPage><ResourceEstimatePage /></LazyPage>} />
          <Route path="ibm-hardware" element={<LazyPage><IbmHardwarePage /></LazyPage>} />
          <Route path="security-dashboard" element={<LazyPage><SecurityDashboardPage /></LazyPage>} />
          <Route path="security" element={<LazyPage><DocPage forcedSlug="security" /></LazyPage>} />
          <Route path="docs" element={<LazyPage><DocsIndexPage /></LazyPage>} />
          <Route path="docs/:slug" element={<LazyPage><DocPage /></LazyPage>} />
          <Route path="history" element={<LazyPage><HistoryPage /></LazyPage>} />
          <Route path="*" element={<LazyPage><NotFoundPage /></LazyPage>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
