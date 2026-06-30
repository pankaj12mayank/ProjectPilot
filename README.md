# ProjectPilot

**ProjectPilot** is a self-contained **project governance and portfolio** web application: teams upload structured spreadsheets (status tracker, RAID log, weekly completion), the API validates and stores them, and the dashboard exposes **health metrics, risks, forecasts, report packages, and recommendations**. Authentication is **JWT-based** with **role-based access** (for example, administrators see all projects; other users see projects they own or are assigned to).

This README is written so a **client or operator** can go from zero to a running system in clear steps.

---

## Table of contents

1. [What you need (requirements)](#1-what-you-need-requirements)  
2. [Quick start](#2-quick-start)  
3. [Manual start (backend + frontend separately)](#3-manual-start-backend--frontend-separately)  
4. [Configuration (environment variables)](#4-configuration-environment-variables)  
5. [First login and admin account](#5-first-login-and-admin-account)  
6. [End-to-end workflow (how the product is meant to be used)](#6-end-to-end-workflow-how-the-product-is-meant-to-be-used)  
7. [Cheap deployment ideas](#7-cheap-deployment-ideas)  
8. [Production checklist (client-ready)](#8-production-checklist-client-ready)  
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
- **CORS:** Browser origin of the UI must appear in `CORS_ORIGINS` (see [§4](#4-configuration-environment-variables)).

---

## 2. Quick start

**From the repository root**, double-click **`run.bat`** (Windows) or run **`./run.sh`** (Linux/macOS).

These scripts:
1. Copy **`.env.example` → `.env`** if **`.env`** is missing.
2. Start the **backend** (uvicorn on port 8000) and **frontend** (vite on port 5173) in separate windows.

| What | URL |
|------|-----|
| **API** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| **UI** | [http://127.0.0.1:5173](http://127.0.0.1:5173) |

```bash
# Linux / macOS (first time: chmod +x run.sh)
./run.sh
```

**Windows:** double-click **`run.bat`**.

---

## 3. Manual start (backend + frontend separately)

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

---

## 4. Configuration (environment variables)

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

---

## 5. First login and admin account

1. With `.env` set, **start the stack** ([§2](#2-quick-start) or [§3](#3-manual-start-backend--frontend-separately)).  
2. On **first startup**, if no user with `ADMIN_EMAIL` exists yet, the API **creates** that admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.  
3. Open the UI → **Login** → use the same email and password.  
4. If you change `ADMIN_PASSWORD` in `.env` after a user already exists, **update the password in the database** (or start from a fresh SQLite file by removing `data/app.db` in dev only).

---

## 6. End-to-end workflow (how the product is meant to be used)

1. **Sign in** as admin or invited user.  
2. **Create a project** (wizard includes optional **template**, team, dates, and format hints).  
3. **Upload** the three file roles where applicable: status tracker, RAID log, weekly history (CSV / Excel — see in-app format guide and `/docs`).  
4. Review **project dashboard**: health, metrics, risks, forecasts, recommendations.  
5. **Generate report package** from the project's Reports area; artifacts land under `outputs/reports/<job_id>/`.  
6. **Portfolio** views aggregate what the signed-in user is allowed to see (admins: all projects; others: owned + team-assigned).  
7. **Governance** (standalone three-file flow) remains available under the governance API for legacy-style runs — see OpenAPI tags in `/docs`.

---

## 7. Cheap deployment ideas

These keep cost and complexity low while staying production-capable if you follow [§8](#8-production-checklist-client-ready).

| Option | Idea |
|--------|------|
| **Single small VPS** | 1–2 GB RAM, Ubuntu LTS, install Python + Node, run `run.sh` or configure as systemd services. |
| **SQLite (default)** | No managed database fee; back up `data/app.db` and `uploads/` / `outputs/`. |
| **Optional PostgreSQL** | Set `DATABASE_URL` to a Postgres URL when you outgrow SQLite. |
| **Static UI + API** | Build the frontend (`npm run build`) and serve `dist/` from the same reverse proxy or object storage; only the API needs Python. |

**Cost levers:** one VM, SQLite, local disk for uploads/reports, free TLS (Let's Encrypt), no Kubernetes required for small teams.

---

## 8. Production checklist (client-ready)

- [ ] Set a strong **`JWT_SECRET_KEY`** (never commit real secrets).  
- [ ] Set **`CORS_ORIGINS`** to your real UI origins (HTTPS).  
- [ ] Set **`VITE_API_URL`** to the **public API URL**.  
- [ ] Use HTTPS in front of Uvicorn (reverse proxy terminates TLS).  
- [ ] Disable dev-only flags such as **`DEV_RETURN_RESET_TOKEN`**.  
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

---

## 10. Repository layout

| Path | Role |
|------|------|
| `tools/env_bootstrap.py` | Optional copy **`.env.example` → `.env`** (and frontend) for tooling |
| `tools/verify_setup.py` | Post-clone / CI check: paths + `from app.main import app` |
| `run.bat` | Windows: bootstraps **`.env`**, starts backend + frontend |
| `run.sh` | Linux / macOS: same as `run.bat` |
| `backend/app/main.py` | FastAPI application |
| `backend/app/config/` | Settings (Pydantic + `.env`) |
| `backend/app/routes/` | Routers: `health`, `auth`, `users`, `projects`, `portfolio`, `logs`, `governance`, `branding`, `admin` |
| `backend/app/services/` | Business logic (projects, portfolio, reports, risks, templates, analytics, etc.) |
| `backend/app/db/` | SQLAlchemy models and session |
| `requirements.txt` | Python dependencies |
| `frontend/` | Vite + React SPA |
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
- **`/logs`** — Activity / audit style logs where exposed.  
- **`/governance`** — Standalone governance report from three uploads.  
- **`/branding`** — Branding assets and public payload.  
- **`/admin`** — Platform admin endpoints.

Column expectations for spreadsheets live in `backend/app/constants/columns.py`.

---

## 12. License

Internal / portfolio use unless stated otherwise.
