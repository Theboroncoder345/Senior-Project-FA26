from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from backend.db.repository import Repository
from backend.models.parking_spots import ParkingSpot, ParkingSpotCreate
from backend.routers.auth import current_user
from backend.validation import require_owner, require_record_owner


router = APIRouter()


def require_spot(spot):
    if spot is None:
        raise HTTPException(status_code=404, detail="Parking spot not found")
    return spot


@router.get("/parking-spots")
def get_parking_spots(
    repository: Repository,
    max_price: float | None = Query(default=None, ge=0, allow_inf_nan=False),
    available: bool | None = None,
    min_price: float | None = Query(default=None, ge=0, allow_inf_nan=False),
    owner_id: int | None = Query(default=None, gt=0),
):
    filters = {key: value for key, value in {"available": available, "owner_id": owner_id}.items()
               if value is not None}
    with repository.transaction() as records:
        return records.list("parking_spots", min_price=min_price, max_price=max_price, **filters)


@router.get("/parking-spots/{spot_id}")
def get_parking_spot(spot_id: Annotated[int, Path(gt=0)], repository: Repository):
    with repository.transaction() as records:
        return require_spot(records.get("parking_spots", spot_id))


@router.post("/parking-spots")
def create_parking_spot(
    spot: ParkingSpotCreate,
    user: Annotated[dict, Depends(current_user)],
    repository: Repository,
):
    require_owner(user)
    with repository.transaction() as records:
        return records.insert("parking_spots", spot.model_dump() | {"owner_id": user["id"]})


@router.put("/parking-spots/{spot_id}")
def update_parking_spot(
    spot_id: Annotated[int, Path(gt=0)],
    updated_spot: ParkingSpot,
    user: Annotated[dict, Depends(current_user)],
    repository: Repository,
):
    with repository.transaction() as records:
        spot = require_spot(records.get("parking_spots", spot_id, lock=True))
        require_record_owner(spot, user, "owner_id")
        if updated_spot.owner_id != spot["owner_id"]:
            raise HTTPException(status_code=403, detail="Cannot change parking spot owner")
        return records.update("parking_spots", spot_id, updated_spot.model_dump(exclude={"owner_id"}))


@router.delete("/parking-spots/{spot_id}")
def delete_parking_spot(
    spot_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
    repository: Repository,
):
    with repository.transaction() as records:
        spot = require_spot(records.get("parking_spots", spot_id, lock=True))
        require_record_owner(spot, user, "owner_id")
        records.delete("parking_spots", spot_id)
    return {"message": "Parking spot deleted"}


@router.get("/owners/me/parking-spots")
def get_my_parking_spots(user: Annotated[dict, Depends(current_user)], repository: Repository):
    require_owner(user)
    with repository.transaction() as records:
        return records.list("parking_spots", owner_id=user["id"])
