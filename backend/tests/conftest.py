from itertools import count

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend import security
from backend.routers import auth, parking_spots, reservations, users


@pytest.fixture
def client(monkeypatch):
    # Replace every imported reference so tests share fresh data and counters.
    monkeypatch.setattr(auth, 'password_hashes', {})
    monkeypatch.setattr(auth, 'sessions', {})
    test_users = []
    test_spots = []
    test_reservations = []
    for module in (users, parking_spots, reservations):
        monkeypatch.setattr(module, 'users', test_users)
    for module in (parking_spots, reservations):
        monkeypatch.setattr(module, 'parking_spots', test_spots)
    for module in (parking_spots, reservations):
        monkeypatch.setattr(module, 'reservations', test_reservations)
    monkeypatch.setattr(users, 'user_ids', count(1))
    monkeypatch.setattr(parking_spots, 'parking_spot_ids', count(1))
    monkeypatch.setattr(reservations, 'reservation_ids', count(1))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def create_user(client):
    def create(email='owner@example.com', is_owner=True):
        response = client.post('/users', json={
            'name': 'Test User', 'email': email, 'is_owner': is_owner,
        })
        assert response.status_code == 200
        return response.json()
    return create


@pytest.fixture
def auth_headers():
    def headers(user_id):
        token = security.create_session(auth.sessions, user_id)
        return {'Authorization': f'Bearer {token}'}
    return headers


@pytest.fixture
def create_spot(client, auth_headers):
    def create(owner_id, **overrides):
        response = client.post('/parking-spots', headers=auth_headers(owner_id), json={
            'address': '123 Test Street', 'price': 20,
            'description': 'Test parking', 'available': True,
            'owner_id': owner_id, **overrides,
        })
        assert response.status_code == 200
        return response.json()
    return create


@pytest.fixture
def booking(client, create_user, create_spot, auth_headers):
    owner = create_user()
    renter = create_user('renter@example.com', is_owner=False)
    spot = create_spot(owner['id'])
    client.headers.update(auth_headers(renter['id']))
    return {
        'spot_id': spot['id'], 'user_id': renter['id'],
        'start_time': '2026-11-02T10:00:00',
        'end_time': '2026-11-02T12:00:00',
    }


@pytest.fixture
def signed_in(client):
    def create(email='owner@example.com', is_owner=True):
        registration = client.post('/auth/register', json={
            'name': 'Marketplace User', 'email': email,
            'password': 'a secure test password', 'is_owner': is_owner,
        })
        assert registration.status_code == 201
        login = client.post('/auth/login', json={
            'email': email, 'password': 'a secure test password',
        })
        assert login.status_code == 200
        return registration.json(), {'Authorization': f"Bearer {login.json()['access_token']}"}
    return create


