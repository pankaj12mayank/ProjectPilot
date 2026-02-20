# PM Governance Engine


# PM Governance & Analytics Platform

## Overview

The **PM Governance & Analytics Platform** is an enterprise-grade automation solution designed to transform manual project reporting into a data-driven, executive-ready governance system.

It integrates:

* Schedule & Effort Variance tracking
* Earned Value Management (SPI / CPI)
* RAG (Red-Amber-Green) Health Status
* Risk Exposure Scoring
* 4-Week Trend Analysis
* Executive PPT Auto-Generation
* Audit Logging
* Optional Jira Live API Integration
* Streamlit Web Dashboard
* EXE Deployment for Non-Technical Users


# Problem Statement

Traditional project reporting:

* Consumes 4–6 hours weekly
* Is prone to manual errors
* Lacks predictive analytics
* Provides snapshot views only
* Requires repetitive PPT preparation


# Solution

This platform automates:

✔ Data ingestion from Excel / CSV / Jira API
✔ KPI calculations (SV, EV, SPI, CPI)
✔ RAG health evaluation
✔ Risk heat detection
✔ Trend visualization
✔ Executive-ready PowerPoint generation
✔ Governance audit logging

Result:

* 80% reduction in reporting effort
* Standardized executive reporting
* Data-driven governance decisions

# Project Structure
```
pm_governance_platform/
│
├── app.py                  # CLI version (path-based input)
├── dashboard.py            # Streamlit web dashboard
├── app_engine.py           # Core orchestration layer
│
├── config/
│   └── settings.py
│
├── modules/
│   ├── data_loader.py
│   ├── jira_api.py
│   ├── calculations.py
│   ├── rag_logic.py
│   ├── charts.py
│   ├── report_generator.py
│   ├── email_generator.py
│   └── logger.py
│
├── logs/
├── output/
├── requirements.txt
└── README.md
```


# Required Input File Structure

## Status Tracker (Excel)

Headers must be:

```
Task
Planned Hours
Actual Hours
Planned %
Actual %
Planned Budget
Actual Cost
```

---

## RAID Log (Excel)

Headers must be:

```
ID
Type
Severity
Status
```

Risk score counts:

* Type = Risk
* Severity = High
* Status = Open

---

## Weekly History (CSV)

```
Week,Completion
Week 1,60
Week 2,68
Week 3,75
Week 4,82
```

---

# Key Metrics Calculated

| Metric            | Meaning                      |
| ----------------- | ---------------------------- |
| Schedule Variance | Actual % – Planned %         |
| Effort Variance   | Actual Hours – Planned Hours |
| SPI               | EV / PV                      |
| CPI               | EV / AC                      |
| Risk Score        | High Open Risks              |
| RAG               | Governance health indicator  |

---

# RAG Logic

| Status | Condition                          |
| ------ | ---------------------------------- |
| Green  | Stable                             |
| Amber  | Moderate risk or delay             |
| Red    | High risk exposure or severe delay |

Thresholds configurable in:

```
config/settings.py
```

---

# How to Run (CLI Version)

## Install Dependencies

```bash
pip install -r requirements.txt
```

##  Run

```bash
python app.py
```

System will prompt for file paths.

---

#  How to Run (Dashboard Version)

Install Streamlit:

```bash
pip install streamlit
```

Run:

```bash
streamlit run dashboard.py
```

Open in browser and upload files.

---

# Convert to EXE (Optional)

Install PyInstaller:

```bash
pip install pyinstaller
```

Generate executable:

```bash
pyinstaller --onefile dashboard.py
```

Output will be in:

```
dist/dashboard.exe
```

---

# Jira API Integration (Optional)

Supports live integration with:

Jira REST API

Required:

* Jira Base URL
* Email
* API Token
* JQL Query

API module located at:

```
modules/jira_api.py
```

---

# Logging & Audit Trail

All report generation events are logged in:

```
logs/audit.log
```

This ensures governance traceability and compliance readiness.

---

# 📈 Output Generated

```
output/
   Governance_Report_YYYYMMDD.pptx
   completion.png
   trend.png
   Executive_Email.txt
```

---

# Enterprise Features

✔ Modular architecture
✔ Config-driven thresholds
✔ Production-ready logging
✔ Dashboard UI
✔ API integration
✔ Deployable executable
✔ Portfolio-ready structure

---

# Future Enhancements

* Cloud deployment
* Power BI integration
* Portfolio-level aggregation
* Predictive analytics
* Risk heat map visualization
* Multi-project consolidation
* Authentication layer

---

# Author

Pankaj
IT Project Manager
Technology-Driven Governance & Automation Specialist

---

# License

Internal enterprise use / portfolio demonstration.

---

# Strategic Value

This platform demonstrates:

* Automation capability
* Governance maturity
* Earned Value proficiency
* Technical leadership
* Enterprise deployment readiness

Tell me where you want to position this 🚀
