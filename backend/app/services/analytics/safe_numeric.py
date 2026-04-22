"""Harden numeric summaries so missing or invalid spreadsheet values never break analytics."""

from __future__ import annotations

import math
from typing import Any

import pandas as pd


def finite_float(value: Any) -> float | None:
    try:
        x = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(x):
        return None
    return x


def safe_mean(series: pd.Series) -> float | None:
    s = pd.to_numeric(series, errors="coerce")
    m = s.mean(skipna=True)
    return finite_float(m)


def safe_sum(series: pd.Series) -> float | None:
    s = pd.to_numeric(series, errors="coerce")
    total = s.sum(skipna=True)
    return finite_float(total)
