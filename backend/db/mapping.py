"""Explicit boundary between SQL column names and existing API dictionaries.

Database-only metadata never leaks into API responses. No billing calculation is
introduced; total_cost remains nullable until a billing policy is agreed.
"""
from datetime import timezone

FIELDS = {
    "users": {"id": "user_id", "name": "full_name", "email": "email", "is_owner": "is_owner"},
    "parking_spots": {"id": "spot_id", "owner_id": "owner_id", "address": "address",
                      "price": "price_per_hour", "description": "description", "available": "is_available"},
    "reservations": {"id": "reservation_id", "spot_id": "spot_id", "user_id": "user_id",
                     "start_time": "start_time", "end_time": "end_time"},
}


def as_utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def to_database(table, record):
    result = {column: record[field] for field, column in FIELDS[table].items() if field in record}
    if table == "users" and "email" in record:
        result["email_key"] = record["email"].strip().casefold()
    if table == "reservations":
        for field in ("start_time", "end_time"):
            if field in result:
                result[field] = as_utc(result[field])
    return result


def to_api(table, row):
    return {field: row[column] for field, column in FIELDS[table].items()}
