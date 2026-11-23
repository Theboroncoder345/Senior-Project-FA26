from typing import Annotated, Literal

from pydantic import BaseModel, Field, HttpUrl, StringConstraints, TypeAdapter, field_validator, model_validator


from backend.photos import PHOTO_PATH

Amenity = Literal["Covered", "EV Charging", "Overnight Parking", "Security Camera",
                  "Accessible Parking", "Large Vehicle Friendly", "24/7 Access"]

photo_url = TypeAdapter(HttpUrl)
DEMO_PHOTO = "/demo-assets/driveway.jpg"


class ParkingSpotCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
    parking_type: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)] | None = None
    photo_urls: list[Annotated[str, StringConstraints(max_length=2048)]] = Field(default_factory=list, max_length=5)
    amenities: list[Amenity] = Field(default_factory=list, max_length=7)
    address: Annotated[str, StringConstraints(max_length=250)]
    price: float = Field(ge=0, allow_inf_nan=False)
    description: Annotated[str, StringConstraints(max_length=2000)]
    available: bool
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)

    @field_validator("photo_urls")
    @classmethod
    def validate_photos(cls, urls):
        validated = []
        for url in urls:
            if url == DEMO_PHOTO or PHOTO_PATH.fullmatch(url):
                validated.append(url)
                continue
            parsed = photo_url.validate_python(url)
            if parsed.scheme != "https" or parsed.username is not None or parsed.password is not None:
                raise ValueError("Photo URLs must use HTTPS without credentials")
            validated.append(str(parsed))
        return validated

    @field_validator("amenities")
    @classmethod
    def deduplicate_amenities(cls, values):
        return list(dict.fromkeys(values))

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
