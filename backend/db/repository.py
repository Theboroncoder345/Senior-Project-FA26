"""PostgreSQL repository and transaction boundary for marketplace records."""
from contextlib import contextmanager
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from backend.db.config import DatabaseSettings
from backend.db.mapping import FIELDS, to_api, to_database
from backend.db.session import create_database_engine, create_session_factory, session_scope


class Conflict(Exception):
    """A recognized database constraint violation."""


CONFLICTS = {
    ("23505", "users_email_key_unique"): "Email already registered",
    ("23P01", "reservations_no_overlap"): "Parking spot is already reserved during that time",
    ("23503", "reservations_spot_id_fkey"): "Cannot delete a parking spot with reservations",
}


class PostgresRepository:
    def __init__(self, factory):
        self.factory = factory

    @contextmanager
    def transaction(self):
        try:
            with session_scope(self.factory) as session:
                yield Records(session)
        except IntegrityError as error:
            driver_error = error.orig
            detail = CONFLICTS.get((driver_error.sqlstate, driver_error.diag.constraint_name))
            if detail is None:
                raise
            raise Conflict(detail) from None


class Records:
    # Table and field names come from application code and the fixed mapping.
    # Every request value is bound separately.
    def __init__(self, session):
        self.session = session

    def _rows(self, sql, params):
        return self.session.execute(text(sql), params).mappings()

    def list(self, table, *, min_price=None, max_price=None, **filters):
        params = to_database(table, filters)
        conditions = [f"{column} = :{column}" for column in params]
        if min_price is not None:
            conditions.append("price_per_hour >= :min_price")
            params["min_price"] = min_price
        if max_price is not None:
            conditions.append("price_per_hour <= :max_price")
            params["max_price"] = max_price
        where = " AND ".join(conditions) or "TRUE"
        order = FIELDS[table]["id"]
        rows = self._rows(f"SELECT * FROM {table} WHERE {where} ORDER BY {order}", params)
        return [to_api(table, row) for row in rows]

    def get(self, table, record_id, *, lock=False):
        key = FIELDS[table]["id"]
        lock_clause = "FOR UPDATE" if lock else ""
        row = self._rows(
            f"SELECT * FROM {table} WHERE {key} = :id {lock_clause}", {"id": record_id}
        ).one_or_none()
        return to_api(table, row) if row is not None else None

    def credentials(self, email):
        row = self._rows(
            "SELECT * FROM users WHERE email_key = :email_key",
            {"email_key": email.strip().casefold()},
        ).one_or_none()
        return (to_api("users", row), row["password_hash"]) if row is not None else (None, None)

    def insert(self, table, record, **private_fields):
        params = to_database(table, record) | private_fields
        columns = ", ".join(params)
        values = ", ".join(f":{column}" for column in params)
        row = self._rows(f"INSERT INTO {table} ({columns}) VALUES ({values}) RETURNING *", params).one()
        return to_api(table, row)

    def update(self, table, record_id, record):
        params = to_database(table, record)
        assignments = ", ".join(f"{column} = :{column}" for column in params)
        key = FIELDS[table]["id"]
        row = self._rows(
            f"UPDATE {table} SET {assignments} WHERE {key} = :id RETURNING *",
            params | {"id": record_id},
        ).one()
        return to_api(table, row)

    def delete(self, table, record_id):
        key = FIELDS[table]["id"]
        self.session.execute(text(f"DELETE FROM {table} WHERE {key} = :id"), {"id": record_id})

    def owner_reservations(self, owner_id):
        rows = self._rows(
            """SELECT r.*, u.full_name AS renter_name FROM reservations r
               JOIN parking_spots s ON s.spot_id = r.spot_id
               JOIN users u ON u.user_id = r.user_id
               WHERE s.owner_id = :owner_id ORDER BY r.reservation_id""",
            {"owner_id": owner_id},
        )
        return [to_api("reservations", row) | {"renter_name": row["renter_name"]} for row in rows]


@lru_cache(maxsize=1)
def _repository(settings):
    return PostgresRepository(create_session_factory(create_database_engine(settings)))


def get_repository():
    return _repository(DatabaseSettings.from_env())


Repository = Annotated[PostgresRepository, Depends(get_repository)]
