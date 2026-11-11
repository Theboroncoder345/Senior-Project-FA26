"""Database preparation tests: no external PostgreSQL service required."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, text

from backend.db.config import DatabaseSettings
from backend.db.mapping import to_api, to_database
from backend.db.session import create_database_engine, create_session_factory, session_scope


def test_config_requires_explicit_url(monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)
    with pytest.raises(ValueError, match='required'):
        DatabaseSettings.from_env()


@pytest.mark.parametrize('url', ['garbage', 'sqlite://', 'postgresql://u:p@host/db',
                                  'postgresql+psycopg://u:p@host'])
def test_config_rejects_invalid_urls_without_credentials_in_error(monkeypatch, url):
    monkeypatch.setenv('DATABASE_URL', url)
    with pytest.raises(ValueError) as error:
        DatabaseSettings.from_env()
    assert url not in str(error.value)


def test_config_and_engine_are_lazy(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql+psycopg://user:secret@unreachable.invalid/db')
    settings = DatabaseSettings.from_env()
    assert 'secret' not in repr(settings)
    engine = create_database_engine(settings)
    assert engine.dialect.name == 'postgresql'
    assert engine.dialect.driver == 'psycopg'
    engine.dispose()


@pytest.mark.parametrize(('table', 'api', 'db'), [
    ('users', {'id': 7, 'name': 'Owner', 'email': 'o@example.com', 'is_owner': True},
     {'user_id': 7, 'full_name': 'Owner', 'email': 'o@example.com', 'is_owner': True}),
    ('parking_spots', {'id': 8, 'owner_id': 7, 'address': 'Street', 'price': 1.234,
                       'description': 'Driveway', 'available': False},
     {'spot_id': 8, 'owner_id': 7, 'address': 'Street', 'price_per_hour': 1.234,
      'description': 'Driveway', 'is_available': False}),
])
def test_mapping_preserves_contract_and_excludes_private_metadata(table, api, db):
    expected = {**db, "email_key": api["email"].strip().casefold()} if table == "users" else db
    assert to_database(table, api) == expected
    assert to_api(table, {**db, 'password_hash': 'private', 'created_at': None,
                          'phone': 'private', 'latitude': None, 'longitude': None}) == api


def test_reservation_mapping_normalizes_naive_and_offset_times():
    api = {'id': 1, 'spot_id': 2, 'user_id': 3,
           'start_time': datetime(2026, 1, 1, 10),
           'end_time': datetime(2026, 1, 1, 8, tzinfo=timezone(timedelta(hours=-5)))}
    row = to_database('reservations', api)
    assert row['reservation_id'] == 1
    assert row['start_time'] == datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
    assert row['end_time'] == datetime(2026, 1, 1, 13, tzinfo=timezone.utc)
    result = to_api('reservations', {**row, 'total_cost': 10})
    assert set(result) == set(api)
    assert 'total_cost' not in row


def test_session_scope_commits_and_rolls_back():
    # SQLite verifies SQLAlchemy lifecycle only, not PostgreSQL constraints.
    engine = create_engine('sqlite://')
    factory = create_session_factory(engine)
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE example (id integer PRIMARY KEY)'))
    with session_scope(factory) as session:
        session.execute(text('INSERT INTO example VALUES (1)'))
    with pytest.raises(RuntimeError):
        with session_scope(factory) as session:
            session.execute(text('INSERT INTO example VALUES (2)'))
            raise RuntimeError('abort transaction')
    with engine.connect() as connection:
        assert connection.execute(text('SELECT id FROM example')).scalars().all() == [1]
    engine.dispose()


def test_unicode_email_key_matches_current_authentication():
    assert to_database('users', {'email': '  Straße@Example.com  '})['email_key'] == 'strasse@example.com'
    public = to_api('users', {'user_id': 1, 'full_name': 'User', 'email': 'Straße@Example.com',
                              'email_key': 'strasse@example.com', 'is_owner': False})
    assert 'email_key' not in public
