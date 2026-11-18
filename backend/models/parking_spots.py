from pydantic import BaseModel, Field, field_validator, model_validator


class ParkingSpotCreate(BaseModel):
    address: str
    price: float = Field(ge=0, allow_inf_nan=False)
    description: str
    available: bool
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_coordinate_pair(self):
        if (
            ("latitude" in self.model_fields_set) != ("longitude" in self.model_fields_set)
            or (self.latitude is None) != (self.longitude is None)
        ):
            raise ValueError("Provide latitude and longitude together")
        return self

    @field_validator("address", "description")
    @classmethod
    def validate_non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Must not be blank")
        return value


class ParkingSpot(ParkingSpotCreate):
    owner_id: int = Field(gt=0)
