"""Deterministic route-test stand-in. PostgreSQL constraints have separate integration tests."""
from contextlib import contextmanager
from itertools import count
from threading import Lock

from backend.db.mapping import FIELDS, reservation_status
from backend.db.repository import CONFLICTS, Conflict


class MemoryRepository:
    def __init__(self):
        self.rows = {table: {} for table in FIELDS}
        self.ids = {table: count(1) for table in FIELDS}
        self.favorites = set()
        self.password_hashes = {}
        self.lock = Lock()

    @contextmanager
    def transaction(self):
        with self.lock:
            yield self

    def list(self, table, *, min_price=None, max_price=None, window=None, **filters):
        return [
            self.get(table, row["id"]) for row in self.rows[table].values()
            if all(row[key] == value for key, value in filters.items())
            and (min_price is None or row["price"] >= min_price)
            and (max_price is None or row["price"] <= max_price)
            and (window is None or not any(
                existing["status"] == "active" and existing["spot_id"] == row["id"]
                and window[0] < existing["end_time"] and window[1] > existing["start_time"]
                for existing in self.rows["reservations"].values()
            ))
        ]

    def get(self, table, record_id, *, lock=False):
        row = self.rows[table].get(record_id)
        if row is None:
            return None
        result = {key: value for key, value in row.items()
                  if key not in {"title", "parking_type", "photo_urls", "amenities"} or value}
        if table == "reservations":
            result["status"] = reservation_status(row)
        return result

    def credentials(self, email):
        for row in self.rows["users"].values():
            if row["email"].strip().casefold() == email.strip().casefold():
                return row.copy(), self.password_hashes.get(row["id"])
        return None, None

    def insert(self, table, record, *, password_hash=None, total_cost=None):
        if table == "users" and self.credentials(record["email"])[0] is not None:
            raise Conflict(CONFLICTS["23505", "users_email_key_unique"])
        if table == "reservations":
            for row in self.rows[table].values():
                if (row["status"] == "active" and row["spot_id"] == record["spot_id"]
                        and record["start_time"] < row["end_time"] and record["end_time"] > row["start_time"]):
                    raise Conflict(CONFLICTS["23P01", "reservations_no_overlap"])
        record_id = next(self.ids[table])
        row = {"id": record_id, **record}
        if table == "reservations":
            row.update(status="active", total_cost=total_cost)
        if table == "parking_spots":
            row = {key: value for key, value in row.items() if value is not None or key not in {"latitude", "longitude"}}
        self.rows[table][record_id] = row
        if password_hash is not None:
            self.password_hashes[record_id] = password_hash
        return self.get(table, record_id)

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
        if table == "parking_spots":
            self.favorites = {pair for pair in self.favorites if pair[1] != record_id}

    def saved_spots(self, user_id):
        return [self.get("parking_spots", spot_id) for owner_id, spot_id in sorted(self.favorites, reverse=True)
                if owner_id == user_id]

    def set_favorite(self, user_id, spot_id, saved):
        if saved:
            self.favorites.add((user_id, spot_id))
        else:
            self.favorites.discard((user_id, spot_id))

    def owner_reservations(self, owner_id):
        spot_ids = {spot["id"] for spot in self.list("parking_spots", owner_id=owner_id)}
        return [
            row | {"renter_name": self.rows["users"][row["user_id"]]["name"]}
            for row in self.list("reservations") if row["spot_id"] in spot_ids
        ]
