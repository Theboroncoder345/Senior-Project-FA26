from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.db.repository import Conflict
from backend.routers import auth, parking_spots, reservations, users


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(Conflict)
def handle_conflict(request: Request, error: Conflict):
    return JSONResponse(status_code=409, content={"detail": str(error)})


@app.get("/")
def home():
    return {"message": "Parking Marketplace API is running"}


app.include_router(auth.router)
app.include_router(parking_spots.router)
app.include_router(reservations.router)
app.include_router(users.router)
