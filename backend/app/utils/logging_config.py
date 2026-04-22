import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.config.settings import get_settings


def setup_logging() -> None:
    settings = get_settings()
    log_path: Path = settings.logs_dir / "app.log"
    root = logging.getLogger()
    if root.handlers:
        return
    root.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    fh = RotatingFileHandler(
        log_path,
        maxBytes=2_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    fh.setFormatter(fmt)
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    root.addHandler(fh)
    root.addHandler(ch)
