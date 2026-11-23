from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path

from backend.db.mapping import as_utc
from backend.db.repository import Repository
from backend.models.reservations import ReservationCreate
from backend.routers.auth import current_user
from backend.routers.parking_spots import require_spot
from backend.validation import require_owner, require_record_owner


router = APIRouter()


def require_reservation(reservation):
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return reservation


def reservation_cost(start, end, hourly_price):
    duration = end - start
    seconds = Decimal(duration.days * 86400 + duration.seconds)
    seconds += Decimal(duration.microseconds).scaleb(-6)
    with localcontext() as context:
        context.prec = 40
        cost = seconds * Decimal(str(hourly_price)) / 3600
        if cost >= Decimal("99999999.995"):
            raise HTTPException(status_code=422, detail="Reservation total exceeds the supported amount")
        return cost.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@router.get("/reservations")
@router.get("/users/me/reservations")
def get_reservations(user: Annotated[dict, Depends(current_user)], repository: Repository):
    with repository.transaction() as records:
        return records.list("reservations", user_id=user["id"])


@router.get("/reservations/{reservation_id}")
def get_reservation(
    reservation_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
    repository: Repository,
):
    with repository.transaction() as records:
        reservation = require_reservation(records.get("reservations", reservation_id))
        if reservation["user_id"] != user["id"]:
            spot = records.get("parking_spots", reservation["spot_id"])
            if spot is None or spot["owner_id"] != user["id"] or not user["is_owner"]:
                raise HTTPException(status_code=403, detail="Not authorized to access this resource")
        return reservation


@router.delete("/reservations/{reservation_id}")
def delete_reservation(
    reservation_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
    repository: Repository,
):
    with repository.transaction() as records:
        reservation = require_reservation(records.get("reservations", reservation_id, lock=True))
        require_record_owner(reservation, user, "user_id")
        if reservation["status"] == "completed":
            raise HTTPException(409, "Completed reservations cannot be cancelled")
        if reservation["status"] == "active":
            records.update("reservations", reservation_id, {"status": "cancelled"})
    return {"message": "Reservation cancelled"}


@router.post("/reservations")
def create_reservation(
    reservation: ReservationCreate,
    user: Annotated[dict, Depends(current_user)],
    repository: Repository,
):
    start = as_utc(reservation.start_time)
    end = as_utc(reservation.end_time)
    with repository.transaction() as records:
        # Serialize writes for this listing so the price and availability stay
        # stable through insertion. The exclusion constraint decides overlaps.
        spot = require_spot(records.get("parking_spots", reservation.spot_id, lock=True))
        if not spot["available"]:
            raise HTTPException(status_code=409, detail="Parking spot is not available")
        return records.insert(
            "reservations",
            {"spot_id": spot["id"], "user_id": user["id"], "start_time": start, "end_time": end},
            total_cost=reservation_cost(start, end, spot["price"]),
        )


@router.get("/users/{user_id}/reservations")
def get_user_reservations(
    user_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
    repository: Repository,
):
    with repository.transaction() as records:
        target = records.get("users", user_id)
        if target is None:
            raise HTTPException(status_code=404, detail="User not found")
        require_record_owner(target, user, "id")
        return records.list("reservations", user_id=user_id)


@router.get("/owners/{owner_id}/reservations")
def get_owner_reservations(
    owner_id: Annotated[int, Path(gt=0)],
    user: Annotated[dict, Depends(current_user)],
    repository: Repository,
):
    with repository.transaction() as records:
        owner = require_owner(records.get("users", owner_id))
        require_record_owner(owner, user, "id")
        return records.owner_reservations(owner_id)
