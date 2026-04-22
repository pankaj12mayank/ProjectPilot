# ProjectPilot

Governance reporting API and a React dashboard: JWT authentication, role-based navigation (admin / manager / member), and protected governance uploads. The backend computes schedule/effort variance, EVM (SPI/CPI), RAG health, charts, a PowerPoint deck, and an executive email draft. Each successful run is stored in SQLite for audit.

## Requirements

- **Local:** Python 3.10+ (3.12 recommended; 3.14 may work if wheels exist for all packages), Node.js 18+ and npm for the UI
- **Docker:** Docker Engine 24+ and Docker Compose v2

## One-click run (Docker)

From the repository root (creates `data/`, `logs/`, `outputs/`, `uploads/` on the host via bind mounts):

```bash
docker compose up --build
```

- API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- UI: [http://127.0.0.1:5173](http://127.0.0.1:5173)

The UI is built with `VITE_API_URL=http://127.0.0.1:8000` so the browser can reach the API on your machine. Stop with `Ctrl+C`.

Optional env vars: copy `.env.example` to `.env` and pass them into Compose, for example:

```bash
docker compose --env-file .env up --build
```

## One-click run (native)

```bash
python run.py
```

Installs missing Python packages from `backend/requirements.txt` and `npm install` in `frontend/` when needed, then starts Uvicorn and Vite together.

**Windows:** double-click or run `run.bat` from the repo root — it **always** runs `pip install -r backend/requirements.txt` and `npm install` in `frontend/`, then starts `python run.py`. If `.env` is missing, it copies `.env.example` to `.env` once (then set `ADMIN_EMAIL` / `ADMIN_PASSWORD` and run again).

## Configuration

| Variable | Purpose |
|----------|---------|
| `PROJECT_ROOT` | Override directory for `logs/`, `outputs/`, `uploads/`, `data/` (default: repository root) |
| `DATABASE_URL` | SQLAlchemy URL (default: SQLite under `data/app.db`) |
| `LOG_LEVEL`, `CHART_DPI` | Logging and chart export DPI |
| `RAG_*` | RAG thresholds |
| `API_PREFIX` | API prefix (default `/api/v1`) |
| `CORS_ORIGINS` | Comma-separated browser origins |
| `JWT_ACCESS_EXPIRE_MINUTES` | Access JWT lifetime (default 30; legacy `JWT_EXPIRE_MINUTES` alias) |
| `JWT_REFRESH_EXPIRE_DAYS` | Refresh JWT lifetime (default 7) |

Frontend: copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL` if the API is not on `http://127.0.0.1:8000`.

## Project layout

| Path | Role |
|------|------|
| `backend/app/main.py` | FastAPI app |
| `backend/app/config/` | Settings (Pydantic + `.env`) |
| `backend/app/constants/` | Spreadsheet column names |
| `backend/app/routes/` | Routers (`health`, `auth`, `users`, `governance`) |
| `backend/app/deps/` | Auth dependencies (`get_current_user`, `require_roles`) |
| `backend/app/schemas/` | Pydantic request/response models |
| `backend/app/security.py` | Password hashing (bcrypt) and JWT helpers |
| `backend/app/services/` | Users, bootstrap, calculations, RAG, charts, PPT, email |
| `backend/app/db/` | SQLAlchemy engine, session, models |
| `backend/app/middleware/` | JWT context on `request.state` (role / sub) |
| `backend/app/utils/` | Logging setup |
| `backend/requirements.txt` | Python dependencies |
| `frontend/` | Vite + React client |
| `docker-compose.yml` | Backend + frontend services |
| `logs/`, `outputs/`, `uploads/`, `data/` | Runtime directories |

## API

- `GET /api/v1/health` — liveness (used by Docker `HEALTHCHECK`)
- `POST /api/v1/auth/register` — create account (first user becomes **admin** if the database is empty)
- `POST /api/v1/auth/login` — JSON `{ "email", "password" }` → `{ "access_token", "refresh_token", "token_type" }`
- `POST /api/v1/auth/refresh` — JSON `{ "refresh_token" }` → new access + refresh pair (rotation)
- `POST /api/v1/auth/forgot-password` / `POST /api/v1/auth/reset-password` — reset flow (optional `DEV_RETURN_RESET_TOKEN=1` for local testing without email)
- `GET/PATCH /api/v1/users/me` — read/update profile (Bearer token)
- `GET/POST/PATCH/DELETE /api/v1/users/…` — list (`GET /users/`), invite (`POST /users/`), read one (`GET /users/{id}`), update, deactivate (**admin** only)
- `POST /api/v1/governance/report` — multipart uploads (**requires** `Authorization: Bearer <token>`)

Column expectations for spreadsheets are defined in `backend/app/constants/columns.py`.

### Auth configuration

Set `JWT_SECRET_KEY` to a long random string in production. Tune lifetimes with `JWT_ACCESS_EXPIRE_MINUTES` (default 30) and `JWT_REFRESH_EXPIRE_DAYS` (default 7). Access tokens include `typ: access`; refresh tokens include `typ: refresh`. Put your admin **login** in `.env` as `ADMIN_EMAIL` and `ADMIN_PASSWORD` (same values on the `/login` page). On first startup, if the database has **zero** users, that account is created automatically. Older env names `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` still work as aliases.

## Manual backend-only

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Maintenance notes (codebase scan)

- **Duplicate modules:** none; a single `app` package under `backend/`.
- **Broken imports:** none found; keep `PYTHONPATH`/`cwd` as `backend/` when running Uvicorn.
- **Circular dependencies:** none observed (`routes` → `services` → `config`/`db`).
- **Unused routes:** none; `health` and `governance` are both used.
- **`session_scope`:** kept in `db/session.py` for scripts; removed from package `__all__` because the API uses `get_db` only.

## License

Internal / portfolio use unless stated otherwise.
