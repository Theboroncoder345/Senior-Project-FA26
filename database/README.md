# PostgreSQL persistence

FastAPI stores users, Argon2 password hashes, parking spots, and reservations in
PostgreSQL. These records survive API restarts. Bearer sessions remain local to
the FastAPI process, expire after one hour, and are lost on restart. Run a single
API worker until sessions are shared.

## Start PostgreSQL with Docker

From the repository root, with an unused local port 5432:

```sh
cp .env.example .env
# Fill in DATABASE_URL with the same user, database, and password you use below.
docker volume create parkshare-db-data
docker run --name parkshare-db -d -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=parkshare -e POSTGRES_DB=parkshare \
  -e POSTGRES_PASSWORD='<local-password>' -v parkshare-db-data:/var/lib/postgresql/data postgres:16
docker exec -i parkshare-db psql -U parkshare -d parkshare -v ON_ERROR_STOP=1 < database/schema.sql
```

Use `docker start parkshare-db` on subsequent runs. On an existing Docker database,
run the migration below against the existing container instead of bootstrapping.

## Set up or migrate a local database

Use a running PostgreSQL instance and an empty database. Run these commands from
the repository root using your normal psql connection settings (`PGHOST`,
`PGPORT`, `PGDATABASE`, and `PGUSER`). The bootstrap role needs permission to
install `btree_gist`.

```sh
psql -v ON_ERROR_STOP=1 -f database/schema.sql
# Optional demo owner, listing, and historical booking
psql -v ON_ERROR_STOP=1 -f database/seed.sql
```

For a database already running the previous PostgreSQL-backed ParkShare
schema, apply these additive migrations in order. It preserves existing IDs, listings,
users and bookings. Fresh installs already include the changes.

```sh
psql -v ON_ERROR_STOP=1 -f database/migrations/001_demo_listing_details.sql
psql -v ON_ERROR_STOP=1 -f database/migrations/002_marketplace_features.sql
```

For earlier database layouts, compare against the current schema first. The optional
seed runs once and uses generated IDs. Its demo owner has no password. Use
`POST /auth/register` to create an account that can sign in.

Install `backend/requirements.txt` or `backend/requirements-dev.txt` and export
`DATABASE_URL` using the `postgresql+psycopg://` format in root `.env.example`.
URL-encode reserved characters in credentials. If you keep the URL in a local
`.env`, export it before running the commands below.

```sh
set -a
source .env
set +a
python -m backend.db.session
python -m uvicorn backend.main:app --reload
```

The connection check executes `SELECT 1`. API requests open database sessions as
needed. The runtime role needs access to the database, tables, and sequences.
Keep credentials in local configuration.

## Load the classroom marketplace

After bootstrapping or migrating a local database, load the optional classroom
seed into the development database. It adds **28 fictional listings** (24 active
and 4 paused), four each around PNC Bank Arts Center, MetLife Stadium, Monmouth
University, Newark Liberty International Airport, Asbury Park, Long Branch,
and Red Bank.

For the existing local Docker setup, run from the repository root:

```sh
docker exec -i parking-postgres psql -U parking_user -d parking_marketplace -v ON_ERROR_STOP=1 < database/demo_seed.sql
```

For the `parkshare-db` container shown above, substitute container name
`parkshare-db`, user `parkshare`, and database `parkshare`. Outside Docker, use
`psql -v ON_ERROR_STOP=1 -f database/demo_seed.sql` with your regular connection
settings.

All listings are explicitly labeled as fictional. The pins and area labels
illustrate search and distance sorting. They do not identify parking available
at a real address. The seven reserved `@parkshare-demo.example` hosts have NULL
password hashes and cannot sign in. Create separate accounts via the existing
signup flow to demonstrate host and renter actions. The seed adds no
reservations, so you can make a booking during the demo and repeat the same
time-window search to show the listing disappearing.

Newly seeded driveways share an illustrative, generated driveway photo bundled
in the frontend. Other listings use HTTPS demo graphics from Placehold.co,
which require internet access. Listing cards and detail show a parking
placeholder when an image is missing or unavailable.
Newly inserted demo listings include parking amenities where applicable.

Rerunning the seed skips existing demo rows and leaves their IDs intact. The new
photo and amenity examples appear on newly seeded rows.
To restore the original demo data, remove it and load it again:

```sh
docker exec -i parking-postgres psql -U parking_user -d parking_marketplace -v ON_ERROR_STOP=1 < database/demo_reset.sql
docker exec -i parking-postgres psql -U parking_user -d parking_marketplace -v ON_ERROR_STOP=1 < database/demo_seed.sql
```

Reset only targets rows with the reserved demo owner identities and dataset
labels. If a seeded listing has a reservation, the foreign key prevents reset
and the transaction rolls back. Existing reservations and the original minimal
seed are left alone.

## API and database behavior

- Routes keep the existing public field names. Password hashes, normalized email
  keys, and database metadata stay private. Registration writes the user and
  hash together. Legacy `POST /users` writes a passwordless account.
- PostgreSQL enforces uniqueness on `users.email_key`. The repository populates
  and looks up this key with `email.strip().casefold()`, including Unicode case
  folding. Import scripts must use the same normalization and the original
  spelling in `users.email`.
- Booking creation locks the listing row, checks availability, and inserts the
  reservation in one transaction. Listing updates and deletes acquire the same
  lock. PostgreSQL's `reservations_no_overlap` constraint rejects intersecting
  bookings on the same spot. Adjacent intervals are allowed. Overlaps, duplicate
  emails, and attempts to delete a booked listing return HTTP 409.
- A reservation starts active and is shown as completed once its end time passes.
  Only the renter can cancel an active reservation. Cancellation preserves history
  and releases the time window. Bookings retained in history still prevent listing
  deletion. Existing reservation IDs and totals are preserved by migration 002.
- Favorites use a unique user/listing pair and are scoped to the signed-in account.
  Deleting a listing removes its favorites. Amenities use a controlled text array.
- Reservation timestamps use `timestamptz`. The API interprets naive inputs as UTC
  and returns ISO 8601 timestamps with an explicit UTC offset. The response
  retains the existing reservation fields.
- Each new booking stores elapsed hours multiplied by the hourly price at the
  time of booking. The total is rounded to cents, with half cents rounded up.
  Later listing price changes leave existing totals intact. Totals that round
  above `99,999,999.99` return HTTP 422 because `total_cost` is `numeric(10,2)`.
  Existing totals, including any historical NULL values, are left as stored.
  Authorized reservation responses include `total_cost`. The owner-specific
  reservation list also includes `renter_name` for reservations on that owner's
  spots. It contains no renter email or other contact fields.
- Parking-spot responses include stored coordinates when present. Owners can
  supply a valid latitude and longitude pair on create or update. Updates
  that omit the pair preserve it. Sending both coordinates as null removes it.
- Records created by the previous in-memory implementation are outside this
  migration. The API uses the data already in PostgreSQL and writes new records there.

## Run PostgreSQL integration tests

Use a local development database with `btree_gist` installed and a user with
permission to create schemas in that database. From the repository root, with
`DATABASE_URL` exported:

```sh
python -m pytest -c backend/pytest.ini -m postgres -q
```

The tests create uniquely named schemas, install copies of the application
tables within those schemas, and drop the test schemas during teardown.
Application data in `public` is untouched. Run with `-m "not postgres"` for the
backend suite that requires no database. When `DATABASE_URL` is absent, the
integration tests skip.


## Classroom photo uploads

Authenticated hosts can upload JPG, JPEG, PNG, and WebP files up to 5 MiB
(5,242,880 bytes) and 16 megapixels each. The API requires matching extension,
image content type, and decodable raster content. It normalizes EXIF orientation
and re-encodes a single still image without the original metadata or trailing
bytes. Only generated raster paths are published by FastAPI under `/uploads/`.
The backend never uses the original filename. The photo editor posts the raw
image to `POST /parking-photos?extension=...` with its image content type and
the host's bearer token, then attaches the returned `url` when saving.

The listing stores up to five references in `parking_spots.photo_urls`, including
any combination of uploaded paths and HTTPS image URLs. The first reference is
the cover, and the second through fifth appear with it on the detail page.
Uploaded files default to `backend/uploads/`. Set `PARKSHARE_UPLOAD_DIR` before
starting FastAPI to use another writable directory dedicated to uploads. The
filesystem and the database both need to be retained across restarts. Images are
public by URL as soon as an upload succeeds. Removing a preview or editing a
listing removes the reference. Unreferenced files can remain on disk.

Use this storage for local or classroom demos. A public deployment needs object
storage such as S3 or Cloudinary, along with storage quotas, orphan-file cleanup,
and an upload lifecycle. Remote HTTPS photos load directly in the browser and
depend on their origin's availability.
