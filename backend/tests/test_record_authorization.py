import pytest

from backend.routers import auth
from backend import security


@pytest.fixture
def records(client, create_user, create_spot, auth_headers):
    owner = create_user()
    other_owner = create_user('other-owner@example.com')
    renter = create_user('renter@example.com', False)
    other_renter = create_user('other-renter@example.com', False)
    spot = create_spot(owner['id'])
    other_spot = create_spot(other_owner['id'])
    payload = {
        'spot_id': spot['id'], 'start_time': '2026-11-02T10:00:00',
        'end_time': '2026-11-02T12:00:00',
    }
    reservation = client.post('/reservations', json=payload, headers=auth_headers(renter['id']))
    other_reservation = client.post('/reservations', json=payload | {'spot_id': other_spot['id']}, headers=auth_headers(other_renter['id']))
    assert reservation.status_code == other_reservation.status_code == 200
    return {
        'owner': owner, 'other_owner': other_owner, 'renter': renter,
        'other_renter': other_renter, 'spot': spot, 'other_spot': other_spot,
        'reservation': reservation.json(), 'other_reservation': other_reservation.json(),
        'update': {key: value for key, value in spot.items() if key != 'id'},
    }


PROTECTED_ROUTES = [
    ('PUT', '/parking-spots/1'), ('DELETE', '/parking-spots/1'),
    ('GET', '/users/me/reservations'), ('GET', '/owners/me/parking-spots'),
    ('GET', '/reservations/1'), ('DELETE', '/reservations/1'),
    ('GET', '/reservations'), ('GET', '/users/3/reservations'),
    ('GET', '/owners/1/reservations'),
]


@pytest.mark.parametrize('method, path', PROTECTED_ROUTES)
@pytest.mark.parametrize('token_kind', ['missing', 'invalid', 'expired'])
def test_all_protected_routes_reject_unauthorized(
    client, records, auth_headers, method, path, token_kind,
):
    headers = {}
    if token_kind == 'invalid':
        headers = {'Authorization': 'Bearer invalid'}
    elif token_kind == 'expired':
        headers = auth_headers(records['owner']['id'])
        token = headers['Authorization'].split()[1]
        auth.sessions[security.token_digest(token)]['expires_at'] = 0
    response = client.request(method, path, headers=headers, json=records['update'] if method == 'PUT' else None)
    assert response.status_code == 401
    assert response.headers['www-authenticate'] == 'Bearer'
    assert client.get('/parking-spots/1').json() == records['spot']


@pytest.mark.parametrize('actor', ['other_owner', 'renter', 'other_renter'])
@pytest.mark.parametrize('method', ['PUT', 'DELETE'])
def test_other_accounts_cannot_mutate_listing(client, records, auth_headers, actor, method):
    response = client.request(method, '/parking-spots/1', headers=auth_headers(records[actor]['id']), json=records['update'] | {'owner_id': records[actor]['id']} if method == 'PUT' else None)
    assert response.status_code == 403
    assert client.get('/parking-spots/1').json() == records['spot']


def test_owner_can_update_but_cannot_transfer_listing(client, records, auth_headers):
    headers = auth_headers(records['owner']['id'])
    response = client.put('/parking-spots/1', json=records['update'] | {'price': 35}, headers=headers)
    assert response.status_code == 200
    assert response.json()['price'] == 35
    for forged_owner in [records['other_owner']['id'], records['renter']['id'], 999]:
        response = client.put('/parking-spots/1', json=records['update'] | {'owner_id': forged_owner}, headers=headers)
        assert response.status_code == 403
        assert client.get('/parking-spots/1').json()['owner_id'] == records['owner']['id']


def test_only_creator_can_cancel_and_owner_can_then_delete_listing(client, records, auth_headers):
    for actor in ['owner', 'other_owner', 'other_renter']:
        response = client.delete('/reservations/1', headers=auth_headers(records[actor]['id']))
        assert response.status_code == 403
    owner_headers = auth_headers(records['owner']['id'])
    assert client.delete('/parking-spots/1', headers=owner_headers).status_code == 409
    renter_headers = auth_headers(records['renter']['id'])
    response = client.delete('/reservations/1', headers=renter_headers)
    assert response.status_code == 200
    assert response.json() == {'message': 'Reservation deleted'}
    assert client.delete('/reservations/1', headers=renter_headers).status_code == 404
    response = client.delete('/parking-spots/1', headers=owner_headers)
    assert response.status_code == 200
    assert response.json() == {'message': 'Parking spot deleted'}
    assert client.get('/parking-spots/1').status_code == 404


@pytest.mark.parametrize('actor, expected', [
    ('renter', 200), ('owner', 200), ('other_owner', 403), ('other_renter', 403),
])
def test_reservation_detail_privacy(client, records, auth_headers, actor, expected):
    response = client.get('/reservations/1', headers=auth_headers(records[actor]['id']))
    assert response.status_code == expected
    if expected == 200:
        assert response.json() == records['reservation']


def test_me_and_legacy_lists_are_scoped_and_cannot_be_impersonated(client, records, auth_headers):
    for actor, expected in [('renter', records['reservation']), ('other_renter', records['other_reservation'])]:
        headers = auth_headers(records[actor]['id'])
        for path in ['/users/me/reservations', '/reservations', f"/users/{records[actor]['id']}/reservations"]:
            response = client.get(path, headers=headers, params={'user_id': 999})
            assert response.status_code == 200
            assert response.json() == [expected]
        assert client.get('/users/1/reservations', headers=headers).status_code == 403
        assert client.get('/owners/1/reservations', headers=headers).status_code == 403
    for actor, listing, reservation in [
        ('owner', records['spot'], records['reservation']),
        ('other_owner', records['other_spot'], records['other_reservation']),
    ]:
        headers = auth_headers(records[actor]['id'])
        response = client.get('/owners/me/parking-spots', headers=headers, params={'owner_id': 999})
        assert response.status_code == 200
        assert response.json() == [listing]
        assert client.get(f"/owners/{records[actor]['id']}/reservations", headers=headers).json() == [reservation]
    assert client.get('/owners/1/reservations', headers=auth_headers(records['other_owner']['id'])).status_code == 403


def test_nonowner_cannot_view_owner_listings_and_empty_me_lists(client, create_user, auth_headers):
    renter = create_user(is_owner=False)
    owner = create_user('empty-owner@example.com')
    assert client.get('/owners/me/parking-spots', headers=auth_headers(renter['id'])).status_code == 403
    for path in ['/users/me/reservations', '/reservations']:
        response = client.get(path, headers=auth_headers(renter['id']))
        assert response.status_code == 200
        assert response.json() == []
    response = client.get('/owners/me/parking-spots', headers=auth_headers(owner['id']))
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize('method, path', [
    ('PUT', '/parking-spots/999'), ('DELETE', '/parking-spots/999'),
    ('GET', '/reservations/999'), ('DELETE', '/reservations/999'),
])
def test_missing_records_return_404_when_authenticated(client, records, auth_headers, method, path):
    response = client.request(method, path, headers=auth_headers(records['owner']['id']), json=records['update'] if method == 'PUT' else None)
    assert response.status_code == 404


@pytest.mark.parametrize('changes', [
    {'price': -1}, {'address': '   '}, {'description': ''}, {'owner_id': 0},
])
def test_update_validation_preserved(client, records, auth_headers, changes):
    response = client.put('/parking-spots/1', json=records['update'] | changes, headers=auth_headers(records['owner']['id']))
    assert response.status_code == 422
    assert client.get('/parking-spots/1').json() == records['spot']


def test_full_login_authorization_flow(client, signed_in):
    owner, owner_headers = signed_in()
    renter, renter_headers = signed_in('renter@example.com', False)
    spot = client.post('/parking-spots', headers=owner_headers, json={
        'address': 'Street', 'description': 'Parking', 'price': 0, 'available': True,
    }).json()
    reservation = client.post('/reservations', headers=renter_headers, json={
        'spot_id': spot['id'], 'start_time': '2026-11-02T10:00:00', 'end_time': '2026-11-02T11:00:00',
    }).json()
    assert reservation['user_id'] == renter['id']
    assert client.get('/users/me/reservations', headers=renter_headers).json() == [reservation]
    assert client.get('/owners/me/parking-spots', headers=owner_headers).json() == [spot]
    assert client.delete(f"/reservations/{reservation['id']}", headers=owner_headers).status_code == 403
    assert client.delete(f"/reservations/{reservation['id']}", headers=renter_headers).status_code == 200
    assert client.delete(f"/parking-spots/{spot['id']}", headers=owner_headers).status_code == 200
