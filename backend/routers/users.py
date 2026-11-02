from fastapi import APIRouter, HTTPException

from backend.models.users import User
from backend.store import users, user_ids, mutation_lock


router = APIRouter()


@router.get("/users")
def get_users():
    return users


@router.post("/users")
def create_user(user: User):
    with mutation_lock:
        for existing_user in users:
            if existing_user["email"].strip().casefold() == user.email.casefold():
                raise HTTPException(
                    status_code=409,
                    detail="Email already registered"
                )

        new_user = {
            "id": next(user_ids),
            "name": user.name,
            "email": user.email,
            "is_owner": user.is_owner
        }

        users.append(new_user)

        return new_user
