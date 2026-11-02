from fastapi import HTTPException


def require_owner(users, owner_id):
    owner = next((user for user in users if user["id"] == owner_id), None)
    if owner is None:
        raise HTTPException(status_code=404, detail="Owner not found")
    if not owner["is_owner"]:
        raise HTTPException(
            status_code=403,
            detail="User is not registered as a parking owner",
        )
    return owner


def require_record_owner(record, user, owner_field):
    if record[owner_field] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this resource")
