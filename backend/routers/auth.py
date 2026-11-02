from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.models.auth import LoginRequest, LoginResponse, PublicUser, RegistrationRequest
from backend.models.users import User
from backend.routers import users as user_routes
from backend import security
from backend.store import mutation_lock, password_hashes, sessions


router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


def invalid_credentials():
    return HTTPException(
        status_code=401,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/register", status_code=201, response_model=PublicUser)
def register(payload: RegistrationRequest):
    # Hash outside the lock; user creation rechecks duplicates atomically.
    password_hash = security.hash_password(payload.password.get_secret_value())
    with mutation_lock:
        user = user_routes.create_user(User(
            name=payload.name, email=payload.email, is_owner=payload.is_owner,
        ))
        password_hashes[user["id"]] = password_hash
        return user


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response):
    with mutation_lock:
        user = next((user for user in user_routes.users
                     if user["email"].strip().casefold() == payload.email.casefold()), None)
        password_hash = password_hashes.get(user["id"]) if user is not None else None

    valid = security.verify_password(
        payload.password.get_secret_value(),
        password_hash or security.DUMMY_PASSWORD_HASH,
    )
    if not valid or password_hash is None:
        raise invalid_credentials()

    with mutation_lock:
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
):
    unauthorized = HTTPException(
        status_code=401,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    with mutation_lock:
        digest = security.token_digest(credentials.credentials)
        session = sessions.get(digest)
        if session is None:
            raise unauthorized
        if session["expires_at"] <= security.time():
            sessions.pop(digest)
            raise unauthorized
        user = next((user for user in user_routes.users
                     if user["id"] == session["user_id"]), None)
        if user is None:
            raise unauthorized
        return user
