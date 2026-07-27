def test_docs_index_lists_all_pages(client):
    r = client.get("/api/docs")
    assert r.status_code == 200
    slugs = {p["slug"] for p in r.json()["pages"]}
    assert {"security", "shors-algorithm-math", "gate-level-modexp", "real-hardware-validation"} <= slugs


def test_docs_security_page_renders_security_md(client):
    r = client.get("/api/docs/security")
    assert r.status_code == 200
    assert "textbook RSA" in r.json()["content_markdown"] or "RSA" in r.json()["content_markdown"]


def test_docs_does_not_serve_ai_usage_log():
    # AI_USAGE.md is a real development record kept for project/grading requirements, not
    # public-facing site content -- deliberately excluded from the whitelist, not just hidden
    # from navigation.
    from backend.app.routers.docs import _PAGES

    assert "journey" not in _PAGES
    assert not any(path.name == "AI_USAGE.md" for _, path in _PAGES.values())


def test_docs_rejects_unknown_slug(client):
    r = client.get("/api/docs/nonexistent")
    assert r.status_code == 404


def test_docs_path_traversal_attempt_does_not_escape_the_whitelist(client):
    # slug is looked up in an explicit dict, never used to build a filesystem path directly --
    # this should 404 (or 400 from routing), never return arbitrary file contents.
    r = client.get("/api/docs/..%2F..%2F..%2Fetc%2Fpasswd")
    assert r.status_code in (400, 404)
    assert "root:" not in r.text
