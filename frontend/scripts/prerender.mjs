#!/usr/bin/env node
// Prerenders every static route into a real file at dist/<route>/index.html.
//
// Why this exists: GitHub Pages has no server-side rewrites, so the SPA fallback trick
// (deploy-pages.yml copies dist/index.html to dist/404.html) is the only way a deep link like
// /guide works for a real visitor -- but GitHub Pages serves that fallback with an actual
// HTTP 404 status, which browsers ignore (they already have the HTML+JS and route client-side)
// but Google Search Console's URL Inspection tool does not: it reported "Page cannot be
// indexed: Not found (404)" for /guide even though the page works fine for a human. Nothing
// except the homepage was ever indexable.
//
// The fix: after `vite build`, spin up a local static server with the same SPA-fallback
// behavior, visit every route listed in the just-built sitemap.xml with a real headless
// browser, let the app render (Layout.tsx's usePageMeta effect sets the per-route
// title/description/canonical during this render), and save the resulting DOM as a real static
// file. GitHub Pages then serves that file directly with a normal 200 for that exact path --
// no fallback involved -- while a real visitor's browser still re-executes the same bundled JS
// and takes over exactly as before (main.tsx does a plain client-only render(), not hydrate(),
// so there's no hydration-mismatch risk either way).
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
}

function serveSpa(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0])
  const candidates = urlPath === '/' ? ['/index.html'] : [urlPath, `${urlPath}/index.html`, `${urlPath}.html`]
  for (const candidate of candidates) {
    const filePath = path.join(distDir, candidate)
    if (existsSync(filePath) && !filePath.endsWith(path.sep)) {
      readFile(filePath)
        .then((body) => {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' })
          res.end(body)
        })
        .catch(() => res.writeHead(500).end())
      return
    }
  }
  // SPA fallback -- same role dist/404.html plays on GitHub Pages, just without the 404 status
  // (this local server exists only to let the headless browser render client-side routes; the
  // whole point of this script is producing files that don't need to fall back once deployed).
  readFile(path.join(distDir, 'index.html'))
    .then((body) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(body)
    })
    .catch(() => res.writeHead(404).end())
}

async function routesFromSitemap() {
  const xml = await readFile(path.join(distDir, 'sitemap.xml'), 'utf-8')
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
  return matches.map((m) => new URL(m[1]).pathname)
}

async function main() {
  const routes = await routesFromSitemap()
  console.log(`Prerendering ${routes.length} routes: ${routes.join(', ')}`)

  const server = createServer(serveSpa)
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  const baseUrl = `http://localhost:${port}`

  const browser = await chromium.launch()
  const page = await browser.newPage()

  let failures = 0
  for (const route of routes) {
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 30_000 })
      // Layout.tsx's title/meta effect and any first-paint data fetch run just after load;
      // this is a fixed wait rather than 'networkidle' because a couple of pages (e.g. the
      // IBM hardware page's live-status polling) keep the network busy indefinitely once
      // mounted, which would make 'networkidle' hang forever instead of resolving.
      await page.waitForTimeout(700)
      let html = await page.content()

      // React Router's lazy() route loading inserts <link rel="modulepreload"> hints into
      // document.head at runtime for whatever chunk it's about to import -- built as absolute
      // URLs against the page's own origin, which at capture time is this script's local
      // server (some random port from server.listen(0, ...), not the real deployed domain).
      // Vite's own build-time modulepreload hints are already root-relative and untouched by
      // this; only the runtime-injected ones carry the wrong origin baked in. Left as-is, the
      // deployed page would try to load JS from e.g. http://localhost:55763/... and get
      // blocked by the CSP's script-src 'self' the instant a browser tried to render it.
      html = html.split(baseUrl).join('')
      if (html.includes('localhost')) {
        throw new Error(`prerendered ${route} still references localhost after stripping ${baseUrl} -- check for a different port/host format`)
      }

      if (route === '/') {
        await writeFile(path.join(distDir, 'index.html'), html)
      } else {
        // Written both ways since it's cheap and removes any ambiguity about which one
        // GitHub Pages' clean-URL resolution actually prefers for a request with no trailing
        // slash and no extension (the shape every in-app <Link> generates): a flat
        // <route>.html avoids a redirect entirely if that's the one it checks first, and
        // <route>/index.html covers it if Pages resolves the directory form instead.
        const slug = route.replace(/^\//, '')
        await writeFile(path.join(distDir, `${slug}.html`), html)
        const outDir = path.join(distDir, slug)
        await mkdir(outDir, { recursive: true })
        await writeFile(path.join(outDir, 'index.html'), html)
      }
      console.log(`  ✓ ${route}`)
    } catch (err) {
      failures++
      console.error(`  ✗ ${route}: ${err.message}`)
    }
  }

  await browser.close()
  server.close()

  if (failures > 0) {
    console.error(`${failures} of ${routes.length} routes failed to prerender.`)
    process.exit(1)
  }
}

main()
