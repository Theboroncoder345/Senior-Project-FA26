from fastapi import APIRouter

from backend.db.repository import Repository
from backend.models.users import User


router = APIRouter()


@router.get("/users")
def get_users(repository: Repository):
    with repository.transaction() as records:
        return records.list("users")


@router.post("/users")
def create_user(user: User, repository: Repository):
    with repository.transaction() as records:
        return records.insert("users", user.model_dump())
