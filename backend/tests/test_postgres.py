"""Opt-in API integration tests. All writes use a disposable, uniquely named schema."""
import os
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import event, text

from backend import security
from backend.db.repository import PostgresRepository
from backend.db.session import create_database_engine, create_session_factory
from backend.routers import auth


pytestmark = pytest.mark.postgres
SQL_DIRECTORY = Path(__file__).resolve().parents[2] / "database"


@pytest.fixture
def postgres():
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("Set DATABASE_URL to run PostgreSQL integration tests")

    admin_engine = create_database_engine()
    engine = create_database_engine()
    schema = f"parking_test_{uuid4().hex}"

    @event.listens_for(engine, "connect")
    def select_test_schema(connection, _):
        with connection.transaction():
            connection.execute(f"SET search_path TO {schema}")

    created = False
    try:
        with admin_engine.begin() as connection:
            extension_schema = connection.scalar(text(
                "SELECT extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'btree_gist'"
            ))
            if extension_schema is None:
                pytest.fail("Apply database/schema.sql before running PostgreSQL integration tests")
            connection.exec_driver_sql(f"CREATE SCHEMA {schema}")
        created = True

        def run_script(filename):
            script = (SQL_DIRECTORY / filename).read_text().replace("public.", f"{schema}.")
            script = script.replace("CREATE EXTENSION IF NOT EXISTS btree_gist;", "")
            with admin_engine.begin() as connection:
                connection.exec_driver_sql(f"SET LOCAL search_path TO {schema}, {extension_schema}")
                raw = connection.connection.driver_connection
                # The fixture owns the SQLAlchemy transaction.
                raw.execute(script.replace("BEGIN;", "").replace("COMMIT;", ""))

        run_script("schema.sql")
        yield engine, run_script
    finally:
        engine.dispose()
        try:
            if created:
                with admin_engine.begin() as connection:
                    connection.exec_driver_sql(f"DROP SCHEMA {schema} CASCADE")
        finally:
            admin_engine.dispose()


@pytest.fixture
def repository(postgres):
    engine, _ = postgres
    return PostgresRepository(create_session_factory(engine))


def test_seed_spots_have_registered_owners(client, postgres):
    _, run_script = postgres
    run_script("seed.sql")
    owners = {user["id"] for user in client.get("/users").json() if user["is_owner"]}
    spots = client.get("/parking-spots").json()
    assert spots
    assert all(spot["owner_id"] in owners for spot in spots)


def test_seed_id_sequences_start_above_existing_ids(postgres):
    engine, run_script = postgres
    run_script("seed.sql")
    with engine.begin() as connection:
        for table, key in (("users", "user_id"), ("parking_spots", "spot_id"),
                           ("reservations", "reservation_id")):
            current_id = connection.scalar(text(f"SELECT max({key}) FROM {table}"))
            next_id = connection.scalar(
                text("SELECT nextval(pg_get_serial_sequence(:table, :key))"),
                {"table": table, "key": key},
            )
            assert next_id > current_id > 0


def test_registration_and_records_survive_connection_and_session_reset(
    client, signed_in, postgres, monkeypatch,
):
    owner, owner_headers = signed_in("Straße@example.com")
    renter, renter_headers = signed_in("renter@example.com", is_owner=False)
    duplicate = client.post("/users", json={
        "name": "Duplicate", "email": " STRASSE@EXAMPLE.COM ", "is_owner": False,
    })
    assert duplicate.status_code == 409
    assert duplicate.json() == {"detail": "Email already registered"}

    listing = client.post("/parking-spots", headers=owner_headers, json={
        "address": "123 Test Street", "description": "Driveway", "price": 12.35,
        "available": True, "owner_id": renter["id"], "latitude": 40.1, "longitude": -74.5,
    })
    assert listing.status_code == 200
    spot = listing.json()
    assert spot["owner_id"] == owner["id"]
    assert (spot["latitude"], spot["longitude"]) == (40.1, -74.5)
    assert client.get(f"/parking-spots/{spot['id']}").json() == spot
    response = client.post("/reservations", headers=renter_headers, json={
        "spot_id": spot["id"], "user_id": owner["id"],
        "start_time": "2099-11-02T05:00:00-05:00", "end_time": "2099-11-02T06:30:00-05:00",
    })
    assert response.status_code == 200
    reservation = response.json()
    assert reservation["user_id"] == renter["id"]
    assert reservation["total_cost"] == 18.53
    assert "renter_name" not in reservation

    # Editing an older client payload preserves the coordinates and booking price.
    update = {key: spot[key] for key in ("address", "description", "available", "owner_id")}
    updated = client.put(f"/parking-spots/{spot['id']}", headers=owner_headers, json=update | {"price": 50})
    assert updated.status_code == 200
    spot = spot | {"price": 50}
    assert updated.json() == spot
    assert client.get(f"/reservations/{reservation['id']}", headers=renter_headers).json() == reservation
    assert reservation["start_time"] == "2099-11-02T10:00:00+00:00"

    engine, _ = postgres
    with engine.connect() as connection:
        password_hash = connection.scalar(text("SELECT password_hash FROM users WHERE user_id = :id"),
                                          {"id": owner["id"]})
        assert password_hash.startswith("$argon2id$")
        assert security.verify_password("a secure test password", password_hash)
        assert connection.scalar(text("SELECT total_cost FROM reservations")) == Decimal("18.53")

    engine.dispose()
    monkeypatch.setattr(auth, "sessions", {})
    assert client.get("/auth/me", headers=owner_headers).status_code == 401
    login = client.post("/auth/login", json={
        "email": "STRASSE@example.com", "password": "a secure test password",
    })
    assert login.status_code == 200
    assert login.json()["user"] == owner
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/auth/me", headers=headers).json() == owner
    assert client.get("/owners/me/parking-spots", headers=headers).json() == [spot]
    assert client.get(f"/owners/{owner['id']}/reservations", headers=headers).json() == [
        reservation | {"renter_name": renter["name"]},
    ]
    assert client.delete(f"/reservations/{reservation['id']}", headers=headers).status_code == 403


def test_concurrent_bookings_and_rollback(client, booking, auth_headers):
    start = Barrier(2)

    def book():
        start.wait(timeout=5)
        return client.post("/reservations", json=booking)

    with ThreadPoolExecutor(max_workers=2) as workers:
        futures = [workers.submit(book) for _ in range(2)]
        responses = sorted((future.result() for future in futures), key=lambda response: response.status_code)
    assert [response.status_code for response in responses] == [200, 409]
    assert responses[1].json() == {"detail": "Parking spot is already reserved during that time"}
    first = responses[0].json()
    assert client.get("/reservations").json() == [first]
    spot_path = f"/parking-spots/{booking['spot_id']}"
    owner_headers = auth_headers(1)
    blocked = client.delete(spot_path, headers=owner_headers)
    assert blocked.status_code == 409
    assert blocked.json() == {"detail": "Cannot delete a parking spot with reservations"}
    assert client.post("/reservations", json=booking | {
        "start_time": booking["end_time"], "end_time": "2099-11-02T13:00:00",
    }).status_code == 200
    assert client.delete(f"/reservations/{first['id']}").status_code == 200
    assert client.post("/reservations", json=booking).status_code == 200


@pytest.mark.parametrize("start,end,visible", [
    ("07:00", "09:00", True),
    ("10:00", "12:00", False),
    ("09:00", "11:00", False),
    ("11:00", "13:00", False),
    ("10:30", "11:30", False),
    ("08:00", "10:00", True),
    ("12:00", "14:00", True),
])
def test_time_window_search_in_postgres(client, booking, create_spot, start, end, visible):
    assert client.post("/reservations", json=booking).status_code == 200
    other = create_spot(1)
    create_spot(1, available=False)
    response = client.get("/parking-spots", params={
        "start_time": f"2099-11-02T{start}:00Z",
        "end_time": f"2099-11-02T{end}:00Z",
        "available": True, "owner_id": 1, "min_price": 20, "max_price": 20,
    })
    assert response.status_code == 200
    assert [spot["id"] for spot in response.json()] == (
        [booking["spot_id"], other["id"]] if visible else [other["id"]]
    )


def test_listing_upgrade_preserves_existing_rows_and_supports_new_fields(client, booking, postgres, auth_headers):
    engine, run_script = postgres
    reservation = client.post("/reservations", json=booking).json()
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE parking_spots DROP COLUMN title, DROP COLUMN parking_type, DROP COLUMN photo_urls"
        )
    for _ in range(2):
        run_script("migrations/001_demo_listing_details.sql")

    path = f"/parking-spots/{booking['spot_id']}"
    spot = client.get(path).json()
    assert spot["description"] == "Test parking"
    assert "photo_urls" not in spot
    body = spot | {
        "title": "Concert parking", "parking_type": "Driveway",
        "photo_urls": ["https://example.com/parking.jpg"],
    }
    owner = auth_headers(1)
    assert client.put(path, headers=owner, json=body).status_code == 200
    assert client.get(path).json() == body
    assert client.patch(f"{path}/availability", headers=owner, json={"available": False}).status_code == 200
    assert client.get("/parking-spots", params={"available": True}).json() == []
    assert client.get(f"/reservations/{reservation['id']}").json() == reservation


def test_become_host_persists_across_connections(client, signed_in, postgres):
    user, headers = signed_in("new-host@example.com", is_owner=False)
    assert client.get("/owners/me/parking-spots", headers=headers).status_code == 403
    assert client.post("/auth/become-host", headers=headers).json() == user | {"is_owner": True}
    engine, _ = postgres
    engine.dispose()
    assert client.get("/auth/me", headers=headers).json() == user | {"is_owner": True}
    assert client.get("/owners/me/parking-spots", headers=headers).json() == []


def test_favorites_persist_unique_and_cascade(client, postgres, create_user, create_spot, auth_headers):
    engine, _ = postgres
    owner = create_user()
    renter = create_user("favorite-renter@example.com", is_owner=False)
    spot = create_spot(owner["id"], amenities=["EV Charging"])
    owner_headers, renter_headers = auth_headers(owner["id"]), auth_headers(renter["id"])
    root = "/users/me/favorites"
    path = f"{root}/{spot['id']}"
    for headers in (renter_headers, renter_headers, owner_headers):
        assert client.put(path, headers=headers).status_code == 200
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM favorites")) == 2
    assert client.delete(path, headers=owner_headers).status_code == 200
    engine.dispose()
    assert client.get(root, headers=renter_headers).json() == [spot]
    assert client.get(root, headers=owner_headers).json() == []
    assert client.delete(f"/parking-spots/{spot['id']}", headers=owner_headers).status_code == 200
    assert client.get(root, headers=renter_headers).json() == []


def test_marketplace_migration_preserves_bookings_and_releases_cancelled_window(client, postgres, booking):
    engine, run_script = postgres
    reservation = client.post("/reservations", json=booking).json()
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE favorites")
        connection.exec_driver_sql("ALTER TABLE parking_spots DROP COLUMN amenities")
        connection.exec_driver_sql("ALTER TABLE reservations DROP CONSTRAINT reservations_no_overlap, DROP COLUMN status")
        connection.exec_driver_sql("""ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlap
            EXCLUDE USING gist (spot_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)""")
    favorites = "/users/me/favorites"
    favorite = f"{favorites}/{booking['spot_id']}"
    for method, url in (("GET", favorites), ("PUT", favorite), ("DELETE", favorite)):
        response = client.request(method, url, headers={"Origin": "http://localhost:5173"})
        assert response.status_code == 503
        assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
        assert response.json()["code"] == "favorites_schema_missing"
        assert "SELECT" not in response.text

    for _ in range(2):
        run_script("migrations/002_marketplace_features.sql")
    assert client.get(favorites).json() == []
    assert client.put(favorite).json() == {"saved": True}
    assert [spot["id"] for spot in client.get(favorites).json()] == [booking["spot_id"]]
    assert client.delete(favorite).json() == {"saved": False}
    path = f"/reservations/{reservation['id']}"
    assert client.get(path).json() == reservation
    assert client.delete(path).status_code == 200
    assert client.get(path).json() == reservation | {"status": "cancelled"}
    params = {key: booking[key] for key in ("start_time", "end_time")}
    assert [spot["id"] for spot in client.get("/parking-spots", params=params).json()] == [booking["spot_id"]]
    assert client.post("/reservations", json=booking).status_code == 200
    assert client.post("/reservations", json=booking).status_code == 409
