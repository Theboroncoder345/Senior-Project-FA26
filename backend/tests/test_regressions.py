from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest


def test_email_uniqueness_ignores_case_and_surrounding_whitespace(client, create_user):
    original = create_user('Owner@Example.com')
    response = client.post('/users', json={
        'name': 'Duplicate', 'email': '  owner@example.COM  ', 'is_owner': False,
    })
    assert response.status_code == 409
    assert client.get('/users').json() == [original]


@pytest.mark.parametrize('changes', [
    {'name': ' \t '}, {'email': ''}, {'email': 'invalid'},
    {'email': 'a@@example.com'}, {'email': 'a b@example.com'},
])
def test_invalid_user_fields(client, changes):
    response = client.post('/users', json={
        'name': 'User', 'email': 'user@example.com', 'is_owner': False, **changes,
    })
    assert response.status_code == 422
    assert client.get('/users').json() == []


@pytest.mark.parametrize('owner_exists, expected', [(False, 403), (True, 403)])
def test_update_spot_checks_owner_without_mutation(
    client, create_user, create_spot, auth_headers, owner_exists, expected,
):
    owner = create_user()
    spot = create_spot(owner['id'])
    invalid_owner_id = create_user('renter@example.com', False)['id'] if owner_exists else 999
    payload = {key: value for key, value in spot.items() if key != 'id'}
    response = client.put(f"/parking-spots/{spot['id']}", headers=auth_headers(owner['id']), json=payload | {
        'owner_id': invalid_owner_id, 'price': 99,
    })
    assert response.status_code == expected
    assert client.get(f"/parking-spots/{spot['id']}").json() == spot


def test_valid_spot_update(client, create_user, create_spot, auth_headers):
    owner = create_user()
    other = create_user('other@example.com')
    spot = create_spot(owner['id'])
    payload = {key: value for key, value in spot.items() if key != 'id'}
    response = client.put(f"/parking-spots/{spot['id']}", headers=auth_headers(owner['id']), json=payload | {'price': 25})
    assert response.status_code == 200
    assert response.json()['owner_id'] == owner['id']
    assert response.json()['price'] == 25


def test_unavailable_spot_cannot_be_reserved(client, booking, auth_headers):
    spot = client.get(f"/parking-spots/{booking['spot_id']}").json()
    payload = {key: value for key, value in spot.items() if key != 'id'}
    assert client.put(f"/parking-spots/{spot['id']}", headers=auth_headers(spot['owner_id']), json=payload | {'available': False}).status_code == 200
    response = client.post('/reservations', json=booking)
    assert response.status_code == 409
    assert response.json() == {'detail': 'Parking spot is not available'}
    assert client.get('/reservations').json() == []


def test_reserved_spot_deletion_is_rejected_until_reservation_removed(client, booking, auth_headers):
    reservation = client.post('/reservations', json=booking).json()
    path = f"/parking-spots/{booking['spot_id']}"
    response = client.delete(path, headers=auth_headers(1))
    assert response.status_code == 409
    assert client.get(path).status_code == 200
    assert client.get('/owners/1/reservations', headers=auth_headers(1)).json() == [reservation]
    assert client.delete(f"/reservations/{reservation['id']}").status_code == 200
    assert client.delete(path, headers=auth_headers(1)).status_code == 200
    assert client.get(path).status_code == 404


@pytest.mark.parametrize('aware_first', [False, True])
def test_naive_and_aware_bookings_compare_without_server_error(client, booking, aware_first):
    aware = booking | {
        'start_time': '2026-11-02T05:00:00-05:00',
        'end_time': '2026-11-02T07:00:00-05:00',
    }
    first, second = (aware, booking) if aware_first else (booking, aware)
    assert client.post('/reservations', json=first).status_code == 200
    assert client.post('/reservations', json=second).status_code == 409
    adjacent = booking | {
        'start_time': '2026-11-02T07:00:00-05:00',
        'end_time': '2026-11-02T08:00:00-05:00',
    }
    assert client.post('/reservations', json=adjacent).status_code == 200


@pytest.mark.parametrize('price', ['Infinity', '-Infinity', 'NaN'])
@pytest.mark.parametrize('method', ['POST', 'PUT'])
def test_nonfinite_parking_prices(client, create_user, create_spot, auth_headers, price, method):
    owner = create_user()
    spot = create_spot(owner['id'])
    payload = {key: value for key, value in spot.items() if key != 'id'}
    path = '/parking-spots' if method == 'POST' else f"/parking-spots/{spot['id']}"
    response = client.request(method, path, headers=auth_headers(owner['id']), json=payload | {'price': price})
    assert response.status_code == 422
    assert client.get('/parking-spots').json() == [spot]


@pytest.mark.parametrize('field', ['min_price', 'max_price'])
@pytest.mark.parametrize('value', ['-1', 'Infinity', 'NaN'])
def test_invalid_price_filters(client, field, value):
    assert client.get('/parking-spots', params={field: value}).status_code == 422


@pytest.mark.parametrize('field', ['owner_id', 'spot_id'])
@pytest.mark.parametrize('value', [0, -1])
def test_positive_reference_ids(client, booking, field, value):
    if field == 'owner_id':
        response = client.put(f"/parking-spots/{booking['spot_id']}", json={
            'address': 'Street', 'description': 'Parking', 'price': 10,
            'available': True, 'owner_id': value,
        })
    else:
        response = client.post('/reservations', json=booking | {field: value})
    assert response.status_code == 422


def concurrent_requests(call):
    barrier = Barrier(8)
    def synchronized_call(_):
        barrier.wait(timeout=10)
        return call().status_code
    with ThreadPoolExecutor(max_workers=8) as executor:
        return sorted(executor.map(synchronized_call, range(8)))


def test_concurrent_duplicate_registration(client):
    statuses = concurrent_requests(lambda: client.post('/users', json={
        'name': 'User', 'email': 'user@example.com', 'is_owner': False,
    }))
    assert statuses == [200] + [409] * 7
    assert len(client.get('/users').json()) == 1


def test_concurrent_double_booking(client, booking):
    statuses = concurrent_requests(lambda: client.post('/reservations', json=booking))
    assert statuses == [200] + [409] * 7
    assert len(client.get('/reservations').json()) == 1


def test_ids_not_reused_after_deletion(client, booking, create_spot, auth_headers):
    first = client.post('/reservations', json=booking).json()
    client.delete(f"/reservations/{first['id']}")
    second = client.post('/reservations', json=booking).json()
    assert second['id'] > first['id']
    spare = create_spot(1)
    assert client.delete(f"/parking-spots/{spare['id']}", headers=auth_headers(1)).status_code == 200
    assert create_spot(1)['id'] > spare['id']


def test_seed_spots_have_registered_owners():
    from backend import store
    for spot in store.parking_spots:
        assert any(user['id'] == spot['owner_id'] and user['is_owner'] for user in store.users)


@pytest.mark.parametrize('path', [
    '/parking-spots/0', '/reservations/-1',
    '/users/0/reservations', '/owners/-1/reservations',
])
def test_invalid_path_ids(client, create_user, auth_headers, path):
    user = create_user()
    assert client.get(path, headers=auth_headers(user["id"])).status_code == 422


@pytest.mark.parametrize('method, path, detail', [
    ('GET', '/parking-spots/999', 'Parking spot not found'),
    ('DELETE', '/parking-spots/999', 'Parking spot not found'),
    ('GET', '/reservations/999', 'Reservation not found'),
    ('DELETE', '/reservations/999', 'Reservation not found'),
    ('GET', '/users/999/reservations', 'User not found'),
    ('GET', '/owners/999/reservations', 'Owner not found'),
])
def test_missing_resources_return_consistent_404(client, create_user, auth_headers, method, path, detail):
    user = create_user()
    response = client.request(method, path, headers=auth_headers(user["id"]))
    assert response.status_code == 404
    assert response.json() == {'detail': detail}


def test_scoped_reservation_lists(client, booking, create_user, create_spot, auth_headers):
    first = client.post('/reservations', json=booking).json()
    other_owner = create_user('other@example.com')
    other_spot = create_spot(other_owner['id'])
    second = client.post('/reservations', headers=auth_headers(other_owner['id']), json=booking | {
        'user_id': other_owner['id'], 'spot_id': other_spot['id'],
    }).json()
    assert client.get('/owners/1/reservations', headers=auth_headers(1)).json() == [first]
    assert client.get(f"/owners/{other_owner['id']}/reservations", headers=auth_headers(other_owner['id'])).json() == [second]
    assert client.get(f"/users/{booking['user_id']}/reservations").json() == [first]
    assert client.get('/owners/2/reservations').status_code == 403


def test_seed_id_counters_start_above_existing_ids():
    from runpy import run_path
    from backend import store
    fresh_store = run_path(store.__file__)
    for records_name, counter_name in [
        ('users', 'user_ids'), ('parking_spots', 'parking_spot_ids'),
        ('reservations', 'reservation_ids'),
    ]:
        records = fresh_store[records_name]
        assert next(fresh_store[counter_name]) > max((item['id'] for item in records), default=0)
