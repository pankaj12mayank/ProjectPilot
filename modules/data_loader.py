import pandas as pd
import os
import sys
from config.settings import MAX_RETRIES

def get_valid_path(prompt):
    retries = 0
    while retries < MAX_RETRIES:
        path = input(prompt)
        if os.path.exists(path):
            return path
        else:
            retries += 1
            print("Invalid path. Try again.")
    print("Multiple invalid attempts. Please restart.")
    sys.exit()

def load_data():
    status_path = get_valid_path("Enter Status Tracker path: ")
    raid_path = get_valid_path("Enter RAID Log path: ")
    history_path = get_valid_path("Enter Weekly History CSV path: ")

    status_df = pd.read_excel(status_path)
    raid_df = pd.read_excel(raid_path)
    history_df = pd.read_csv(history_path)

    return status_df, raid_df, history_df
