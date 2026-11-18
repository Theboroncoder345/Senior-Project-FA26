# Parking Marketplace

A React/Vite frontend and FastAPI backend for listing parking spots and making
reservations. The backend supports registration, bearer-token login, owner-only
listing management, and reservation permissions. PostgreSQL stores users,
password hashes, listings, and reservations across FastAPI restarts. Bearer
sessions are process-local, so users sign in again after a restart.

## Repository layout

```text
Senior-Project-FA26/
├── backend/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application and CORS
│   ├── db/                      # PostgreSQL repository, configuration, and mapping
│   ├── models/                  # Request/response models and validation
│   ├── routers/                 # Auth, users, parking spots, reservations
│   ├── tests/                   # pytest/TestClient tests
│   ├── security.py              # Password hashing and session helpers
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

With the virtual environment activated, initialize PostgreSQL once using
[the database setup steps](database/README.md). If the current schema is already
installed, reuse it. Copy `.env.example` to `.env` if you need a local configuration
file, fill in the connection URL, and export it when starting the API.

```sh
# From the repository root, with a local shell-compatible .env:
set -a
source .env
set +a
python -m uvicorn backend.main:app --reload
```

The API runs at <http://127.0.0.1:8000>. Interactive API documentation is available
at <http://127.0.0.1:8000/docs>, with the OpenAPI schema at
<http://127.0.0.1:8000/openapi.json>.

Use one API worker because bearer sessions are local to each process. Demo
accounts and accounts created through legacy `POST /users` have no passwords.
Register through `/auth/register` to log in, using `is_owner: true` for owner
functionality.

### Run backend tests

```sh
python -m pytest -c backend/pytest.ini -m "not postgres" -q
# With DATABASE_URL exported and the database initialized:
python -m pytest -c backend/pytest.ini -m postgres -q
```

The Docker-free suite uses an isolated test repository and fresh bearer sessions.
The integration suite creates and removes uniquely named schemas in the configured
database. See the [database guide](database/README.md) for the permissions it needs.

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
- The switch uses the current PostgreSQL schema. Records from earlier in-memory
  runs have no migration path in this change.
- Review the security limitations in the authentication guide before public
  deployment; adding PostgreSQL alone will not address them.
