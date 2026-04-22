from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd

from app.constants.columns import WeeklyHistoryColumns


def generate_completion_chart(completion: float, output_dir: Path, dpi: int) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "completion.png"
    plt.figure(figsize=(6, 4))
    plt.bar(["Completion %"], [completion])
    plt.ylim(0, 100)
    plt.title("Overall Completion")
    plt.grid(axis="y")
    plt.savefig(path, dpi=dpi, bbox_inches="tight")
    plt.close()
    return path


def generate_trend_chart(history_df: pd.DataFrame, output_dir: Path, dpi: int) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "trend.png"
    plt.figure(figsize=(6, 4))
    plt.plot(
        history_df[WeeklyHistoryColumns.WEEK],
        history_df[WeeklyHistoryColumns.COMPLETION],
        marker="o",
    )
    plt.title("4 Week Trend")
    plt.ylabel("Completion %")
    plt.grid(True)
    plt.savefig(path, dpi=dpi, bbox_inches="tight")
    plt.close()
    return path
