from threading import Lock
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.models.auth import LoginRequest, LoginResponse, PublicUser, RegistrationRequest
from backend.db.repository import Repository
from backend import security


router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)
sessions = {}
session_lock = Lock()


def invalid_credentials():
    return HTTPException(
        status_code=401,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/register", status_code=201, response_model=PublicUser)
def register(payload: RegistrationRequest, repository: Repository):
    password_hash = security.hash_password(payload.password.get_secret_value())
    with repository.transaction() as records:
        return records.insert(
            "users", payload.model_dump(exclude={"password"}), password_hash=password_hash,
        )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, repository: Repository):
    with repository.transaction() as records:
        user, password_hash = records.credentials(payload.email)

    valid = security.verify_password(
        payload.password.get_secret_value(),
        password_hash or security.DUMMY_PASSWORD_HASH,
    )
    if not valid or password_hash is None:
        raise invalid_credentials()

    with session_lock:
        token = security.create_session(sessions, user["id"])
    response.headers["Cache-Control"] = "no-store"
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": security.SESSION_TTL_SECONDS,
        "user": user,
    }


@router.get("/me", response_model=PublicUser)
def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    repository: Repository,
):
    unauthorized = HTTPException(
        status_code=401,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    with session_lock:
        digest = security.token_digest(credentials.credentials)
        session = sessions.get(digest)
        if session is None:
            raise unauthorized
        if session["expires_at"] <= security.time():
            sessions.pop(digest)
            raise unauthorized
    with repository.transaction() as records:
        user = records.get("users", session["user_id"])
    if user is None:
        raise unauthorized
    return user
