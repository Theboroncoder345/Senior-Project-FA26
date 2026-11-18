import pytest


@pytest.mark.parametrize("params", [
    {"start_time": "2026-11-02T10:00:00Z"},
    {"end_time": "2026-11-02T10:00:00Z"},
    {"start_time": "2026-11-02T10:00:00Z", "end_time": "2026-11-02T09:00:00Z"},
    {"start_time": "1793613600", "end_time": "2026-11-02T11:00:00Z"},
])
def test_reject_invalid_search_window(client, params):
    assert client.get("/parking-spots", params=params).status_code == 422


@pytest.mark.parametrize("urls", [
    ["javascript:alert(1)"], ["http://example.com/x.jpg"], ["https://user:pw@example.com/x.jpg"],
    ["https://example.com/image.jpg"] * 6,
])
def test_unsafe_photo_urls_are_rejected(client, create_user, auth_headers, urls):
    owner = create_user()
    response = client.post("/parking-spots", headers=auth_headers(owner["id"]), json={
        "address": "Street", "description": "Driveway", "price": 10, "available": True, "photo_urls": urls,
    })
    assert response.status_code == 422
    assert "user:pw" not in response.text
    assert client.get("/parking-spots").json() == []


def test_other_host_and_renter_cannot_toggle_availability(client, create_user, create_spot, auth_headers):
    owner = create_user()
    other_host = create_user("other@example.com")
    renter = create_user("renter@example.com", is_owner=False)
    spot = create_spot(owner["id"])
    path = f"/parking-spots/{spot['id']}/availability"
    for actor in (other_host, renter):
        assert client.patch(path, headers=auth_headers(actor["id"]), json={"available": False}).status_code == 403
    assert client.patch(path, json={"available": False}).status_code == 401
    assert client.get("/parking-spots", params={"available": True}).json() == [spot]


def test_paused_listing_rejects_booking_and_can_be_unpaused(client, booking, auth_headers):
    path = f"/parking-spots/{booking['spot_id']}/availability"
    headers = auth_headers(1)
    assert client.patch(path, headers=headers, json={"available": False}).json()["available"] is False
    assert client.post("/reservations", json=booking).status_code == 409
    assert client.patch(path, headers=headers, json={"available": True}).json()["available"] is True
    confirmed = client.post("/reservations", json=booking)
    assert confirmed.status_code == 200
    params = {key: booking[key] for key in ("start_time", "end_time")}
    assert client.get("/parking-spots", params=params).json() == []
    assert client.delete(f"/reservations/{confirmed.json()['id']}").status_code == 200
    assert [spot["id"] for spot in client.get("/parking-spots", params=params).json()] == [booking["spot_id"]]


def test_become_host_requires_authentication(client):
    assert client.post("/auth/become-host", json={"id": 1}).status_code == 401


def test_validation_does_not_echo_password(client):
    secret = "x" * 129
    response = client.post("/auth/register", json={
        "email": "test@example.com", "name": "Test User", "password": secret,
    })
    assert response.status_code == 422
    assert secret not in response.text
