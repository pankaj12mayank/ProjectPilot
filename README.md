# ProjectPilot

**ProjectPilot** is a self-contained **project governance and portfolio** web application: teams upload structured spreadsheets (status tracker, RAID log, weekly completion), the API validates and stores them, and the dashboard exposes **health metrics, risks, forecasts, report packages, and recommendations**. Authentication is **JWT-based** with **role-based access** (for example, administrators see all projects; other users see projects they own or are assigned to).

This README is written so a **client or operator** can go from zero to a running system in clear steps, choose a **low-cost** deployment shape, and know what to configure for production.

---

## Table of contents

1. [What you need (requirements)](#1-what-you-need-requirements)  
2. [Choose how you will run it](#2-choose-how-you-will-run-it)  
3. [Path A — Easiest local run (one command)](#3-path-a--easiest-local-run-one-command)  
4. [Path B — Docker (good for demos and simple servers)](#4-path-b--docker-good-for-demos-and-simple-servers)  
5. [Path C — Manual install (backend + frontend separately)](#5-path-c--manual-install-backend--frontend-separately)  
6. [Configuration (environment variables)](#6-configuration-environment-variables)  
7. [First login and admin account](#7-first-login-and-admin-account)  
8. [End-to-end workflow (how the product is meant to be used)](#8-end-to-end-workflow-how-the-product-is-meant-to-be-used)  
9. [Cheap deployment ideas](#9-cheap-deployment-ideas)  
10. [Production checklist (client-ready)](#10-production-checklist-client-ready)  
11. [Troubleshooting](#11-troubleshooting)  
12. [Repository layout](#12-repository-layout)  
13. [API overview](#13-api-overview)  
14. [License](#14-license)

---

## 1. What you need (requirements)

### Software

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Python** | 3.10 | **3.12** (matches Docker image; avoids edge-case wheels on very new Python) |
| **Node.js** | 18 | 20 LTS (for local UI dev / `run.py`) |
| **npm** | 9+ | Bundled with Node |
| **Docker** (optional) | Docker Engine 24+, Compose v2 | Latest stable |

### Hardware (typical)

- **Small team / demo:** 1–2 vCPU, 2 GB RAM, a few GB disk (SQLite + uploaded files + generated reports).  
- **Heavier use:** 2 vCPU, 4 GB RAM; monitor `uploads/`, `outputs/`, and database size.

### Network

- **Ports:** API **8000**, UI **5173** in the examples below (change if you proxy).  
- **CORS:** Browser origin of the UI must appear in `CORS_ORIGINS` (see [§6](#6-configuration-environment-variables)).

---

## 2. Choose how you will run it

| Goal | Suggested path |
|------|----------------|
| Try on your laptop quickly | [§3 Path A](#3-path-a--easiest-local-run-one-command) (`python run.py` or `run.bat` on Windows) |
| Same stack on a small VM / “appliance” | [§4 Path B](#4-path-b--docker-good-for-demos-and-simple-servers) (`docker compose`) |
| CI, debugging, or split processes | [§5 Path C](#5-path-c--manual-install-backend--frontend-separately) |

---

## 3. Path A — Easiest local run (one command)

**From the repository root** (the folder that contains `run.py`, `backend/`, `frontend/`).

### Step 1 — Environment file

1. Copy `.env.example` to `.env` in the **repository root**.  
2. Edit `.env` at minimum:  
   - `JWT_SECRET_KEY` — use a long random string for anything beyond local play.  
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` — these are the credentials you use on the **Login** page (see [§7](#7-first-login-and-admin-account)).

### Step 2 — Frontend env (API URL)

1. Copy `frontend/.env.example` to `frontend/.env`.  
2. Set `VITE_API_URL` to the **origin only** of the API (e.g. `http://127.0.0.1:8000`) — **no** trailing slash and **no** `/api/v1` (the app adds the API prefix in code).

### Step 3 — Start API + UI

**Linux / macOS:**

```bash
python run.py
```

**Windows:** double-click **`run.bat`** or run it from a command prompt in the repo root. It installs backend (`pip`) and frontend (`npm`) dependencies, then runs `python run.py`.

### Step 4 — Open the apps

| What | URL |
|------|-----|
| **API interactive docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |
| **Dashboard (Vite dev)** | [http://127.0.0.1:5173](http://127.0.0.1:5173) |

Stop everything with **Ctrl+C** in the terminal.

---

## 4. Path B — Docker (good for demos and simple servers)

**From the repository root.**

### Step 1 — Optional `.env`

Copy `.env.example` → `.env` and set secrets (`JWT_SECRET_KEY`, admin password, etc.). Compose picks up root `.env` when you use:

```bash
docker compose --env-file .env up --build
```

If you skip `--env-file`, defaults inside `docker-compose.yml` still apply for a quick demo.

### Step 2 — Start services

```bash
docker compose up --build
```

### Step 3 — URLs

Same as local: **API** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs), **UI** [http://127.0.0.1:5173](http://127.0.0.1:5173).  

The UI image is built with `VITE_API_URL=http://127.0.0.1:8000`. For a **remote server**, rebuild the frontend with the **public API URL** your browser will use, e.g.:

```bash
docker compose build --build-arg VITE_API_URL=https://api.yourcompany.com frontend
docker compose up
```

Data directories are bind-mounted: `data/`, `logs/`, `outputs/`, `uploads/` on the host.

---

## 5. Path C — Manual install (backend + frontend separately)

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run with working directory **`backend/`** so the `app` package resolves (same as Docker’s `PYTHONPATH`).

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Ensure `frontend/.env` has the correct `VITE_API_URL`.

---

## 6. Configuration (environment variables)

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

## 7. First login and admin account

1. With `.env` set, **start the API** (Docker or Uvicorn or `run.py`).  
2. On **first startup**, if no user with `ADMIN_EMAIL` exists yet, the API **creates** that admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.  
3. Open the UI → **Login** → use the same email and password.  
4. If you change `ADMIN_PASSWORD` in `.env` after a user already exists, **update the password in the database** (or start from a fresh SQLite file by removing `data/app.db` in dev only).

---

## 8. End-to-end workflow (how the product is meant to be used)

1. **Sign in** as admin or invited user.  
2. **Create a project** (wizard includes optional **template**, team, dates, and format hints).  
3. **Upload** the three file roles where applicable: status tracker, RAID log, weekly history (CSV / Excel — see in-app format guide and `/docs`).  
4. Review **project dashboard**: health, metrics, risks, forecasts, recommendations.  
5. **Generate report package** from the project’s Reports area; artifacts land under `outputs/reports/<job_id>/`.  
6. **Portfolio** views aggregate what the signed-in user is allowed to see (admins: all projects; others: owned + team-assigned).  
7. **Governance** (standalone three-file flow) remains available under the governance API for legacy-style runs — see OpenAPI tags in `/docs`.

---

## 9. Cheap deployment ideas

These keep cost and complexity low while staying production-capable if you follow [§10](#10-production-checklist-client-ready).

| Option | Idea |
|--------|------|
| **Single small VPS** | 1–2 GB RAM, Ubuntu LTS, install Docker, `docker compose up -d`, put **Caddy** or **nginx** in front for HTTPS. |
| **SQLite (default)** | No managed database fee; back up `data/app.db` and bind-mounted `uploads/` / `outputs/`. |
| **Optional PostgreSQL** | Set `DATABASE_URL` to a Postgres URL when you outgrow SQLite. |
| **Static UI + API** | Build the frontend (`npm run build`) and serve `dist/` from the same reverse proxy or object storage; only the API needs Python. |

**Cost levers:** one VM, SQLite, local disk for uploads/reports, free TLS (Let’s Encrypt), no Kubernetes required for small teams.

---

## 10. Production checklist (client-ready)

- [ ] Set a strong **`JWT_SECRET_KEY`** (never commit real secrets).  
- [ ] Set **`CORS_ORIGINS`** to your real UI origins (HTTPS).  
- [ ] Set **`VITE_API_URL`** (or build-time arg) to the **public API URL**.  
- [ ] Use HTTPS in front of Uvicorn (reverse proxy terminates TLS).  
- [ ] Disable dev-only flags such as **`DEV_RETURN_RESET_TOKEN`**.  
- [ ] Plan **backups** for `data/` (and Postgres if used), `uploads/`, `outputs/`.  
- [ ] Restrict who can reach **`/docs`** if you do not want public API exploration (proxy path rules or disable in a custom build).  
- [ ] On **Windows** locked-down PCs: if pandas fails with “Application Control policy”, use **Docker** or a **Python 3.12 venv** in an allowed path, or ask IT for a DLL exception (see [§11](#11-troubleshooting)).

---

## 11. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| **Backend import check failed** / pandas **DLL blocked** (Windows) | Enterprise **WDAC / App Locker** blocking native wheels. Prefer **Docker** (Linux container), **Python 3.12 venv**, or IT policy exception. `pip install` alone does not fix a blocked DLL. |
| **CORS error** in browser | Add your exact UI URL to **`CORS_ORIGINS`** (including port). Restart API. |
| **401 / login fails** | Wrong email/password; API not restarted after `.env` change; clock skew (JWT). |
| **UI calls wrong host** | **`VITE_API_URL`** in `frontend/.env`; rebuild Docker frontend if you changed the public API URL. |
| **Port in use** | Free **8000** / **5173** or change ports in Uvicorn / Vite / Compose mapping. |
| **Empty portfolio / projects** | Expected for non-admin users: only **owned** and **team-assigned** projects are listed. |

---

## 12. Repository layout

| Path | Role |
|------|------|
| `run.py` | Installs deps if needed, checks backend import, starts Uvicorn + Vite |
| `run.bat` | Windows helper: `pip` + `npm` + `run.py` |
| `backend/app/main.py` | FastAPI application |
| `backend/app/config/` | Settings (Pydantic + `.env`) |
| `backend/app/routes/` | Routers: `health`, `auth`, `users`, `projects`, `portfolio`, `logs`, `governance`, `branding`, `admin` |
| `backend/app/services/` | Business logic (projects, portfolio, reports, risks, templates, analytics, etc.) |
| `backend/app/db/` | SQLAlchemy models and session |
| `backend/requirements.txt` | Python dependencies |
| `frontend/` | Vite + React SPA |
| `docker-compose.yml` | Backend + frontend services |
| `data/`, `logs/`, `outputs/`, `uploads/` | Created at runtime (database, logs, generated artifacts, uploads) |

---

## 13. API overview

Interactive list: **`GET /docs`** on your API host (prefix is **`API_PREFIX`**, default **`/api/v1`**).

**Groups:**

- **`/health`** — Liveness (used by Docker healthcheck).  
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

## 14. License

Internal / portfolio use unless stated otherwise.
