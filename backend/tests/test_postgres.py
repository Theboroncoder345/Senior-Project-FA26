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
        "start_time": "2026-11-02T05:00:00-05:00", "end_time": "2026-11-02T06:30:00-05:00",
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
    assert reservation["start_time"] == "2026-11-02T10:00:00+00:00"

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
        "start_time": booking["end_time"], "end_time": "2026-11-02T13:00:00",
    }).status_code == 200
    assert client.delete(f"/reservations/{first['id']}").status_code == 200
    assert client.post("/reservations", json=booking).status_code == 200
