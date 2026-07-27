"""Environment-driven configuration. No secrets live here -- CORS origins are the only
externally-configurable value the backend needs, and IBM credentials are deliberately never
read into this process at all (see limits.py and routers/ibm.py's module docstrings)."""

import os
from functools import lru_cache
from pathlib import Path


class Settings:
    def __init__(self) -> None:
        _load_dotenv_if_present()
        origins = os.environ.get("CORS_ALLOW_ORIGINS", "http://localhost:5173")
        self.cors_allow_origins: list[str] = [o.strip() for o in origins.split(",") if o.strip()]


def _load_dotenv_if_present() -> None:
    """Optional: backend/.env for local overrides (see backend/.env.example). Doesn't hard-
    require python-dotenv as a dependency -- if it's not installed, environment variables set
    another way (shell export, Docker, deployment platform) still work fine."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)


@lru_cache
def get_settings() -> Settings:
    return Settings()
