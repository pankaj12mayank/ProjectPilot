"""Parse uploaded Excel / CSV bytes into pandas DataFrames (first usable sheet for Excel)."""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from pathlib import PurePath

import pandas as pd


class ParseError(Exception):
    pass


@dataclass
class ParseResult:
    dataframe: pd.DataFrame
    sheet_used: str | None = None
    warnings: list[str] = field(default_factory=list)


def _first_non_empty_sheet_excel(content: bytes, engine: str) -> tuple[pd.DataFrame, str | None, list[str]]:
    warnings: list[str] = []
    bio = io.BytesIO(content)
    xl = pd.ExcelFile(bio, engine=engine)
    names = list(xl.sheet_names)
    chosen: str | None = None
    chosen_df: pd.DataFrame | None = None
    for name in names:
        try:
            df = pd.read_excel(xl, sheet_name=name, header=0)
        except Exception:
            continue
        if df is None or df.empty:
            continue
        non_empty = df.dropna(how="all")
        if non_empty.shape[0] == 0 or non_empty.shape[1] == 0:
            continue
        if chosen is None:
            chosen = name
            chosen_df = df
        else:
            warnings.append(
                f"Additional sheet \"{name}\" was skipped; only the first sheet with data "
                f"(\"{chosen}\") is loaded. Merge data into one sheet if needed.",
            )
    if chosen_df is None or chosen is None:
        raise ParseError("No non-empty sheet with headers was found in this workbook.")
    if len(names) > 1:
        warnings.insert(0, f"Workbook has {len(names)} sheet(s); using \"{chosen}\".")
    return chosen_df, chosen, warnings


def parse_file_bytes(content: bytes, filename: str) -> pd.DataFrame:
    """Backward-compatible: dataframe only."""
    return parse_file_bytes_detailed(content, filename).dataframe


def parse_file_bytes_detailed(content: bytes, filename: str) -> ParseResult:
    """Parse file; for Excel, pick the first sheet that contains tabular data."""
    suffix = PurePath(filename).suffix.lower()
    if suffix == ".csv":
        try:
            df = pd.read_csv(io.BytesIO(content))
        except Exception as exc:
            raise ParseError(f"Could not parse CSV: {exc}") from exc
        return ParseResult(dataframe=df, sheet_used=None, warnings=[])

    if suffix == ".xlsx":
        try:
            df, sheet, warns = _first_non_empty_sheet_excel(content, "openpyxl")
        except ParseError:
            raise
        except Exception as exc:
            raise ParseError(f"Could not parse Excel (.xlsx): {exc}") from exc
        return ParseResult(dataframe=df, sheet_used=sheet, warnings=warns)

    if suffix == ".xls":
        try:
            df, sheet, warns = _first_non_empty_sheet_excel(content, "xlrd")
        except ImportError as exc:
            raise ParseError("Reading .xls requires the optional 'xlrd' package.") from exc
        except ParseError:
            raise
        except Exception as exc:
            raise ParseError(f"Could not parse Excel (.xls): {exc}") from exc
        return ParseResult(dataframe=df, sheet_used=sheet, warnings=warns)

    raise ParseError(f"Unsupported file type '{suffix}'. Use .csv, .xlsx, or .xls.")
