# PostgreSQL preparation

The running FastAPI API still uses `backend/store.py`. No route, authentication,
authorization, or frontend contract has been switched to PostgreSQL. Merely setting
`DATABASE_URL` does not switch storage. This is connection and schema preparation,
not a completed persistent backend.

## Scripts and local setup

`schema.sql` bootstraps an **empty** database in one transaction: users, parking
spots, reservations, indexes, validated foreign keys, and overlap protection.
It requires permission to install the standard `btree_gist` extension. It deliberately
fails if tables already exist rather than silently leaving an older schema unchanged.
It is not an upgrade migration. Do not drop existing teammate data to apply it.

`seed.sql` optionally inserts one demo owner, listing, and historical reservation
atomically. It uses generated IDs through `RETURNING`, not assumed IDs of 1.
Its password hash is NULL: the demo account cannot log in. It is intended to run
once; rerunning fails on unique email and rolls back. No shared demo password is
provided. Real accounts must be registered and hashed through the backend once
persistent registration is implemented. Current API registration only writes memory.

With a PostgreSQL database created by your administrator, apply using psql's normal
connection environment (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`; use a password
prompt or local credential manager):

```sh
psql -v ON_ERROR_STOP=1 -f database/schema.sql
# Optional, development only:
psql -v ON_ERROR_STOP=1 -f database/seed.sql
```

Install `backend/requirements-dev.txt`. Set `DATABASE_URL` in your shell using the
placeholder pattern in root `.env.example`; URL-encode reserved characters in
credentials. No dotenv file is loaded automatically. Do not commit credentials.

```sh
python -m backend.db.session
```

This explicitly opens a connection and executes SELECT 1, then disposes the engine.
It does not apply schema, seed data, or enable persistence. Connection factories use
SQLAlchemy 2 and psycopg 3, pre-ping, a five-second connection timeout, and UTC.
`session_scope` commits successful work, rolls back failures, and closes sessions.
Do not expose driver exception text (which can contain connection details) in HTTP
responses. Application startup/import does not require a database or connect to one.

## Initial comparison and field mapping

This comparison was completed before editing. Column names from the teammate's
schema are retained. `backend/db/mapping.py` projects only existing public fields.

| API / in-memory field | PostgreSQL column | Original mismatch / decision |
| --- | --- | --- |
| User `id` | `users.user_id` | Explicit mapping, generated serial ID |
| User `name` | `users.full_name` | Originally nullable varchar(255); required nonblank text now |
| User `email` | `users.email` | Originally varchar(255), no uniqueness; text and unique Python-normalized email_key now |
| User `is_owner` | `users.is_owner` | Missing; added required boolean, default false |
| Private password map | `users.password_hash` | Originally required; NULL now represents legacy/non-login accounts |
| Listing `id` | `parking_spots.spot_id` | Explicit mapping, generated serial ID |
| Listing `price` | `parking_spots.price_per_hour` | Originally numeric(10,2), no nonnegative check; finite nonnegative double now |
| Listing `available` | `parking_spots.is_available` | Originally nullable; required boolean now |
| Listing `description` | `parking_spots.description` | Missing; required nonblank text added |
| Listing `owner_id`, `address` | Same | Owner FK retained; address gets nonblank check |
| No coordinate fields | `latitude`, `longitude` | Originally required; temporarily nullable so current listing creation works |
| Reservation `id` | `reservations.reservation_id` | Serial originally lacked PK; PK added |
| Reservation `spot_id`, `user_id` | Same | Existing FKs retained and fully validated |
| Reservation `start_time`, `end_time` | Same | Originally zone-less; timestamptz now, end-after-start and no-overlap constraints added |
| No billing field | `reservations.total_cost` | Nullable numeric(10,2) retained; no invented charge calculation or API field |
| No public metadata | `users.phone`, all `created_at` | Phone retained unchanged; created_at becomes required timestamptz, stays database-only |
| Private bearer sessions | No table yet | Sessions contain token digests, user IDs, epoch expiry; remain memory-only |

## Every schema change and why

- Added `is_owner` and `description` because existing authorization and listing
  functionality depend on them. Required API fields now reject NULL in SQL.
- Made password hashes nullable to support the existing passwordless `/users`
  endpoint and demo owners. Non-NULL values must be generated with the existing
  `pwdlib` Argon2 hasher; never use a fake string. Future login must refuse NULL
  hashes and verify a dummy hash for timing parity, as it does today.
- Removed name/email varchar limits because the API has no corresponding length
  limits; added name/address/description nonblank checks. SQL `trim` checks basic
  spaces, while Python validation strips additional Unicode whitespace: retain
  request validation when adding the repository.
- Added required unique `email_key` (C collation), populated by Python
  `email.strip().casefold()` in the mapping layer, matching current duplicate and
  login checks including Unicode. PostgreSQL lower/trim is not equivalent. Keep
  public `email` unchanged. Persistent lookups must query `email_key`; every writer,
  including imports, must populate it using this helper/policy. SQL enforces key
  uniqueness but cannot independently verify Python normalization; do not grant
  untrusted clients direct table writes. Seed email keys are explicit ASCII values.
- Changed hourly price to double precision to match existing finite float inputs
  without silently rounding values to cents or imposing numeric(10,2)'s range.
  Added a finite nonnegative check (also rejects NaN/infinities in PostgreSQL).
  This preserves current behavior; a future billing feature should agree on a
  decimal money policy rather than use binary floats for charging.
- Made coordinates nullable temporarily. Geocoding, validation, and a coordinated
  API/frontend change are prerequisites for making them mandatory.
- Added reservation PK, positive duration check, and database exclusion constraint
  for the existing ID, time validation, and double-booking behavior.
- Removed FK `NOT VALID`; fresh data must obey all relationships. Kept restrictive
  delete/update behavior: a booked spot cannot be deleted. Owner-role authorization
  still belongs in the service transaction; a user FK does not establish ownership.
- Converted all timestamps to `timestamptz` and made creation timestamps non-null.
  Mapping interprets naive request timestamps as UTC and normalizes aware values
  to UTC, matching existing overlap checks. PostgreSQL preserves the instant, not
  the original offset/naive representation. Current memory responses are unchanged;
  database responses will need an explicit compatibility decision about UTC output.
- Removed hard-coded `OWNER TO postgres` so a normal application/schema role can
  bootstrap without superuser ownership. Existing tables, column names, serial IDs,
  phone, total_cost, and default tablespace design are otherwise retained.
- Added an explicit transaction and removed `IF NOT EXISTS` for tables to avoid a
  misleading successful run against an incompatible existing schema.

## Transactions and double-booking

`btree_gist` supports the exclusion constraint on `(spot_id =, tstzrange(..., '[)') &&)`.
PostgreSQL rejects overlapping bookings for the same spot even under concurrent
transactions; adjacent reservations are allowed. See the official
[range exclusion documentation](https://www.postgresql.org/docs/17/rangetypes.html).
An application SELECT followed by INSERT, or a Python thread lock across workers,
is not sufficient protection.

The future repository must perform reservation authorization, availability checks,
and insert in one transaction; lock the spot row with `SELECT ... FOR UPDATE` to
coordinate with availability updates and deletion. All relevant listing mutations
must use the same lock discipline. Keep the exclusion constraint as the final
cross-worker safeguard. Roll back on exclusion violation (SQLSTATE 23P01), then
return the existing HTTP 409 conflict. Translate known uniqueness/FK conflicts
without leaking SQL details. Cancellation must commit deletion before space becomes
available again. Test these with independent real database connections.

## What remains before full integration

- Verify connection, schema/seed execution, permissions, constraints, timezone
  handling, rollback and concurrent bookings against an actual PostgreSQL instance.
- For existing installations, write a reviewed versioned migration. Audit duplicate
  emails, missing names/descriptions/owner flags, orphan FKs, invalid prices/times,
  and overlapping bookings first. Backfill missing fields deliberately; do not
  invent descriptions or infer owner status without reviewing data. Convert old
  zone-less timestamps with `AT TIME ZONE 'UTC'` only after confirming historical
  data really used UTC. Do not run this bootstrap over existing tables.
- Implement a transactional repository/service boundary covering users, credentials,
  spots and reservations together; adapt routes through dependency injection and
  retain an in-memory implementation for tests. Current routes and test fixtures
  directly share mutable collections/counters, so a superficial list wrapper would
  not provide transaction safety. This refactor is deferred rather than implying
  that connection factories or mapping functions already implement persistence.
- Use normalized email keys for persistent lookups; resolve timestamp response representation and
  non-login account/hash handling in the persistent repository.
- Decide shared session storage before multi-worker use; PostgreSQL entity storage
  alone does not make current in-memory bearer sessions persistent/shared.
- Run existing API contract/auth/authorization tests against the repository and add
  real PostgreSQL integration/concurrency tests before enabling it. No credentials
  or actual PostgreSQL connection were supplied or verified in this change.
