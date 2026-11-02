import pytest


def test_create_user(client):
    payload = {'name': 'Alice', 'email': 'alice@example.com', 'is_owner': False}
    response = client.post('/users', json=payload)
    assert response.status_code == 200
    assert response.json() == {'id': 1, **payload}
    assert client.get('/users').json() == [response.json()]


def test_duplicate_email(client, create_user):
    original = create_user()
    response = client.post('/users', json={
        'name': 'Another user', 'email': original['email'], 'is_owner': False,
    })
    assert response.status_code == 409
    assert response.json() == {'detail': 'Email already registered'}
    assert client.get('/users').json() == [original]


def test_owner_can_create_spot(client, create_user, create_spot):
    owner = create_user()
    spot = create_spot(owner['id'], price=0)
    assert spot['owner_id'] == owner['id']
    assert spot['price'] == 0
    assert client.get(f"/parking-spots/{spot['id']}").json() == spot


@pytest.mark.parametrize('owner_exists, status, detail', [
    (False, 401, 'Invalid or expired access token'),
    (True, 403, 'User is not registered as a parking owner'),
])
def test_reject_invalid_owner(client, create_user, auth_headers, owner_exists, status, detail):
    owner_id = create_user(is_owner=False)['id'] if owner_exists else 999
    response = client.post('/parking-spots', headers=auth_headers(owner_id) if owner_exists else {}, json={
        'address': 'Street', 'price': 10, 'description': 'Parking',
        'available': True, 'owner_id': owner_id,
    })
    assert response.status_code == status
    assert response.json() == {'detail': detail}
    assert client.get('/parking-spots').json() == []


@pytest.mark.parametrize('override, field', [
    ({'price': -1}, 'price'), ({'address': ''}, 'address'),
    ({'address': ' \t '}, 'address'), ({'description': ''}, 'description'),
    ({'description': ' \n '}, 'description'),
])
def test_invalid_spot_fields(client, create_user, auth_headers, override, field):
    owner = create_user()
    response = client.post('/parking-spots', headers=auth_headers(owner['id']), json={
        'address': 'Street', 'price': 10, 'description': 'Parking',
        'available': True, 'owner_id': owner['id'], **override,
    })
    assert response.status_code == 422
    assert any(error['loc'][-1] == field for error in response.json()['detail'])
    assert client.get('/parking-spots').json() == []


def test_valid_reservation(client, booking):
    response = client.post('/reservations', json=booking)
    assert response.status_code == 200
    assert response.json() == {'id': 1, **booking}
    assert client.get('/reservations/1').json() == response.json()
    assert client.get('/reservations').json() == [response.json()]


@pytest.mark.parametrize('override, detail', [
    ({'spot_id': 999}, 'Parking spot not found'),
])
def test_invalid_reservation_references(client, booking, override, detail):
    response = client.post('/reservations', json=booking | override)
    assert response.status_code == 404
    assert response.json() == {'detail': detail}
    assert client.get('/reservations').json() == []


@pytest.mark.parametrize('override', [
    {'end_time': '2026-11-02T10:00:00'},
    {'end_time': '2026-11-02T09:00:00'},
    {'start_time': 'not-a-date'},
    {'end_time': 'not-a-date'},
    {'end_time': '2026-11-02T12:00:00Z'},
])
def test_invalid_reservation_times(client, booking, override):
    response = client.post('/reservations', json=booking | override)
    assert response.status_code == 422
    assert response.json()['detail']
    assert client.get('/reservations').json() == []


@pytest.mark.parametrize('start, end', [
    ('10:00', '12:00'), ('09:00', '11:00'), ('11:00', '13:00'),
    ('10:30', '11:30'), ('09:00', '13:00'),
])
def test_double_booking(client, booking, start, end):
    first = client.post('/reservations', json=booking)
    assert first.status_code == 200
    response = client.post('/reservations', json=booking | {
        'start_time': f'2026-11-02T{start}:00',
        'end_time': f'2026-11-02T{end}:00',
    })
    assert response.status_code == 409
    assert response.json() == {'detail': 'Parking spot is already reserved during that time'}
    assert client.get('/reservations').json() == [first.json()]


@pytest.mark.parametrize('start, end', [('08:00', '10:00'), ('12:00', '14:00')])
def test_adjacent_reservations_allowed(client, booking, start, end):
    assert client.post('/reservations', json=booking).status_code == 200
    response = client.post('/reservations', json=booking | {
        'start_time': f'2026-11-02T{start}:00',
        'end_time': f'2026-11-02T{end}:00',
    })
    assert response.status_code == 200
    assert response.json()['id'] == 2


def test_same_time_different_spot_allowed(client, booking, create_spot):
    assert client.post('/reservations', json=booking).status_code == 200
    other_spot = create_spot(1)
    response = client.post('/reservations', json=booking | {'spot_id': other_spot['id']})
    assert response.status_code == 200


@pytest.mark.parametrize('params, expected', [
    ({}, [1, 2, 3, 4]),
    ({'min_price': 20}, [3, 4]),
    ({'max_price': 10}, [1, 2]),
    ({'min_price': 10, 'max_price': 20}, [2, 3]),
    ({'min_price': 20, 'max_price': 20}, [3]),
    ({'max_price': 0}, [1]),
    ({'min_price': 40}, []),
    ({'min_price': 30, 'max_price': 10}, []),
    ({'min_price': 10, 'max_price': 30, 'available': False, 'owner_id': 1}, [3]),
])
def test_parking_price_filters(client, create_user, create_spot, params, expected):
    first = create_user()
    second = create_user('second@example.com')
    for price, available, owner in [
        (0, True, first), (10, True, first),
        (20, False, first), (30, False, second),
    ]:
        create_spot(owner['id'], price=price, available=available)
    response = client.get('/parking-spots', params=params)
    assert response.status_code == 200
    assert [spot['id'] for spot in response.json()] == expected
    assert len(client.get('/parking-spots').json()) == 4
