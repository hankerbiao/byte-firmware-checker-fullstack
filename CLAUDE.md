# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **智能固件合规审计系统** (Intelligent Firmware Compliance Audit System) - an AI-powered platform for automated compliance checking and auditing of BMC/BIOS firmware packages based on industry standards.

### Architecture

The system has three main components:

1. **Frontend** (`frontend/`): React + TypeScript + Vite application (port 3000)
2. **Main Backend** (`app/`): Python FastAPI application implementing clean architecture
3. **Template Backend** (`backend/`): Additional FastAPI service with comprehensive tests

### Backend Architecture (app/)

Clean architecture following **API → Service → Repository → Database** flow:

```
app/
├── api/                    # FastAPI routes & endpoints
│   ├── v1/
│   │   ├── endpoints/      # Auth, Users, Items endpoints
│   │   └── router.py       # Main API router
│   └── dependencies.py     # DI dependencies (auth, db)
├── core/                   # Infrastructure layer
│   ├── config.py          # Pydantic settings & environment
│   ├── database.py        # SQLAlchemy async engine & sessions
│   └── security.py        # JWT, password hashing
├── models/                 # SQLAlchemy ORM models
├── schemas/                # Pydantic schemas (request/response)
├── services/               # Business logic layer
├── repositories/           # Data access layer (Repository pattern)
└── main.py                # FastAPI application entry
```

**Key Patterns:**
- **Dependency Injection**: Using FastAPI's `Depends()` for auth, db, and services
- **Repository Pattern**: Generic `BaseRepository` with type-safe CRUD operations
- **Service Layer**: Business logic separated from API routes
- **Async/Await**: All database operations use async SQLAlchemy

## Common Commands

### Frontend (React 19 + TypeScript + Vite)

```bash
# Install dependencies (uses pnpm)
cd frontend
pnpm install

# Start development server (port 3000)
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

**Requires:** `GEMINI_API_KEY` in `frontend/.env.local`

### Main Backend (app/)

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run application
uvicorn app.main:app --reload

# Or using run.py (includes DB init)
python run.py

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html --cov-report=term

# Code linting
flake8 app tests

# Code formatting
black app tests
```

**Available Makefile commands:**
```bash
cd backend
make install      # Install dependencies
make run          # Start dev server
make test         # Run tests
make test-cov     # Run tests with coverage
make lint         # Lint code
make format       # Format code
make clean        # Clean cache files
make docker-build # Build Docker image
make docker-run   # Run with Docker Compose
make docker-dev   # Run dev environment
```

### Docker

```bash
# Production (with PostgreSQL)
cd backend
docker-compose up -d

# Development (with hot reload)
cd backend
docker-compose -f docker-compose.dev.yml up

# Build image
cd backend
docker build -t firmware-audit .
```

## Testing

### Backend Tests (pytest)

Located in `backend/tests/`:

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_auth.py -v

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test marker
pytest -m unit
pytest -m integration
```

**Test Configuration:** `backend/pytest.ini`
- Test paths: `tests/`
- Async mode enabled
- Custom markers: `unit`, `integration`, `slow`

**Test Structure:**
- `conftest.py` - Test fixtures (db, client)
- `test_auth.py` - Authentication tests
- `test_users.py` - User CRUD tests
- `test_items.py` - Item CRUD tests

## API Endpoints

### Main Application (app/api/v1/)

**Base URL:** `http://localhost:8000/api/v1`

**Authentication:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login (returns JWT)
- `GET /api/v1/auth/me` - Get current user

**Users:**
- `GET /api/v1/users/me` - Get current user
- `GET /api/v1/users/` - List users
- `GET /api/v1/users/{user_id}` - Get user by ID
- `PATCH /api/v1/users/{user_id}` - Update user
- `DELETE /api/v1/users/{user_id}` - Delete user

**Items:**
- `POST /api/v1/items/` - Create item
- `GET /api/v1/items/` - List items
- `GET /api/v1/items/me` - Get my items
- `GET /api/v1/items/{item_id}` - Get item by ID
- `PATCH /api/v1/items/{item_id}` - Update item
- `DELETE /api/v1/items/{item_id}` - Delete item

**Documentation:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health check: `http://localhost:8000/health`

## Database Configuration

### Default (SQLite)
Used for development/testing:
```bash
DATABASE_URL="sqlite+aiosqlite:///./app.db"
```

### PostgreSQL (Production)
```bash
DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/dbname"
```

**Environment variables:** Configure in `backend/.env`

## Frontend Architecture

### Frontend Structure

```
frontend/src/
├── api/              # API client & endpoints
├── assets/           # Static assets
├── components/       # Reusable UI components
│   ├── Header.tsx    # Navigation header
│   ├── Sidebar.tsx   # Side navigation
│   ├── UploadZone.tsx # File upload handling
│   ├── ComplianceReport.tsx # Audit results display
│   └── auth.tsx      # Authentication components
├── constants/        # Mock data & constants
├── hooks/            # Custom React hooks
├── pages/            # Page components
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── App.tsx           # Main application (workflow: upload → analyzing → report)
```

### Frontend Tech Stack
- **React 19** with TypeScript
- **Vite 6** for build tooling
- **Lucide React** for icons
- **Recharts** for data visualization

### Key Features
- **Dark/Light theme** toggle (persisted to localStorage)
- **Firmware upload** zone with drag-and-drop
- **AI-powered audit** workflow with real-time console logs
- **Compliance reporting** dashboard with scoring
- **Responsive design** with Tailwind-like classes

### Component Patterns
- Use `React.memo()` for performance optimization
- Use `useCallback()` for callback memoization
- Phase-based state machine: `upload` | `analyzing` | `report`

## Key Files to Reference

### Backend Configuration
- `backend/requirements.txt` - Python dependencies
- `backend/pytest.ini` - Test configuration
- `backend/Makefile` - Common tasks
- `backend/docker-compose.yml` - Production Docker setup
- `backend/docker-compose.dev.yml` - Development Docker setup
- `backend/PROJECT_SUMMARY.md` - Detailed architecture documentation

### Backend Core
- `backend/app/main.py` - FastAPI application entry
- `backend/app/core/config.py` - Settings & environment management
- `backend/app/core/database.py` - Database connection & session management
- `backend/app/core/security.py` - JWT & password security
- `backend/app/repositories/base_repository.py` - Generic CRUD repository

### Frontend Configuration
- `frontend/package.json` - Dependencies & scripts (uses pnpm)
- `frontend/vite.config.ts` - Vite configuration
- `frontend/tsconfig.json` - TypeScript configuration
- `frontend/.env.local` - Environment variables (requires GEMINI_API_KEY)

## Development Workflow

### 1. Local Development

```bash
# Backend
cd backend
make install
make run

# Frontend (in another terminal)
cd frontend
pnpm install
pnpm run dev
```

### 2. Running Tests

```bash
# Backend tests
cd backend
make test        # Quick tests
make test-cov    # With coverage report

# Frontend - no test runner configured yet
```

### 3. Database Operations

```bash
# Using run.py (recommended)
python run.py

# Direct uvicorn
uvicorn app.main:app --reload
```

### 4. Code Quality

```bash
cd backend
make lint   # Check code style
make format # Fix code style
```

## Important Notes

1. **Environment Variables:**
   - Frontend: Set `GEMINI_API_KEY` in `frontend/.env.local`
   - Backend: Configure `DATABASE_URL`, `SECRET_KEY` in `backend/.env`

2. **Database:**
   - SQLite used by default for development
   - PostgreSQL for production (via Docker)

3. **Authentication:**
   - JWT-based authentication
   - Endpoints protected with `get_current_user` dependency

4. **Testing:**
   - Uses pytest with async support
   - In-memory SQLite for tests
   - HTTPX test client

5. **Docker:**
   - Development: Hot reload enabled
   - Production: Optimized build with Gunicorn

## Architecture Decisions

### Backend (FastAPI)
- **Repository Pattern**: Decouples business logic from data access
- **Service Layer**: Encapsulates complex business operations
- **Dependency Injection**: Leverages FastAPI's built-in DI system
- **Async SQLAlchemy**: Non-blocking database operations
- **Pydantic v2**: Type validation & serialization
- **Clean Architecture**: Clear separation of concerns (API → Service → Repository → DB)

### Frontend (React 19)
- **Component Composition**: Small, focused components with clear props
- **Phase-based State Machine**: Workflow states (`upload` → `analyzing` → `report`)
- **Performance**: Use `React.memo()` for static components, `useCallback()` for callbacks
- **TypeScript**: Strict typing for props, state, and API responses
- **Mock-driven Development**: Simulation functions (`generateMockReport`, `generateMockAnalysisLogs`) for demo data

## Resources

- FastAPI Docs: https://fastapi.tiangolo.com/
- SQLAlchemy Async: https://docs.sqlalchemy.org/
- React + Vite: https://vitejs.dev/
- Pytest: https://docs.pytest.org/