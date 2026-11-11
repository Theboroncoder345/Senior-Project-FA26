# Parking Marketplace

A React/Vite frontend and FastAPI backend for listing parking spots and making
reservations. The backend supports registration, bearer-token login, owner-only
listing management, and reservation permissions. PostgreSQL integration is
pending: records and sessions currently live in memory and reset on restart.

## Repository layout

```text
Senior-Project-FA26/
├── backend/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application and CORS
│   ├── db/                      # Explicit PostgreSQL config, sessions, field mappings
│   ├── models/                  # Request/response models and validation
│   ├── routers/                 # Auth, users, parking spots, reservations
│   ├── tests/                   # pytest/TestClient tests
│   ├── security.py              # Password hashing and session helpers
│   ├── store.py                 # In-memory records, counters, and lock
│   ├── validation.py            # Shared authorization checks
│   ├── requirements.txt         # Runtime dependencies
│   ├── requirements-dev.txt     # Runtime and test dependencies
│   ├── pytest.ini
│   └── AUTHENTICATION.md
├── database/                   # PostgreSQL bootstrap schema, optional demo seed, setup notes
├── .env.example                # Placeholder DATABASE_URL; no real credentials
├── frontend/                   # Existing React/Vite project
├── .gitignore
└── README.md
```

The outer directory name can differ in your checkout. Run the commands below
from the repository root unless a `cd` command is shown. Documentation lives in
this README and the backend authentication guide; no empty `docs/` folder is
required.

## Prerequisites

- Python 3.10 or newer (the current project was checked with Python 3.13).
- Node.js 22.12 or newer in the Node 22 line, or a newer supported LTS release,
  plus npm. The existing Vite 8 project was checked with Node.js 22.23.

## Backend setup

Create and activate a virtual environment at the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
```

On Windows, create it with `py -m venv .venv` and activate it in PowerShell with
`.venv\Scripts\Activate.ps1`. Use `backend/requirements.txt` instead if you only
need runtime dependencies.

### Start FastAPI

With the virtual environment activated, run from the repository root:

```sh
python -m uvicorn backend.main:app --reload
```

The API runs at <http://127.0.0.1:8000>. Interactive API documentation is available
at <http://127.0.0.1:8000/docs>, with the OpenAPI schema at
<http://127.0.0.1:8000/openapi.json>.

Use one server process while storage is in memory. Authentication, records, and
locks are not shared across multiple workers. The demo owners and legacy accounts
have no passwords; register a new account through `/auth/register` to log in.
For owner functionality, register with `is_owner: true`.

### Run backend tests

```sh
python -m pytest -c backend/pytest.ini -q
```

Tests isolate in-memory records and sessions. If you are already inside
`backend/`, `python -m pytest -q` also works with the same activated environment.
Python imports use the `backend` package, so the old root-level `main:app` command
has been replaced by `backend.main:app`. The obsolete root `main.py` was removed
to prevent accidentally launching a different backend.

## Frontend setup

In a separate terminal:

```sh
cd frontend
npm ci
npm run dev -- --host localhost --port 5173 --strictPort
```

Open <http://localhost:5173>. Keep FastAPI running in the other terminal. The
frontend currently calls `http://127.0.0.1:8000`; the backend permits the exact
browser origin `http://localhost:5173` through CORS. Using a different frontend
host or port requires a deliberate configuration change.

Sign in using an account registered with the API. The existing frontend supports
available spots, owner listing creation, booking/cancellation, and personal lists.
There is not yet a working frontend registration form.

### Frontend checks

From `frontend/`:

```sh
npm run lint
npm run build
```

The production build is generated in `frontend/dist/`. Do not commit it.

## Authentication and API details

See [backend/AUTHENTICATION.md](backend/AUTHENTICATION.md) for registration/login
payloads, bearer tokens, route permissions, examples, and current limitations.
Use FastAPI's `/docs` page for the complete endpoint schemas.

## Team workflow and current limits

- Keep Python code and tests under `backend/`, and React/Vite code under
  `frontend/`. Add a `docs/` folder when additional shared documentation is needed.
- Do not commit virtual environments, `node_modules`, build output, Python/test
  caches, `.DS_Store`, or `.env` files. The root `.gitignore` covers these items;
  install dependencies locally after cloning.
- PostgreSQL schema constraints, safe non-login seed data, connection/session
  factories, and explicit API field mappings are prepared. Routes still use memory;
  setting `DATABASE_URL` does not enable persistence. No database is needed for
  current API usage or tests. See [database/README.md](database/README.md) for setup,
  the complete schema change rationale, migration cautions, and remaining work.
- Review the security limitations in the authentication guide before public
  deployment; adding PostgreSQL alone will not address them.
