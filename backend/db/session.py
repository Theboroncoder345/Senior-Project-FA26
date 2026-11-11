"""Explicit engine/session factories. Importing this module opens no connections."""
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from backend.db.config import DatabaseSettings


def create_database_engine(settings: DatabaseSettings | None = None):
    settings = settings or DatabaseSettings.from_env()
    return create_engine(settings.url, pool_pre_ping=True,
                         connect_args={"connect_timeout": 5, "options": "-c timezone=UTC"})


def create_session_factory(engine):
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


@contextmanager
def session_scope(factory):
    # Commits on success, rolls back on any error, always closes the session.
    with factory.begin() as session:
        yield session


def check_connection(engine):
    with engine.connect() as connection:
        return connection.scalar(text("SELECT 1")) == 1


if __name__ == "__main__":
    engine = create_database_engine()
    try:
        if not check_connection(engine):
            raise RuntimeError("PostgreSQL connectivity check failed")
        print("PostgreSQL connection verified; API routes still use in-memory storage.")
    finally:
        engine.dispose()
