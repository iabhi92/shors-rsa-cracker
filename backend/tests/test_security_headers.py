def test_api_responses_carry_a_strict_csp(client):
    r = client.get("/api/health")
    assert r.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_docs_gets_a_separate_csp_that_allows_only_the_named_cdn(client):
    r = client.get("/docs")
    csp = r.headers["content-security-policy"]
    assert "cdn.jsdelivr.net" in csp
    assert "default-src 'none'" in csp


def test_standard_hardening_headers_present_on_every_response(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["referrer-policy"] == "no-referrer"
    assert "geolocation=()" in r.headers["permissions-policy"]
    assert "max-age=" in r.headers["strict-transport-security"]


def test_api_responses_are_never_cached(client):
    r = client.get("/api/health")
    assert r.headers["cache-control"] == "no-store"


def test_non_api_paths_do_not_get_the_no_store_directive(client):
    r = client.get("/docs")
    assert r.headers.get("cache-control") != "no-store"
