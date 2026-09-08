# ProjectPilot

**ProjectPilot** is a self-contained **project governance and portfolio** web application: teams upload structured spreadsheets (status tracker, RAID log, weekly completion), the API validates and stores them, and the dashboard exposes **health metrics, risks, forecasts, report packages, and recommendations**. Authentication is **JWT-based** with **role-based access** (administrators see all projects; other users see owned or team-assigned projects). **AI is optional and non-blocking** — when configured, it enriches forecasts, recommendations, summaries, and chat with fallback to deterministic rules.

This README is written so a **client or operator** can go from zero to a running system in clear steps.

---

## Table of contents

1. [What you need (requirements)](#1-what-you-need-requirements)  
2. [Quick start](#2-quick-start)  
3. [Configuration (environment variables)](#3-configuration-environment-variables)  
4. [First login and admin account](#4-first-login-and-admin-account)  
5. [End-to-end workflow](#5-end-to-end-workflow)  
6. [AI configuration (optional)](#6-ai-configuration-optional)  
7. [Cheap deployment ideas](#7-cheap-deployment-ideas)  
8. [Production checklist](#8-production-checklist)  
9. [Troubleshooting](#9-troubleshooting)  
10. [Repository layout](#10-repository-layout)  
11. [API overview](#11-api-overview)  
12. [License](#12-license)

---

## 1. What you need (requirements)

### Software

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Python** | 3.10 | **3.12** |
| **Node.js** | 18 | 20 LTS |
| **npm** | 9+ | Bundled with Node |

### Hardware (typical)

- **Small team / demo:** 1–2 vCPU, 2 GB RAM, a few GB disk (SQLite + uploaded files + generated reports).  
- **Heavier use:** 2 vCPU, 4 GB RAM; monitor `uploads/`, `outputs/`, and database size.

### Network

- **Ports:** API **8000**, UI **5173** in the examples below (change if you proxy).  
- **CORS:** Browser origin of the UI must appear in `CORS_ORIGINS` (see [§3](#3-configuration-environment-variables)).

---

## 2. Quick start

### Backend

```bash
pip install -r requirements.txt
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run with working directory **`backend/`** so the `app` package resolves.

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Ensure `frontend/.env` has the correct `VITE_API_URL` (copy from `frontend/.env.example`).

| What | URL |
|------|-----|
| **API** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| **UI** | [http://127.0.0.1:5173](http://127.0.0.1:5173) |

On Linux/macOS you can also use `./run.sh` (copies `.env.example` → `.env` if missing and starts both services).

---

## 3. Configuration (environment variables)

**Root `.env`** (repo root or `backend/.env` — both are supported by settings loading): see **`.env.example`** for every variable and inline comments.

**High-priority variables:**

| Area | Variables |
|------|-----------|
| **Security** | `JWT_SECRET_KEY`, `JWT_ACCESS_EXPIRE_MINUTES`, `JWT_REFRESH_EXPIRE_DAYS` |
| **API shape** | `API_PREFIX` (default `/api/v1`) |
| **Browser access** | `CORS_ORIGINS` — must include every UI origin (scheme + host + port), e.g. `http://localhost:5173` **and** `http://127.0.0.1:5173` if you use both |
| **Database** | `DATABASE_URL` — optional; default is **SQLite** under `data/app.db` |
| **Paths** | `PROJECT_ROOT` — optional override for `data/`, `logs/`, `outputs/`, `uploads/` |
| **Seeded admin** | `ADMIN_EMAIL`, `ADMIN_PASSWORD` (aliases: `BOOTSTRAP_ADMIN_*`) |

**Frontend `frontend/.env`:**

| Variable | Meaning |
|----------|---------|
| `VITE_API_URL` | API origin only, e.g. `http://127.0.0.1:8000` — **not** `/api/v1` |

AI provider keys are **not** stored in `.env` — they are configured in the UI under **Admin → AI Configuration** (encrypted at rest) and prompts are editable there without code deploy.

---

## 4. First login and admin account

1. With `.env` set, **start the stack** ([§2](#2-quick-start)).  
2. On **first startup**, if no user with `ADMIN_EMAIL` exists yet, the API **creates** that admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.  
3. Open the UI → **Login** → use the same email and password.  
4. If you change `ADMIN_PASSWORD` in `.env` after a user already exists, **update the password in the database** (or start from a fresh SQLite file by removing `data/app.db` in dev only).

---

## 5. End-to-end workflow

1. **Sign in** as admin or invited user.  
2. **Create a project** (wizard includes optional **template**, team, dates, and format hints).  
3. **Upload** the three file roles where applicable: status tracker, RAID log, weekly history (CSV / Excel — see in-app format guide and `/docs`). Validation is shown inline; with AI enabled, errors are explained in plain language.  
4. Review **project dashboard**: health, metrics, risks, forecasts, recommendations (AI enriches when enabled, otherwise rule-based).  
5. **Generate report package** from the project's Reports area; artifacts land under `outputs/reports/<job_id>/`.  
6. **Portfolio** views aggregate what the signed-in user is allowed to see (admins: all projects; others: owned + team-assigned).  
7. **Chat with project** (when AI enabled) — ask natural-language questions about a project on its detail page.  
8. **Governance** (standalone three-file flow) remains available under the governance API for legacy-style runs — see OpenAPI tags in `/docs`.

---

## 6. AI configuration (optional)

AI is **optional, non-blocking, and encrypted at rest**. If disabled or the provider is unreachable, the system falls back to deterministic rule-based intelligence and reports still generate.

**Admin → AI Configuration** has two tabs:

* **Configuration** — Provider (free-text, e.g. `openai`, `custom`, `ollama`), `Base URL` (required for `custom`, e.g. `https://api.openai.com/v1` or `http://localhost:11434/v1` for Ollama), `Model` (type manually or **Fetch models** from Base URL — free models shown on top row), `API key` (eye toggle, masked as `sk-****abcd`, Fernet encrypted), `Generation tuning` (temperature, max_tokens, timeout), `Save` → `Test connection` (tiny 5-token ping) appears after save, with system-theme toast.
* **Prompts** — 12 best-quality templates (upload validation, anomaly explain, risk summarizer, forecast narrative, root cause, recommendation generator, exec summaries, client tone, portfolio insight, email draft, chat). Expand/collapse, edit inline, toggle `Active`, `Save`/`Revert`, or `Reseed defaults`. Placeholders like `{{health_json}}` are replaced at runtime. Disabled prompts fall back to code defaults.

**Provider notes:** Any OpenAI-compatible endpoint works (`/chat/completions` + `/models`). Ollama local needs no API key. Custom proxies should expose OpenAI-compatible paths. System uses a **single global loader** (`AI thinking…` / `Processing…` / `Switching…`) for all AI calls, page switches, and long processes, with dark/light theme support.

---

## 7. Cheap deployment ideas

These keep cost and complexity low while staying production-capable if you follow [§8](#8-production-checklist).

| Option | Idea |
|--------|------|
| **Single small VPS** | 1–2 GB RAM, Ubuntu LTS, install Python + Node, configure as systemd services. |
| **SQLite (default)** | No managed database fee; back up `data/app.db` and `uploads/` / `outputs/`. |
| **Optional PostgreSQL** | Set `DATABASE_URL` to a Postgres URL when you outgrow SQLite. |
| **Static UI + API** | Build the frontend (`npm run build`) and serve `dist/` from the same reverse proxy or object storage; only the API needs Python. |

**Cost levers:** one VM, SQLite, local disk for uploads/reports, free TLS (Let's Encrypt), no Kubernetes required for small teams.

---

## 8. Production checklist

- [ ] Set a strong **`JWT_SECRET_KEY`** (never commit real secrets).  
- [ ] Set **`CORS_ORIGINS`** to your real UI origins (HTTPS).  
- [ ] Set **`VITE_API_URL`** to the **public API URL**.  
- [ ] Use HTTPS in front of Uvicorn (reverse proxy terminates TLS).  
- [ ] Disable dev-only flags such as **`DEV_RETURN_RESET_TOKEN`**.  
- [ ] Configure **Admin → AI Configuration** if you want AI, and test connection.  
- [ ] Plan **backups** for `data/` (and Postgres if used), `uploads/`, `outputs/`.  
- [ ] Restrict who can reach **`/docs`** if you do not want public API exploration (proxy path rules or disable in a custom build).

---

## 9. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| **CORS error** in browser | Add your exact UI URL to **`CORS_ORIGINS`** (including port). Restart API. |
| **401 / login fails** | Wrong email/password; API not restarted after `.env` change; clock skew (JWT). |
| **UI calls wrong host** | **`VITE_API_URL`** in `frontend/.env`; restart the frontend. |
| **Port in use** | Free **8000** / **5173** or change ports in Uvicorn / Vite. |
| **Empty portfolio / projects** | Expected for non-admin users: only **owned** and **team-assigned** projects are listed. |
| **Something broke after `git pull`** | Run **`pip install -r requirements.txt`** then **`cd frontend && npm install`**. |
| **'vite' is not recognized** | Run **`npm install`** in the `frontend/` directory first. |
| **AI test fails / 401** | Check `Base URL` ends with `/v1`, `Model` exists for that provider, `API key` correct; for Ollama ensure local service is running. |

---

## 10. Repository layout

| Path | Role |
|------|------|
| `tools/env_bootstrap.py` | Optional copy **`.env.example` → `.env`** (and frontend) for tooling |
| `tools/verify_setup.py` | Post-clone / CI check: paths + `from app.main import app` |
| `run.sh` | Linux / macOS helper: bootstraps **`.env`**, starts backend + frontend |
| `backend/app/main.py` | FastAPI application (lifespan seeds admin, branding, email, AI, gateways, plans) |
| `backend/app/config/` | Settings (Pydantic + `.env`) |
| `backend/app/routes/` | Routers: `health`, `auth`, `users`, `projects`, `portfolio`, `logs`, `governance`, `branding`, `admin`, `ai`, `ai_admin` |
| `backend/app/services/` | Business logic (projects, portfolio, reports, risks, templates, analytics, intelligence, ai) |
| `backend/app/db/` | SQLAlchemy models and session (`ai_settings`, `ai_prompts`, `users`, `projects`, etc.) |
| `requirements.txt` | Python dependencies (`stripe`, `razorpay`, `fastapi`, `uvicorn`, etc.) |
| `frontend/` | Vite + React SPA (full-width, one-row FiltersBar, bottom Pagination, single Global loader, theme-aware popups) |
| `frontend/src/pages/AdminAIPage.tsx` | AI Configuration + Prompts (tabs, provider input, model fetch, eye toggle, expand/collapse) |
| `frontend/src/components/ui/FiltersBar.tsx` | One-row filter bar |
| `frontend/src/components/ui/Pagination.tsx` | Bottom pagination for all tables |
| `frontend/src/components/GlobalAILoader.tsx` | Single system loader for AI/page/process |
| `data/`, `logs/`, `outputs/`, `uploads/` | Created at runtime (database, logs, generated artifacts, uploads) |

---

## 11. API overview

Interactive list: **`GET /docs`** on your API host (prefix is **`API_PREFIX`**, default **`/api/v1`**).

**Groups:**

- **`/health`** — Liveness.  
- **`/auth`** — Register, login, refresh, forgot/reset password.  
- **`/users`** — Profile and admin user management.  
- **`/projects`** — CRUD, team, uploads, analytics, risks, report generation, creation templates.  
- **`/portfolio`** — Cross-project dashboards and history (scoped by role).  
- **`/logs`** — Activity / audit logs with bulk hard delete (multiple selection).  
- **`/governance`** — Standalone governance report from three uploads.  
- **`/branding`** — Branding assets and public payload.  
- **`/admin`** — Platform admin (stats, system-config, branding, email, users, plans, gateways, subscriptions).  
- **`/admin/ai-settings`** — Get/save AI provider, test connection, fetch models.  
- **`/admin/ai-prompts`** — List/update/reseed prompt templates.  
- **`/projects/{id}/ai`** — Chat with project, AI-enhanced intelligence.

Column expectations for spreadsheets live in `backend/app/constants/columns.py`.

---

## 12. License

Internal / portfolio use unless stated otherwise.
