# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Project Overview

This is a **智能固件合规审计系统** (Intelligent Firmware Compliance Audit System) — a platform for automated compliance checking of BMC/BIOS firmware packages. Users upload firmware `.zip` files, the system runs a compliance check script against them, and displays a structured compliance report.

**Stack:** Python 3.13 + FastAPI + MongoDB 7 (backend) | React 19 + TypeScript + Vite 6 (frontend) | Docker Compose (deployment)

## Project Structure

```
/
├── docker-compose.yml       # 3 services: mongodb, backend, frontend
├── backend/                 # Python FastAPI backend (PyMongo, synchronous)
│   ├── requirements.txt     # pip deps (fastapi, uvicorn, pydantic, reportlab)
│   ├── pyproject.toml       # uv deps (pymongo, reportlab, pdfplumber, pypdf2)
│   ├── Dockerfile           # python:3.12-slim
│   └── app/
│       ├── main.py          # FastAPI app factory + /api/v1/health
│       ├── endpoints.py     # ALL HTTP endpoints in one file (see below)
│       ├── audit_service.py # Core business logic: upload, chunking, script exec, DB ops
│       ├── auth_service.py  # HMAC-SHA256 JWT decode + OA SSO + session mgmt
│       ├── pdf_report.py    # PDF generation via ReportLab (Chinese bilingual)
│       ├── CheckFWFile_v1.3.1.py  # External compliance check script (1062 lines)
│       ├── core/config.py   # Pydantic Settings (MONGO_URI, OA_JWT_SECRET, etc.)
│       └── models/checks.py # Pydantic models: CheckItem, CheckReport, FirmwareInfo
└── frontend/                # React + TypeScript + Vite
    ├── package.json         # pnpm
    ├── Dockerfile           # node:20-alpine
    ├── vite.config.ts       # port 3000, host 0.0.0.0
    └── src/
        ├── App.tsx          # Phase-based state machine: upload → analyzing → report
        ├── api/client.ts    # Axios-like API client (dev: 127.0.0.1:8000, prod: relative)
        ├── components/
        │   ├── UploadZone.tsx       # Drag-and-drop file upload with chunking
        │   ├── AnalyzingPhase.tsx   # Live console log streaming (polls every 1s)
        │   └── ComplianceReport.tsx # Report dashboard with charts
        ├── types/           # TypeScript interfaces
        └── utils/           # Helpers
```

## Architecture

### Three-Tier: Frontend → Backend → MongoDB

The backend uses a **simple layered design** (not Clean Architecture). All endpoints are in one file, services directly call PyMongo — no repository or ORM layer.

```
HTTP (REST JSON)
    │
    ▼
endpoints.py — FastAPI router (all routes)
    │
    ├──► audit_service.py — Upload logic, subprocess script runner, DB I/O
    ├──► auth_service.py  — HMAC-JWT decode, OA callback, session CRUD
    └──► pdf_report.py    — ReportLab PDF rendering
    │
    ▼
MongoDB (PyMongo, synchronous)
    Collections: audits, audit_logs, audit_checks, audit_uploads, users, sessions
```

### Key Architectural Facts (differs from CLAUDE.md)

- **No SQLAlchemy** — uses PyMongo synchronously. All DB calls are blocking.
- **No Repository pattern** — services call `pymongo.collection` methods directly.
- **No Dependency Injection** — services are instantiated with `MongoClient()` directly.
- **Empty directories**: `repositories/`, `schemas/`, `services/` under `app/api/v1/endpoints/` exist but contain no source files.
- **No tests** — no `pytest.ini`, no `tests/` directory, no Makefile.
- **Auth**: Custom HMAC-SHA256 JWT (no `python-jose`/`PyJWT`), session tokens stored in MongoDB.

### Data Flow

1. User uploads firmware `.zip` via `UploadZone` (chunked upload with progress bar)
2. Backend stores chunks to disk, creates `audits` doc (status: `PENDING`), runs `CheckFWFile_v1.3.1.py` as subprocess
3. Check script writes logs to `audit_logs` collection and results to `audit_checks` collection in real-time
4. Frontend polls `GET /audits/{id}/logs` every 1s during analysis phase
5. On completion: frontend fetches report JSON and renders via `ComplianceReport`
6. User can export PDF via `GET /audits/{id}/report.pdf`

### Authentication Flow

1. User clicks "Login" → redirected to OA SSO proxy at `tl.cooacloud.com/springboard_v3/login_proxy`
2. OA callback POSTs to `/api/v1/auth/oa/callback` with a signed JWT payload
3. Backend verifies HMAC-SHA256 signature, creates MongoDB session, returns session token
4. Frontend stores token, sends as `X-Session-Token` header on all requests
5. `get_current_user()` dependency resolves token → user on every protected endpoint

### API Endpoints (all in `endpoints.py`)

Base URL: `/api/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/audits` | Yes | Upload firmware file |
| POST | `/audits/chunk-init` | Yes | Start chunked upload |
| POST | `/audits/chunk` | Yes | Upload a chunk |
| POST | `/audits/chunk-complete` | Yes | Finalize chunked upload |
| GET | `/audits` | Yes | List audits (paginated) |
| GET | `/audits/{id}` | Yes | Get audit detail |
| GET | `/audits/{id}/logs` | Yes | Stream console logs |
| GET | `/audits/{id}/report` | Yes | Get report JSON |
| GET | `/audits/{id}/report.pdf` | Yes | Download PDF report |
| POST | `/auth/oa/callback` | No | OA SSO callback |
| GET | `/auth/me` | Yes | Current user info |

## Commands

### Backend

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Or use uv
cd backend && uv sync

# Run dev server
uvicorn backend.app.main:app --reload --port 8000

# Or from backend/ dir
cd backend && python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install
pnpm install

# Dev server (port 3000)
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

**Note:** Frontend dev requires `GEMINI_API_KEY` in `frontend/.env.local` (for the Gemini AI Studio deployment script). The app itself does not use Gemini — the key is only needed if deploying to Google AI Studio.

### Docker Compose (full stack)

```bash
# Start all services
docker compose up -d --build

# Stop
docker compose down

# View logs
docker compose logs -f
```

## MongoDB Collections

| Collection | Purpose | Key Fields |
|---|---|---|
| `audits` | Audit task documents | `status`, `filename`, `created_at`, `user_id` |
| `audit_logs` | Console-style log entries | `audit_id`, `timestamp`, `level`, `message` |
| `audit_checks` | Individual check item results | `audit_id`, `category`, `name`, `status` (pass/warning/fail) |
| `audit_uploads` | Chunked upload metadata | `audit_id`, `chunk_index`, `total_chunks` |
| `users` | OA user profiles | `oa_id`, `name`, `email` |
| `sessions` | Session tokens | `token`, `user_id`, `expires_at` |

## Key Design Documents

- `backend/log_assert_mongo_design.md` — Architecture proposal for the `log_assert` pattern that bridges the external check script with MongoDB. Documents the `AuditContext` approach used by `CheckFWFile_v1.3.1.py`.
- `frontend/PROJECT_STRUCTURE.md` — Frontend project structure reference.

## Important Notes

- **MongoDB connection**: Default `MONGO_URI` is `mongodb://10.17.154.252:27018` (overridden via env in `docker-compose.yml` to `mongodb://mongodb:27017`).
- **Check script**: The file `CheckFWFile_v1.3.1.py` is both imported as a module AND run as a subprocess. It uses a `log_assert()` function to write directly to MongoDB from within the subprocess.
- **Frontend API URL**: In dev mode, the client points to `http://127.0.0.1:8000/api/v1`; in production (Docker), it uses relative path `/api/v1` served through the same host.
- **No frontend tests**: The frontend has no test runner configured.
- **No backend tests**: The backend has no test infrastructure (no pytest config, no test directory).
