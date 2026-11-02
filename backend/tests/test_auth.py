import pytest

from backend.routers import auth
from backend import security


@pytest.fixture
def registration():
    return {
        'name': 'Alice', 'email': 'alice@example.com',
        'password': 'A secure password 123', 'is_owner': False,
    }


@pytest.fixture
def registered(client, registration):
    response = client.post('/auth/register', json=registration)
    assert response.status_code == 201
    return response.json()


def login(client, registration, **changes):
    return client.post('/auth/login', json={
        'email': registration['email'], 'password': registration['password'], **changes,
    })


def test_registration_hashes_password_without_exposing_it(client, registration):
    response = client.post('/auth/register', json=registration)
    assert response.status_code == 201
    expected = {'id': 1, 'name': 'Alice', 'email': 'alice@example.com', 'is_owner': False}
    assert response.json() == expected
    assert client.get('/users').json() == [expected]
    stored_hash = auth.password_hashes[1]
    assert stored_hash.startswith('$argon2id$')
    assert stored_hash != registration['password']
    assert security.verify_password(registration['password'], stored_hash)


@pytest.mark.parametrize('email', ['alice@example.com', ' ALICE@Example.COM '])
def test_registration_duplicate_email(client, registration, registered, email):
    response = client.post('/auth/register', json=registration | {'email': email})
    assert response.status_code == 409
    assert response.json() == {'detail': 'Email already registered'}
    assert client.get('/users').json() == [registered]
    assert len(auth.password_hashes) == 1
    assert login(client, registration).status_code == 200


def test_login_returns_usable_bearer_session(client, registration, registered):
    response = login(client, registration, email=' ALICE@Example.COM ')
    assert response.status_code == 200
    body = response.json()
    assert body['user'] == registered
    assert body['token_type'] == 'bearer'
    assert body['expires_in'] == 3600
    assert response.headers['cache-control'] == 'no-store'
    token = body['access_token']
    assert len(token) >= 32
    assert token not in auth.sessions
    assert security.token_digest(token) in auth.sessions
    assert registration['password'] not in response.text
    me = client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200
    assert me.json() == registered


@pytest.mark.parametrize('changes', [
    {'password': 'wrong password'}, {'email': 'unknown@example.com'},
])
def test_login_rejects_invalid_credentials(client, registration, registered, changes):
    response = login(client, registration, **changes)
    assert response.status_code == 401
    assert response.json() == {'detail': 'Invalid email or password'}
    assert response.headers['www-authenticate'] == 'Bearer'
    assert auth.sessions == {}


def test_legacy_user_cannot_login_or_be_overwritten(client, create_user, registration):
    legacy = create_user(registration['email'])
    assert login(client, registration).status_code == 401
    assert client.post('/auth/register', json=registration).status_code == 409
    assert client.get('/users').json() == [legacy]
    assert auth.password_hashes == {}


def test_legacy_creation_rejects_auth_registered_email(client, registered):
    response = client.post('/users', json={
        'name': 'Another', 'email': registered['email'], 'is_owner': True,
    })
    assert response.status_code == 409


@pytest.mark.parametrize('password', ['', 'short', ' ' * 8, 'x' * 129])
def test_registration_password_validation(client, registration, password):
    response = client.post('/auth/register', json=registration | {'password': password})
    assert response.status_code == 422
    assert client.get('/users').json() == []
    assert auth.password_hashes == {}


def test_password_whitespace_is_preserved(client, registration):
    payload = registration | {'password': '  password with spaces  '}
    assert client.post('/auth/register', json=payload).status_code == 201
    assert login(client, payload).status_code == 200
    assert login(client, payload, password=payload['password'].strip()).status_code == 401


def test_same_password_has_different_salted_hashes(client, registration, registered):
    second = client.post('/auth/register', json=registration | {'email': 'other@example.com'})
    assert second.status_code == 201
    assert auth.password_hashes[registered['id']] != auth.password_hashes[second.json()['id']]


@pytest.mark.parametrize('authorization', [None, 'Bearer invalid-token', 'Basic invalid'])
def test_me_requires_valid_token(client, authorization):
    headers = {} if authorization is None else {'Authorization': authorization}
    response = client.get('/auth/me', headers=headers)
    assert response.status_code == 401


def test_expired_session_rejected(client, registration, registered, monkeypatch):
    response = login(client, registration)
    token = response.json()['access_token']
    expires_at = auth.sessions[security.token_digest(token)]['expires_at']
    monkeypatch.setattr(security, 'time', lambda: expires_at)
    response = client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 401
    assert auth.sessions == {}


def test_auth_owner_can_use_existing_routes(client, registration):
    owner = client.post('/auth/register', json=registration | {'is_owner': True}).json()
    token = login(client, registration).json()['access_token']
    response = client.post('/parking-spots', headers={'Authorization': f'Bearer {token}'}, json={
        'owner_id': owner['id'], 'address': 'Street', 'price': 10,
        'description': 'Parking', 'available': True,
    })
    assert response.status_code == 200
    assert response.json()['owner_id'] == owner['id']


@pytest.mark.parametrize('origin, status', [
    ('http://localhost:5173', 200), ('http://localhost:3000', 400),
])
def test_auth_cors_preflight(client, origin, status):
    response = client.options('/auth/login', headers={
        'Origin': origin, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
    })
    assert response.status_code == status
    if status == 200:
        assert response.headers['access-control-allow-origin'] == origin
    else:
        assert 'access-control-allow-origin' not in response.headers
