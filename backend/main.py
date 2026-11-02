from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import auth, parking_spots, reservations, users


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/")
def home():
    return {"message": "Parking Marketplace API is running"}


app.include_router(auth.router)
app.include_router(parking_spots.router)
app.include_router(reservations.router)
app.include_router(users.router)
