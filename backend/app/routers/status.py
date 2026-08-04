"""Live uptime/latency check for this project's public sites, for the portfolio's status
widget (iabhi92.online) to consume cross-origin.

Pull-based rather than a scheduled background job: this backend runs on Render's free tier,
which has no persistent worker/cron and spins the whole process down after inactivity anyway,
so a cron-driven poller would just stop running (and lose its history) the moment nobody's
looking at it -- no better than checking on request. Each GET actually re-checks a target only
if the last check is older than CHECK_INTERVAL_S; a burst of requests within that window reuses
the cached result instead of hammering crackrsa.com/taskhavens.com on every page load. History
is in-memory only and bounded to HISTORY_LIMIT points, so a cold start (the free-tier dyno
spinning back up) resets it -- this is an honest lightweight check, not a durable monitoring
system.
"""

import time
from collections import deque
from typing import TypedDict

import httpx
from fastapi import APIRouter

router = APIRouter()

CHECK_INTERVAL_S = 30
HISTORY_LIMIT = 60

TARGETS = [
    {"name": "crackrsa.com", "url": "https://crackrsa.com/"},
    {"name": "shors-rsa-cracker API", "url": "https://shors-rsa-cracker.onrender.com/api/health"},
    {"name": "taskhavens.com", "url": "https://taskhavens.com/"},
]


class CheckResult(TypedDict):
    name: str
    url: str
    up: bool
    status_code: int | None
    latency_ms: int | None
    checked_at: float


_last_result: dict[str, CheckResult] = {}
_history: dict[str, deque[CheckResult]] = {t["name"]: deque(maxlen=HISTORY_LIMIT) for t in TARGETS}


async def _check(client: httpx.AsyncClient, target: dict) -> CheckResult:
    cached = _last_result.get(target["name"])
    if cached is not None and time.time() - cached["checked_at"] < CHECK_INTERVAL_S:
        return cached

    start = time.perf_counter()
    try:
        resp = await client.get(target["url"], timeout=6.0, follow_redirects=True)
        result: CheckResult = {
            "name": target["name"],
            "url": target["url"],
            "up": resp.status_code < 500,
            "status_code": resp.status_code,
            "latency_ms": round((time.perf_counter() - start) * 1000),
            "checked_at": time.time(),
        }
    except httpx.HTTPError:
        result = {
            "name": target["name"],
            "url": target["url"],
            "up": False,
            "status_code": None,
            "latency_ms": None,
            "checked_at": time.time(),
        }

    _last_result[target["name"]] = result
    _history[target["name"]].append(result)
    return result


@router.get("")
async def get_status() -> dict:
    async with httpx.AsyncClient() as client:
        current = [await _check(client, target) for target in TARGETS]
    return {
        "current": current,
        "history": {name: list(points) for name, points in _history.items()},
    }
