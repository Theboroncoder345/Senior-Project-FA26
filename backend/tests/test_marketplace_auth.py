import pytest

from backend.routers import auth, reservations, users
from backend import security


@pytest.fixture
def spot_payload():
    return {
        'address': '123 Main Street', 'description': 'Driveway',
        'price': 20, 'available': True,
    }


@pytest.fixture
def reservation_payload():
    return {
        'spot_id': 1,
        'start_time': '2026-11-02T10:00:00',
        'end_time': '2026-11-02T12:00:00',
    }


@pytest.mark.parametrize('path', ['/parking-spots', '/reservations'])
@pytest.mark.parametrize('authorization', [None, 'Bearer invalid', 'Basic invalid'])
def test_creation_requires_bearer_auth(client, spot_payload, reservation_payload, path, authorization):
    payload = spot_payload if path == '/parking-spots' else reservation_payload
    headers = {} if authorization is None else {'Authorization': authorization}
    response = client.post(path, json=payload, headers=headers)
    assert response.status_code == 401
    assert response.headers['www-authenticate'] == 'Bearer'
    assert client.get('/parking-spots').json() == []
    assert reservations.reservations == []


@pytest.mark.parametrize('path', ['/parking-spots', '/reservations'])
def test_creation_rejects_expired_session(
    client, signed_in, spot_payload, reservation_payload, path, monkeypatch,
):
    _, headers = signed_in()
    token = headers['Authorization'].split()[1]
    expires = auth.sessions[security.token_digest(token)]['expires_at']
    monkeypatch.setattr(security, 'time', lambda: expires)
    payload = spot_payload if path == '/parking-spots' else reservation_payload
    response = client.post(path, json=payload, headers=headers)
    assert response.status_code == 401
    assert client.get('/parking-spots').json() == []
    assert reservations.reservations == []


def test_owner_creates_spot_without_body_owner_id(client, signed_in, spot_payload):
    owner, headers = signed_in()
    response = client.post('/parking-spots', json=spot_payload, headers=headers)
    assert response.status_code == 200
    assert response.json() == {'id': 1, **spot_payload, 'owner_id': owner['id']}


def test_spoofed_owner_id_is_ignored(client, signed_in, spot_payload):
    owner, headers = signed_in()
    other, _ = signed_in('other@example.com')
    response = client.post('/parking-spots', json=spot_payload | {'owner_id': other['id']}, headers=headers)
    assert response.status_code == 200
    assert response.json()['owner_id'] == owner['id']


def test_nonowner_cannot_create_spot_even_with_owner_body_id(client, signed_in, spot_payload):
    owner, _ = signed_in()
    _, headers = signed_in('renter@example.com', is_owner=False)
    response = client.post('/parking-spots', json=spot_payload | {'owner_id': owner['id']}, headers=headers)
    assert response.status_code == 403
    assert response.json() == {'detail': 'User is not registered as a parking owner'}
    assert client.get('/parking-spots').json() == []


@pytest.mark.parametrize('is_owner', [False, True])
def test_authenticated_user_can_reserve_without_body_user_id(
    client, signed_in, spot_payload, reservation_payload, is_owner,
):
    _, owner_headers = signed_in()
    assert client.post('/parking-spots', json=spot_payload, headers=owner_headers).status_code == 200
    renter, renter_headers = signed_in('renter@example.com', is_owner=is_owner)
    response = client.post('/reservations', json=reservation_payload, headers=renter_headers)
    assert response.status_code == 200
    assert response.json() == {'id': 1, **reservation_payload, 'user_id': renter['id']}


def test_spoofed_reservation_user_id_is_ignored(client, signed_in, spot_payload, reservation_payload):
    _, owner_headers = signed_in()
    client.post('/parking-spots', json=spot_payload, headers=owner_headers)
    renter, renter_headers = signed_in('renter@example.com', False)
    response = client.post('/reservations', json=reservation_payload | {'user_id': 999}, headers=renter_headers)
    assert response.status_code == 200
    assert response.json()['user_id'] == renter['id']
    assert client.get(f"/users/{renter['id']}/reservations", headers=renter_headers).json() == [response.json()]


def test_removed_user_session_rejected(client, signed_in, spot_payload):
    user, headers = signed_in()
    users.users.remove(user)
    response = client.post('/parking-spots', json=spot_payload, headers=headers)
    assert response.status_code == 401
    assert client.get('/parking-spots').json() == []


def test_openapi_documents_bearer_and_server_assigned_identity(client):
    schema = client.get('/openapi.json').json()
    for path, identity in [('/parking-spots', 'owner_id'), ('/reservations', 'user_id')]:
        operation = schema['paths'][path]['post']
        assert operation['security'] == [{'HTTPBearer': []}]
        model_name = operation['requestBody']['content']['application/json']['schema']['$ref'].split('/')[-1]
        assert identity not in schema['components']['schemas'][model_name]['properties']
