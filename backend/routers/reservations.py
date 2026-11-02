from typing import Annotated
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Path

from backend.models.reservations import ReservationCreate
from backend.routers.auth import current_user
from backend.store import parking_spots, reservations, reservation_ids, users, mutation_lock
from backend.validation import require_owner, require_record_owner


router = APIRouter()


def as_utc(value):
    # Existing naive timestamps are interpreted as UTC for overlap checks.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.get("/reservations")
def get_reservations(user: Annotated[dict, Depends(current_user)]):
    return [reservation for reservation in reservations if reservation["user_id"] == user["id"]]


@router.get("/reservations/{reservation_id}")
def get_reservation(
    reservation_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
):
    with mutation_lock:
        for reservation in reservations:
            if reservation["id"] == reservation_id:
                if reservation["user_id"] != user["id"]:
                    spot = next((spot for spot in parking_spots
                                 if spot["id"] == reservation["spot_id"]), None)
                    if spot is None or spot["owner_id"] != user["id"] or not user["is_owner"]:
                        raise HTTPException(status_code=403, detail="Not authorized to access this resource")
                return reservation
        raise HTTPException(status_code=404, detail="Reservation not found")


@router.delete("/reservations/{reservation_id}")
def delete_reservation(
    reservation_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
):
    with mutation_lock:
        for reservation in reservations:
            if reservation["id"] == reservation_id:
                require_record_owner(reservation, user, "user_id")
                reservations.remove(reservation)
                return {"message": "Reservation deleted"}
        raise HTTPException(status_code=404, detail="Reservation not found")


@router.post("/reservations")
def create_reservation(
    reservation: ReservationCreate,
    user: Annotated[dict, Depends(current_user)],
):

    with mutation_lock:
        spot = next((spot for spot in parking_spots if spot["id"] == reservation.spot_id), None)
        if spot is None:
            raise HTTPException(status_code=404, detail="Parking spot not found")
        if not spot["available"]:
            raise HTTPException(status_code=409, detail="Parking spot is not available")

        # Prevent double-booking
        for existing in reservations:
            if existing["spot_id"] == reservation.spot_id:

                overlap = (
                    as_utc(reservation.start_time) < as_utc(existing["end_time"])
                    and as_utc(reservation.end_time) > as_utc(existing["start_time"])
                )

                if overlap:
                    raise HTTPException(
                        status_code=409,
                        detail="Parking spot is already reserved during that time"
                    )

        new_reservation = {
            "id": next(reservation_ids),
            "spot_id": reservation.spot_id,
            "user_id": user["id"],
            "start_time": reservation.start_time,
            "end_time": reservation.end_time
        }

        reservations.append(new_reservation)

        return new_reservation


# Register the literal /me route before the integer /{user_id} route.
@router.get("/users/me/reservations")
def get_my_reservations(user: Annotated[dict, Depends(current_user)]):
    return [reservation for reservation in reservations if reservation["user_id"] == user["id"]]


@router.get("/users/{user_id}/reservations")
def get_user_reservations(
    user_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
):
    target = next((target for target in users if target["id"] == user_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    require_record_owner(target, user, "id")
    return [reservation for reservation in reservations if reservation["user_id"] == user_id]


@router.get("/owners/{owner_id}/reservations")
def get_owner_reservations(
    owner_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
):
    owner = require_owner(users, owner_id)
    require_record_owner(owner, user, "id")
    owner_spot_ids = {spot["id"] for spot in parking_spots if spot["owner_id"] == owner_id}
    return [reservation for reservation in reservations if reservation["spot_id"] in owner_spot_ids]
