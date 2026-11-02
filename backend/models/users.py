from pydantic import BaseModel, Field, field_validator


class User(BaseModel):
    name: str
    email: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    is_owner: bool

    @field_validator("name", "email", mode="before")
    @classmethod
    def strip_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("Must not be blank")
        return value
