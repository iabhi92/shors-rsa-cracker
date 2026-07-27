"""Real HTTP security headers, applied to every response -- not aspirational text in a doc,
something you can verify yourself with `curl -I http://localhost:8000/api/health`.

Each header defends against a specific, named attack class rather than being cargo-culted:

- Content-Security-Policy: default-src 'none' -- this is a JSON API, it has no business
  loading scripts/styles/frames from anywhere, so the tightest possible policy costs nothing
  functionally and closes the door on reflected-content injection entirely (there's no HTML
  rendering surface here for XSS to land in, but defense in depth doesn't get to assume that
  stays true forever).
- X-Content-Type-Options: nosniff -- stops browsers from MIME-sniffing a JSON response into
  something executable if a client is ever tricked into treating this API's response as a
  page.
- X-Frame-Options: DENY + frame-ancestors 'none' (belt-and-suspenders, the CSP directive is
  the modern one but the header covers older browsers that don't parse frame-ancestors) --
  clickjacking defense; nothing here should ever be framed.
- Referrer-Policy: no-referrer -- API responses shouldn't leak the requesting page's URL
  (which could contain e.g. an RSA key in a query string, if someone built a client that put
  one there) to any downstream request a browser might make.
- Permissions-Policy: explicitly denies the powerful browser features this API has zero
  legitimate use for.
- Cache-Control: no-store on anything under /api/ -- responses can contain freshly-generated
  private key material; caching them (browser cache, an intermediate proxy) would be a real
  data-retention bug, not a theoretical one.

FastAPI's own interactive docs (/docs, /redoc) are the one deliberate exception: Swagger
UI/ReDoc load their JS/CSS from a CDN (jsdelivr) by default, which a default-src 'none' CSP
would break outright. Rather than silently disabling the CSP there (invisible, easy to
forget why), this module applies a separate, explicitly-scoped policy to just those paths
that allows exactly the CDN origin FastAPI's defaults use -- documented here as a real,
named tradeoff (interactive API docs vs. zero third-party origins) rather than an unexplained
carve-out.
"""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response

_DOCS_PATHS = ("/docs", "/redoc")

_API_CSP = "default-src 'none'; frame-ancestors 'none'"
_DOCS_CSP = (
    "default-src 'none'; "
    "script-src 'self' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "connect-src 'self'; "
    "frame-ancestors 'none'"
)


async def security_headers_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    response = await call_next(request)

    is_docs_path = any(request.url.path.startswith(p) for p in _DOCS_PATHS)
    response.headers["Content-Security-Policy"] = _DOCS_CSP if is_docs_path else _API_CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()"
    # HSTS only has any meaning on an actual HTTPS deployment (a browser ignores it over
    # plain HTTP) -- set unconditionally anyway so it's active the moment this sits behind
    # TLS in production, with no separate "remember to add this header" deploy step.
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"

    if request.url.path.startswith("/api/"):
        # API responses can contain freshly-generated private key material (RSA Lab) --
        # must never be cached by the browser or an intermediate proxy.
        response.headers["Cache-Control"] = "no-store"

    return response
