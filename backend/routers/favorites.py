from typing import Annotated

from fastapi import APIRouter, Depends, Path

from backend.db.repository import Repository
from backend.routers.auth import current_user
from backend.routers.parking_spots import require_spot

router = APIRouter(prefix="/users/me/favorites")
User = Annotated[dict, Depends(current_user)]
SpotID = Annotated[int, Path(gt=0)]


@router.get("")
def saved_spots(user: User, repository: Repository):
    with repository.transaction() as records:
        return records.saved_spots(user["id"])


@router.put("/{spot_id}")
def save_spot(spot_id: SpotID, user: User, repository: Repository):
    with repository.transaction() as records:
        require_spot(records.get("parking_spots", spot_id, lock=True))
        records.set_favorite(user["id"], spot_id, True)
    return {"saved": True}


@router.delete("/{spot_id}")
def remove_spot(spot_id: SpotID, user: User, repository: Repository):
    with repository.transaction() as records:
        records.set_favorite(user["id"], spot_id, False)
    return {"saved": False}
