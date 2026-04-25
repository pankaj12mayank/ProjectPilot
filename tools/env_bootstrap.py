"""
One-time env file creation for fresh clones (no secrets invented — copies tracked examples).

Can be imported by optional tooling; run.bat / run.sh copy .env without this module.
"""

from __future__ import annotations

import shutil
from pathlib import Path


def ensure_env_from_example(repo: Path, example_rel: str, dest_rel: str) -> bool:
    """
    If dest is missing and example exists, copy example -> dest.

    Returns True if a file was created.
    """
    example = repo / example_rel
    dest = repo / dest_rel
    if dest.is_file():
        return False
    if not example.is_file():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(example, dest)
    return True
