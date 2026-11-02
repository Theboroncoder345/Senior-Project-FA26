from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Path, Query

from backend.models.parking_spots import ParkingSpot, ParkingSpotCreate
from backend.routers.auth import current_user
from backend.store import parking_spots, parking_spot_ids, users, reservations, mutation_lock
from backend.validation import require_owner, require_record_owner


router = APIRouter()


@router.get("/parking-spots")
def get_parking_spots(
    max_price: float | None = Query(default=None, ge=0, allow_inf_nan=False),
    available: bool | None = None,
    min_price: float | None = Query(default=None, ge=0, allow_inf_nan=False),
    owner_id: int | None = Query(default=None, gt=0)
):
    results = parking_spots

    if min_price is not None:
        results = [
            spot for spot in results
            if spot["price"] >= min_price
        ]

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

    if owner_id is not None:
        results = [
            spot for spot in results
            if spot["owner_id"] == owner_id
        ]

    return results


@router.get("/parking-spots/{spot_id}")
def get_parking_spot(spot_id: Annotated[int, Path(gt=0)]):
    for spot in parking_spots:
        if spot["id"] == spot_id:
            return spot

    raise HTTPException(
        status_code=404,
        detail="Parking spot not found"
    )


@router.post("/parking-spots")
def create_parking_spot(
    spot: ParkingSpotCreate,
    user: Annotated[dict, Depends(current_user)],
):

    with mutation_lock:
        require_owner(users, user["id"])

        new_spot = {
            "id": next(parking_spot_ids),
            "address": spot.address,
            "price": spot.price,
            "description": spot.description,
            "available": spot.available,
            "owner_id": user["id"]
        }

        parking_spots.append(new_spot)

        return new_spot


@router.put("/parking-spots/{spot_id}")
def update_parking_spot(
    spot_id: Annotated[int, Path(gt=0)],
    updated_spot: ParkingSpot,
    user: Annotated[dict, Depends(current_user)],
):
    with mutation_lock:
        for spot in parking_spots:
            if spot["id"] == spot_id:
                require_record_owner(spot, user, "owner_id")
                # Updating a listing cannot transfer it to a different account.
                if updated_spot.owner_id != spot["owner_id"]:
                    raise HTTPException(status_code=403, detail="Cannot change parking spot owner")
                spot.update(updated_spot.model_dump())
                return spot
        raise HTTPException(status_code=404, detail="Parking spot not found")


@router.delete("/parking-spots/{spot_id}")
def delete_parking_spot(
    spot_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
):
    with mutation_lock:
        for spot in parking_spots:
            if spot["id"] == spot_id:
                require_record_owner(spot, user, "owner_id")
                if any(reservation["spot_id"] == spot_id for reservation in reservations):
                    raise HTTPException(
                        status_code=409,
                        detail="Cannot delete a parking spot with reservations",
                    )
                parking_spots.remove(spot)
                return {"message": "Parking spot deleted"}
        raise HTTPException(status_code=404, detail="Parking spot not found")


@router.get("/owners/me/parking-spots")
def get_my_parking_spots(user: Annotated[dict, Depends(current_user)]):
    with mutation_lock:
        require_owner(users, user["id"])
        return [spot for spot in parking_spots if spot["owner_id"] == user["id"]]
