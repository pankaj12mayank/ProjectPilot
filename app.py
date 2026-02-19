from modules.data_loader import load_data
from modules.calculations import calculate_metrics, calculate_evm, calculate_risk_score
from modules.rag_logic import calculate_rag
from modules.charts import generate_completion_chart, generate_trend_chart
from modules.report_generator import generate_ppt
from modules.email_generator import generate_email

def run():

    status_df, raid_df, history_df = load_data()

    completion, total_sv, total_ev = calculate_metrics(status_df)
    risk_score = calculate_risk_score(raid_df)
    SPI, CPI = calculate_evm(status_df)

    rag = calculate_rag(total_sv, risk_score)

    chart1 = generate_completion_chart(completion)
    chart2 = generate_trend_chart(history_df)

    metrics = (completion, total_sv, total_ev, risk_score)
    charts = (chart1, chart2)
    evm = (SPI, CPI)

    ppt_path = generate_ppt(metrics, charts, rag, evm)
    email_path = generate_email(metrics, rag, evm)

    print("\nReport Generated Successfully!")
    print("PPT:", ppt_path)
    print("Email Draft:", email_path)

while True:
    run()
    again = input("\nGenerate another report? (yes/no): ").lower()
    if again != "yes":
        print("Exiting PM Governance Engine.")
        break
