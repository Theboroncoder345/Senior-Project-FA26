from typing import Annotated

from pydantic import BaseModel, Field, HttpUrl, StringConstraints, TypeAdapter, field_validator, model_validator


photo_url = TypeAdapter(HttpUrl)


class ParkingSpotCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
    parking_type: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)] | None = None
    photo_urls: list[Annotated[str, StringConstraints(max_length=2048)]] = Field(default_factory=list, max_length=5)
    address: str
    price: float = Field(ge=0, allow_inf_nan=False)
    description: str
    available: bool
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)

    @field_validator("photo_urls")
    @classmethod
    def validate_photos(cls, urls):
        validated = []
        for url in urls:
            parsed = photo_url.validate_python(url)
            if parsed.scheme != "https" or parsed.username is not None or parsed.password is not None:
                raise ValueError("Photo URLs must use HTTPS without credentials")
            validated.append(str(parsed))
        return validated

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


class ParkingAvailability(BaseModel):
    available: bool
