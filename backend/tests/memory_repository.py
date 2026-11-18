"""Deterministic route-test stand-in. PostgreSQL constraints have separate integration tests."""
from contextlib import contextmanager
from itertools import count
from threading import Lock

from backend.db.mapping import FIELDS
from backend.db.repository import CONFLICTS, Conflict


class MemoryRepository:
    def __init__(self):
        self.rows = {table: {} for table in FIELDS}
        self.ids = {table: count(1) for table in FIELDS}
        self.password_hashes = {}
        self.lock = Lock()

    @contextmanager
    def transaction(self):
        with self.lock:
            yield self

    def list(self, table, *, min_price=None, max_price=None, **filters):
        return [
            row.copy() for row in self.rows[table].values()
            if all(row[key] == value for key, value in filters.items())
            and (min_price is None or row["price"] >= min_price)
            and (max_price is None or row["price"] <= max_price)
        ]

    def get(self, table, record_id, *, lock=False):
        row = self.rows[table].get(record_id)
        return row.copy() if row is not None else None

    def credentials(self, email):
        for row in self.rows["users"].values():
            if row["email"].strip().casefold() == email.strip().casefold():
                return row.copy(), self.password_hashes.get(row["id"])
        return None, None

    def insert(self, table, record, *, password_hash=None, total_cost=None):
        if table == "users" and self.credentials(record["email"])[0] is not None:
            raise Conflict(CONFLICTS["23505", "users_email_key_unique"])
        if table == "reservations":
            for row in self.list(table, spot_id=record["spot_id"]):
                if record["start_time"] < row["end_time"] and record["end_time"] > row["start_time"]:
                    raise Conflict(CONFLICTS["23P01", "reservations_no_overlap"])
        record_id = next(self.ids[table])
        row = {"id": record_id, **record}
        if table == "reservations":
            row["total_cost"] = total_cost
        if table == "parking_spots":
            row = {key: value for key, value in row.items() if value is not None}
        self.rows[table][record_id] = row
        if password_hash is not None:
            self.password_hashes[record_id] = password_hash
        return row.copy()

    def update(self, table, record_id, record):
        row = self.rows[table][record_id]
        row.update(record)
        if table == "parking_spots" and row.get("latitude") is None:
            row.pop("latitude", None)
            row.pop("longitude", None)
        return self.get(table, record_id)

    def delete(self, table, record_id):
        if table == "parking_spots" and self.list("reservations", spot_id=record_id):
            raise Conflict(CONFLICTS["23503", "reservations_spot_id_fkey"])
        del self.rows[table][record_id]

    def owner_reservations(self, owner_id):
        spot_ids = {spot["id"] for spot in self.list("parking_spots", owner_id=owner_id)}
        return [
            row | {"renter_name": self.rows["users"][row["user_id"]]["name"]}
            for row in self.list("reservations") if row["spot_id"] in spot_ids
        ]
