"""Read configuration only when explicitly requested; never embed credentials."""
import os
from dataclasses import dataclass, field

from sqlalchemy.engine import make_url


@dataclass(frozen=True)
class DatabaseSettings:
    url: str = field(repr=False)

    @classmethod
    def from_env(cls):
        value = os.environ.get("DATABASE_URL", "")
        if not value:
            raise ValueError("DATABASE_URL is required for PostgreSQL connectivity")
        try:
            url = make_url(value)
        except Exception:
            raise ValueError("DATABASE_URL must be a valid PostgreSQL URL") from None
        if url.drivername != "postgresql+psycopg" or not url.database or not url.host:
            raise ValueError("DATABASE_URL must use postgresql+psycopg with host and database")
        return cls(value)
