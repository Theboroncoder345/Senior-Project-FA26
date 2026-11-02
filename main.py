from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI()


class ParkingSpot(BaseModel):
    address: str
    price: float
    description: str
    available: bool
    owner_id: int


class Reservation(BaseModel):
    spot_id: int
    user_id: int
    start_time: datetime
    end_time: datetime

class User(BaseModel):
    name: str
    email: str
    is_owner: bool


parking_spots = [
    {
        "id": 1,
        "address": "123 Main Street",
        "price": 20,
        "description": "Driveway parking near venue",
        "available": True,
        "owner_id": 1
    },
    {
        "id": 2,
        "address": "45 Ocean Avenue",
        "price": 30,
        "description": "Private parking spot",
        "available": True,
        "owner_id": 2
    }
]


reservations = []
users = []


@app.get("/")
def home():
    return {"message": "Parking Marketplace API is running"}


@app.get("/parking-spots")
def get_parking_spots(
    max_price: float | None = None,
    available: bool | None = None
):
    results = parking_spots

    if max_price is not None:
        results = [
            spot for spot in results
            if spot["price"] <= max_price
        ]

    if available is not None:
        results = [
            spot for spot in results
            if spot["available"] == available
        ]

    return results


@app.get("/parking-spots/{spot_id}")
def get_parking_spot(spot_id: int):
    for spot in parking_spots:
        if spot["id"] == spot_id:
            return spot

    raise HTTPException(
        status_code=404,
        detail="Parking spot not found"
    )


@app.post("/parking-spots")
def create_parking_spot(spot: ParkingSpot):

    owner = None

    for user in users:
        if user["id"] == spot.owner_id:
            owner = user
            break

    if owner is None:
        raise HTTPException(
            status_code=404,
            detail="Owner not found"
        )

    if not owner["is_owner"]:
        raise HTTPException(
            status_code=403,
            detail="User is not registered as a parking owner"
        )

    new_spot = {
        "id": len(parking_spots) + 1,
        "address": spot.address,
        "price": spot.price,
        "description": spot.description,
        "available": spot.available,
        "owner_id": spot.owner_id
    }

    parking_spots.append(new_spot)

    return new_spot


@app.put("/parking-spots/{spot_id}")
def update_parking_spot(spot_id: int, updated_spot: ParkingSpot):
    for spot in parking_spots:
        if spot["id"] == spot_id:
            spot["address"] = updated_spot.address
            spot["price"] = updated_spot.price
            spot["description"] = updated_spot.description
            spot["available"] = updated_spot.available
            spot["owner_id"] = updated_spot.owner_id

            return spot

    raise HTTPException(
        status_code=404,
        detail="Parking spot not found"
    )


@app.delete("/parking-spots/{spot_id}")
def delete_parking_spot(spot_id: int):
    for spot in parking_spots:
        if spot["id"] == spot_id:
            parking_spots.remove(spot)

            return {"message": "Parking spot deleted"}

    raise HTTPException(
        status_code=404,
        detail="Parking spot not found"
    )


@app.get("/reservations")
def get_reservations():
    return reservations


@app.post("/reservations")
def create_reservation(reservation: Reservation):

    # Check that parking spot exists
    spot_exists = False

    for spot in parking_spots:
        if spot["id"] == reservation.spot_id:
            spot_exists = True
            break

    if not spot_exists:
        raise HTTPException(
            status_code=404,
            detail="Parking spot not found"
        )

    # Check that user exists
    user_exists = False

    for user in users:
        if user["id"] == reservation.user_id:
            user_exists = True
            break

    if not user_exists:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Make sure end time is after start time
    if reservation.start_time >= reservation.end_time:
        raise HTTPException(
            status_code=400,
            detail="End time must be after start time"
        )

    # Prevent double-booking
    for existing in reservations:
        if existing["spot_id"] == reservation.spot_id:

            overlap = (
                reservation.start_time < existing["end_time"]
                and reservation.end_time > existing["start_time"]
            )

            if overlap:
                raise HTTPException(
                    status_code=409,
                    detail="Parking spot is already reserved during that time"
                )

    new_reservation = {
        "id": len(reservations) + 1,
        "spot_id": reservation.spot_id,
        "user_id": reservation.user_id,
        "start_time": reservation.start_time,
        "end_time": reservation.end_time
    }

    reservations.append(new_reservation)

    return new_reservation

@app.get("/users")
def get_users():
    return users


@app.post("/users")
def create_user(user: User):
    new_user = {
        "id": len(users) + 1,
        "name": user.name,
        "email": user.email,
        "is_owner": user.is_owner
    }

    users.append(new_user)

    return new_user

@app.get("/users/{user_id}/reservations")
def get_user_reservations(user_id: int):

    user_exists = False

    for user in users:
        if user["id"] == user_id:
            user_exists = True
            break

    if not user_exists:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    user_reservations = [
        reservation for reservation in reservations
        if reservation["user_id"] == user_id
    ]

    return user_reservations