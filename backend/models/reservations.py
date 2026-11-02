from datetime import datetime

from pydantic import BaseModel, Field, ValidationInfo, field_validator


class ReservationCreate(BaseModel):
    spot_id: int = Field(gt=0)
    start_time: datetime
    end_time: datetime

    @field_validator("end_time")
    @classmethod
    def validate_end_time(cls, value: datetime, info: ValidationInfo) -> datetime:
        start_time = info.data.get("start_time")
        if start_time is not None:
            try:
                valid = value > start_time
            except TypeError:
                raise ValueError("Start and end times must use compatible timezones")
            if not valid:
                raise ValueError("End time must be after start time")
        return value


class Reservation(ReservationCreate):
    user_id: int = Field(gt=0)
