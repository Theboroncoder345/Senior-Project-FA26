# In-memory authentication and marketplace authorization

## Run and test

```sh
python -m pip install -r backend/requirements-dev.txt
python -m uvicorn backend.main:app --reload
python -m pytest -c backend/pytest.ini -q
```

Run these commands from the repository root with your virtual environment activated.
Install `backend/requirements.txt` for runtime dependencies alone. Use one server process
until storage is persistent.

## Register and log in

`POST /auth/register` accepts JSON:

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "a long unique password",
  "is_owner": false
}
```

Registration returns **201** with `id`, `name`, `email`, and `is_owner`.
`is_owner` defaults to `false`. Passwords must contain 8–128 characters and cannot
be entirely whitespace; password whitespace is preserved. Blank names and invalid
email formats return **422**. Duplicate emails return **409**, ignoring case and
surrounding whitespace.

`POST /auth/login` accepts JSON with `email` and `password`. It returns **200**:

```json
{
  "access_token": "<opaque random token>",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 3,
    "name": "Alice",
    "email": "alice@example.com",
    "is_owner": false
  }
}
```

IDs depend on existing data. Unknown emails and incorrect passwords both return
**401** with `{"detail": "Invalid email or password"}`. Login responses include
`Cache-Control: no-store`.

Send `Authorization: Bearer <access_token>` to protected endpoints. `GET /auth/me`
returns the authenticated public user. Missing, invalid, expired, or deleted-user
sessions return **401** with `WWW-Authenticate: Bearer`. Sessions expire after one
hour without automatic refresh. Passwords use salted Argon2 hashing via `pwdlib`,
following [FastAPI's guidance](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/).
Password hashes and token digests are separate from public user records. Raw
passwords and bearer tokens are not retained in the in-memory stores.

## Route permissions

All existing endpoint paths are preserved. The two literal `/me` paths are new.

| Route | Access |
| --- | --- |
| `GET /parking-spots` | Public; existing optional filters remain |
| `GET /parking-spots/{spot_id}` | Public |
| `POST /parking-spots` | Authenticated registered owner; token supplies owner ID |
| `PUT /parking-spots/{spot_id}` | Only the listing's owner; ownership cannot change |
| `DELETE /parking-spots/{spot_id}` | Only the listing's owner; reservations block deletion |
| `GET /owners/me/parking-spots` | Registered owner; only their listings |
| `POST /reservations` | Any authenticated user; token supplies booking user ID |
| `GET /reservations` | Authenticated; only the caller's bookings |
| `GET /users/me/reservations` | Authenticated; only the caller's bookings |
| `GET /users/{user_id}/reservations` | Authenticated; path user must be the caller |
| `GET /owners/{owner_id}/reservations` | Authenticated registered owner; path owner must be the caller |
| `GET /reservations/{reservation_id}` | Booking creator or registered owner of the booked spot |
| `DELETE /reservations/{reservation_id}` | Only the booking creator, including when another user owns the spot |

The legacy list routes are protected to prevent bypassing detail-route permissions.
`GET /reservations` returns only bookings made by the caller; owners use their
owner-specific reservation route to see bookings for their listings. Query/body IDs
cannot impersonate another user on the `/me` routes. `/users/me/reservations` is
registered before `/users/{user_id}/reservations` so `me` is not parsed as an integer.

## Examples

Set `OWNER_TOKEN` and `RENTER_TOKEN` to access tokens returned by login. Examples
use listing ID 3 and reservation ID 1; substitute the IDs your requests return.

### Create a listing

```sh
curl -X POST http://127.0.0.1:8000/parking-spots \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"address":"123 Main Street","price":20,"description":"Driveway","available":true}'
```

Returns **200** with the listing and server-assigned `owner_id`. Non-owners receive
**403**. Legacy creation-body `owner_id` values are ignored.

### Update or delete your listing

```sh
curl -X PUT http://127.0.0.1:8000/parking-spots/3 \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"address":"123 Main Street","price":25,"description":"Driveway","available":true,"owner_id":3}'

curl -X DELETE http://127.0.0.1:8000/parking-spots/3 \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

PUT keeps its existing full-body format, including a positive `owner_id`. That ID
must equal the listing's existing owner: it cannot grant permissions or transfer
ownership, even when the target account is a valid owner. Another account receives
**403** and no data changes. PUT returns **200** with the updated listing.

DELETE returns **200** with `{"message":"Parking spot deleted"}`. Existing
reservations cause **409**, preserving the listing and bookings. Cancel those
bookings first; owners cannot cancel bookings made by other users.

### View your own data

```sh
curl http://127.0.0.1:8000/users/me/reservations \
  -H "Authorization: Bearer $RENTER_TOKEN"

curl http://127.0.0.1:8000/owners/me/parking-spots \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

Both return **200** with a list; no matching data produces `[]`. The owner listing
route returns **403** for authenticated non-owners.

### Book, read, and cancel a reservation

```sh
curl -X POST http://127.0.0.1:8000/reservations \
  -H "Authorization: Bearer $RENTER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"spot_id":3,"start_time":"2026-11-02T10:00:00","end_time":"2026-11-02T11:00:00"}'

curl http://127.0.0.1:8000/reservations/1 \
  -H "Authorization: Bearer $RENTER_TOKEN"

curl -X DELETE http://127.0.0.1:8000/reservations/1 \
  -H "Authorization: Bearer $RENTER_TOKEN"
```

Creation returns **200** with the authenticated user's `user_id`; legacy body
`user_id` values are ignored. The booking creator and booked spot's registered
owner can read the detail. Only the creator can cancel, returning **200** with
`{"message":"Reservation deleted"}`. Cancellation does not change the listing's
`available` flag; it removes the booking that blocked its time interval.

## Status codes and preserved validation

- **401:** Authentication missing, invalid, expired, or associated user no longer exists.
- **403:** Authenticated caller lacks permissions, attempts ownership transfer, or
  uses a non-owner account where an owner is required.
- **404:** Requested record does not exist, after authentication on protected routes.
- **409:** Duplicate email, unavailable spot, overlapping booking, or deletion of
  a spot that still has reservations.
- **422:** Invalid fields, IDs, prices, or times. Protected routes authenticate
  first; unauthenticated requests receive **401** even if input is also invalid.

Existing creation success codes remain **200**; registration remains **201**.
Prices must be finite and nonnegative; addresses/descriptions cannot be blank.
Reservation end time must follow start time. Mixed timezone awareness within a
booking is rejected; naive timestamps are treated as UTC when comparing different
bookings. Adjacent intervals are allowed. Availability checks, overlap checks,
monotonic IDs, and mutation locking remain intact. Authorization and write checks
run under the same in-process lock to prevent check/write races.

## Files and tests

- `backend/routers/auth.py`: shared `current_user` dependency and auth endpoints.
- `backend/routers/parking_spots.py`: owner-only update/delete and own-listing route.
- `backend/routers/reservations.py`: creator-only cancellation, permitted detail reads,
  own-booking route, and scoped legacy lists.
- `backend/validation.py`: existing registered-owner check plus a small shared record
  ownership check. Authorization uses stored records and the token identity.
- Models, password hashing, CORS, and endpoint paths retain their established behavior.
- Test fixtures isolate data and tokens. Tests cover missing/invalid/expired tokens,
  legitimate owners/renters, cross-account access, forged identities, ownership
  transfer, empty lists, `/me` routing, conflicts, missing records, validation, and
  registration/login through authorized operations without dependency overrides.

No frontend files are changed by the authorization work. The existing login page
and protected profile page remain intact. CORS permits only `http://localhost:5173`
and allows the `Authorization` header.

## Remaining pre-database limitations

- Storage and sessions are process-local and reset on restart. Multiple workers
  do not share data or locks. PostgreSQL needs migrations, foreign keys, unique
  email constraints, and transactions/concurrency protection for overlapping bookings.
- Demo owners and accounts created through legacy `POST /users` have no passwords
  and cannot log in. They cannot be claimed through registration. A credential
  migration/reset flow is still needed.
- Legacy `GET /users` remains public for compatibility and exposes names/emails.
  Define user-directory permissions or remove public email exposure before deployment.
- Registration lets users opt into the owner role; there is no owner verification
  or administrative approval flow.
- There is no server-side logout/revocation endpoint, password reset, email
  verification, Google sign-in, or login rate limiting. Frontend sign-out only
  clears its stored token; a copied token remains valid until expiry.
- Before public deployment, add HTTPS, abuse protection, production configuration,
  and a review of client-side token storage/XSS exposure. These concerns are not
  solved by replacing the in-memory lists with PostgreSQL.
