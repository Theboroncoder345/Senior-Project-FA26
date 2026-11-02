from pydantic import BaseModel, Field, field_validator


class ParkingSpotCreate(BaseModel):
    address: str
    price: float = Field(ge=0, allow_inf_nan=False)
    description: str
    available: bool

    @field_validator("address", "description")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Must not be blank")
        return value


class ParkingSpot(ParkingSpotCreate):
    owner_id: int = Field(gt=0)
