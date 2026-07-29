"""Renders this project's own Markdown notes/SECURITY.md inside the site, instead of
duplicating their content by hand. `slug` is looked up in an explicit whitelist dict below --
never used to build a filesystem path directly, so path traversal via the API is not a
possible attack shape here regardless of what a client sends."""

from pathlib import Path

from fastapi import APIRouter

from backend.app.errors import AppError
from backend.app.schemas.docs import DocIndexEntry, DocIndexResponse, DocPage

router = APIRouter()

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent

_PAGES: dict[str, tuple[str, Path]] = {
    "quantum-basics": ("Quantum Basics", _REPO_ROOT / "notes" / "01-quantum-basics.md"),
    "qft-and-period-finding": ("QFT & Period-Finding", _REPO_ROOT / "notes" / "02-qft-and-period-finding.md"),
    "shors-algorithm-math": ("Shor's Algorithm: The Math", _REPO_ROOT / "notes" / "03-shors-algorithm-math.md"),
    "gate-level-modexp": (
        "Gate-Level Modular Exponentiation",
        _REPO_ROOT / "notes" / "04-gate-level-modular-exponentiation.md",
    ),
    "real-hardware-validation": (
        "Real Hardware Validation",
        _REPO_ROOT / "notes" / "05-real-hardware-validation.md",
    ),
    "security": ("Security & Limitations", _REPO_ROOT / "SECURITY.md"),
}


@router.get("", response_model=DocIndexResponse)
def index() -> DocIndexResponse:
    return DocIndexResponse(
        pages=[DocIndexEntry(slug=slug, title=title, source_file=path.name) for slug, (title, path) in _PAGES.items()]
    )


@router.get("/{slug}", response_model=DocPage)
def get_page(slug: str) -> DocPage:
    entry = _PAGES.get(slug)
    if entry is None:
        raise AppError(f"Unknown documentation page '{slug}'", status_code=404)
    title, path = entry
    if not path.exists():
        raise AppError(f"Source file for '{slug}' is missing from the repository", status_code=404)
    return DocPage(slug=slug, title=title, source_file=path.name, content_markdown=path.read_text())
