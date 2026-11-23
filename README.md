# ParkShare

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
[the database setup steps](database/README.md). When upgrading an existing ParkShare database, apply the listing-details and
marketplace migrations in order. If migration 001 is already installed on the
local `parking-postgres` container, apply migration 002 from the repository root:

```sh
docker exec -i parking-postgres psql -X -U parking_user -d parking_marketplace -v ON_ERROR_STOP=1 < database/migrations/002_marketplace_features.sql
```

The API reads `DATABASE_URL` from the process environment. Copy
`.env.example` to `.env`, fill in the connection URL, and export it when starting the API.

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
accounts seeded by SQL and accounts created through legacy `POST /users` are
passwordless. Create sign-in accounts from the browser signup page.

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

Open <http://localhost:5173> with FastAPI running. The shared client defaults to
`http://127.0.0.1:8000`. Copy `frontend/.env.example` to `frontend/.env` to
set `VITE_API_BASE_URL` or enable maps and destination suggestions with a public
`VITE_MAPBOX_ACCESS_TOKEN`. FastAPI allows the browser origin
`http://localhost:5173` by default.

### Demo walkthrough

1. Sign up as a host by checking **I want to list parking**, or sign in with an
   existing account and select **Become a host** on the Host Dashboard.
2. Publish a listing near PNC Bank Arts Center in Holmdel, NJ. Enter coordinates
   for your own demo parking spot. Add a title, parking type, and up to five
   photos using **Upload Photos** and **Add Image URL** in any combination.
   Select amenities and describe access instructions and vehicle restrictions.
3. Sign out, create a renter account, search for `pnc`, and select **PNC Bank Arts
   Center**. Choose a start and end time. Open a result or a map marker and reserve
   the spot with the prefilled interval. Use **My Bookings** to view or cancel it.
4. Sign back in as the host to see the reservation and its stored booking value.
   Edit the listing, pause or unpause it, and try deleting it while a reservation
   exists. Cancel from the renter account to free the time slot and show the
   booking in the Cancelled tab. Pause listings with retained booking history.

PostgreSQL filters reservation overlaps. Adjacent windows are available, and
booking creation still checks for conflicts in the database. The browser sorts
and filters by straight-line distance using listing coordinates. Listings without
coordinates remain in the list unless a radius is set. Mapbox destination
suggestions are used in the browser and never persisted.

Hosts can mix local uploads and HTTPS URLs, up to five photos per listing. The
first is the cover, and the gallery uses a placeholder for missing images.
See [classroom photo uploads](database/README.md#classroom-photo-uploads)
for format and storage limits. Use the heart to save parking and open
**Saved parking** from the account menu.

My Bookings groups reservations into Upcoming, Past, and Cancelled. The host
dashboard shows booking value based on stored reservation totals, excluding
cancelled reservations.

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


## Production configuration

Set `DATABASE_URL` on the backend and set `CORS_ORIGINS` to a comma-separated
list of approved HTTPS frontend origins. Build the frontend with
`VITE_API_BASE_URL` set to the HTTPS API URL and `VITE_MAPBOX_ACCESS_TOKEN` set to
a public token restricted to your site. Serve `frontend/dist` with HTTPS and a
fallback to `index.html` for frontend routes.

Run schema changes separately and check database connectivity before starting
the API. Start one worker behind the HTTPS reverse proxy:

```sh
python -m backend.db.session
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1
```

Before public deployment, replace process-local sessions with durable,
revocable sessions, add login and registration abuse controls, retire the
passwordless legacy creation route, and set up managed secrets, backups,
monitoring, and account recovery. Review personal data exposure and external
image hosting before accepting public listings.
