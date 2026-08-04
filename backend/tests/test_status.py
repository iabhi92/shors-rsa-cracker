from unittest.mock import AsyncMock, patch

import httpx

from backend.app.routers import status as status_module


def _reset_status_state() -> None:
    status_module._last_result.clear()
    for points in status_module._history.values():
        points.clear()


def test_status_reports_all_targets_up(client):
    _reset_status_state()
    fake_response = httpx.Response(200, request=httpx.Request("GET", "https://example.com"))
    with patch.object(httpx.AsyncClient, "get", new=AsyncMock(return_value=fake_response)):
        r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert len(body["current"]) == 3
    assert all(target["up"] for target in body["current"])
    assert all(target["status_code"] == 200 for target in body["current"])
    assert all(target["latency_ms"] is not None for target in body["current"])
    assert set(body["history"]) == {target["name"] for target in body["current"]}


def test_status_reports_down_target_on_connection_error(client):
    _reset_status_state()
    with patch.object(httpx.AsyncClient, "get", new=AsyncMock(side_effect=httpx.ConnectError("boom"))):
        r = client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert all(target["up"] is False for target in body["current"])
    assert all(target["status_code"] is None for target in body["current"])
    assert all(target["latency_ms"] is None for target in body["current"])


def test_status_caches_within_the_check_interval(client):
    # A burst of requests within CHECK_INTERVAL_S should hit the cache, not re-check every
    # target on every request -- that's the whole reason this isn't a naive "ping on every
    # GET" endpoint (see status.py's module docstring).
    _reset_status_state()
    fake_response = httpx.Response(200, request=httpx.Request("GET", "https://example.com"))
    mock_get = AsyncMock(return_value=fake_response)
    with patch.object(httpx.AsyncClient, "get", new=mock_get):
        client.get("/api/status")
        client.get("/api/status")
    assert mock_get.call_count == len(status_module.TARGETS)


def test_status_history_accumulates_across_stale_checks(client):
    _reset_status_state()
    fake_response = httpx.Response(200, request=httpx.Request("GET", "https://example.com"))
    with patch.object(httpx.AsyncClient, "get", new=AsyncMock(return_value=fake_response)):
        client.get("/api/status")
        # Force the cache to look stale without waiting CHECK_INTERVAL_S in real time.
        for result in status_module._last_result.values():
            result["checked_at"] = 0.0
        r = client.get("/api/status")
    for points in r.json()["history"].values():
        assert len(points) == 2
