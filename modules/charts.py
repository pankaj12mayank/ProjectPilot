import matplotlib.pyplot as plt
from config.settings import OUTPUT_FOLDER, DPI
import os

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def generate_completion_chart(completion):
    path = f"{OUTPUT_FOLDER}/completion.png"
    plt.figure(figsize=(6,4))
    plt.bar(["Completion %"], [completion])
    plt.ylim(0,100)
    plt.title("Overall Completion")
    plt.grid(axis="y")
    plt.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close()
    return path


def generate_trend_chart(history_df):
    path = f"{OUTPUT_FOLDER}/trend.png"
    plt.figure(figsize=(6,4))
    plt.plot(history_df["Week"], history_df["Completion"], marker="o")
    plt.title("4 Week Trend")
    plt.ylabel("Completion %")
    plt.grid(True)
    plt.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close()
    return path
