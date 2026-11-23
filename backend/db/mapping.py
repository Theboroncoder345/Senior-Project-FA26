"""Map database rows to the public API fields, excluding private metadata."""
from datetime import datetime, timezone


FIELDS = {
    "users": {"id": "user_id", "name": "full_name", "email": "email", "is_owner": "is_owner"},
    "parking_spots": {"id": "spot_id", "owner_id": "owner_id", "address": "address",
                      "price": "price_per_hour", "description": "description", "available": "is_available",
                      "latitude": "latitude", "longitude": "longitude", "title": "title",
                      "parking_type": "parking_type", "photo_urls": "photo_urls", "amenities": "amenities"},
    "reservations": {"id": "reservation_id", "spot_id": "spot_id", "user_id": "user_id",
                     "start_time": "start_time", "end_time": "end_time", "status": "status"},
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
    result = {field: row[column] for field, column in FIELDS[table].items()
              if field not in ("latitude", "longitude", "title", "parking_type", "photo_urls", "amenities")
              or row.get(column) is not None}
    if table == "users" and row.get("created_at") is not None:
        result["created_at"] = row["created_at"]
    if table == "parking_spots":
        result = {key: value for key, value in result.items()
                  if key not in ("title", "parking_type", "photo_urls", "amenities") or value}
    if table == "reservations":
        result["status"] = reservation_status(row)
        result["total_cost"] = row["total_cost"]
    return result


def reservation_status(row):
    if row["status"] == "active" and row["end_time"] <= datetime.now(timezone.utc):
        return "completed"
    return row["status"]
