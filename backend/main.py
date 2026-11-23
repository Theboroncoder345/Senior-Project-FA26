import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.db.config import DatabaseSettings
from backend.db.repository import Conflict, get_repository
from backend import photos
from backend.routers import auth, favorites, parking_spots, reservations, users


@asynccontextmanager
async def lifespan(application: FastAPI):
    if get_repository not in application.dependency_overrides:
        DatabaseSettings.from_env()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip() for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",") if origin.strip()
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(RequestValidationError)
def handle_validation_error(request: Request, error: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": [
        {key: item[key] for key in ("loc", "msg", "type")} for item in error.errors()
    ]})


@app.exception_handler(Conflict)
def handle_conflict(request: Request, error: Conflict):
    return JSONResponse(status_code=409, content={"detail": str(error)})


@app.get("/")
def home():
    return {"message": "Parking Marketplace API is running"}


app.include_router(auth.router)
app.include_router(favorites.router)
app.include_router(photos.router)
photos.PHOTO_DIRECTORY.mkdir(parents=True, exist_ok=True)
app.mount(photos.PHOTO_PREFIX.rstrip("/"), photos.ListingPhotoFiles(directory=photos.PHOTO_DIRECTORY), name="listing-photos")
app.include_router(parking_spots.router)
app.include_router(reservations.router)
app.include_router(users.router)
