import io
import re

import pytest
from PIL import Image

from backend import photos
from backend.main import app


@pytest.fixture
def upload_directory(tmp_path, monkeypatch):
    monkeypatch.setattr(photos, "PHOTO_DIRECTORY", tmp_path)
    static = next(route.app for route in app.routes if getattr(route, "name", None) == "listing-photos")
    monkeypatch.setattr(static, "directory", tmp_path)
    monkeypatch.setattr(static, "all_directories", [tmp_path])
    return tmp_path


def image_bytes(image_format="PNG"):
    buffer = io.BytesIO()
    Image.new("RGB", (24, 16), "#223355").save(buffer, format=image_format)
    return buffer.getvalue()


def upload(client, headers=None, *, extension="png", mime="image/png", data=None):
    return client.post(f"/parking-photos?extension={extension}", headers={
        **(headers or {}), "Content-Type": mime,
    }, content=image_bytes() if data is None else data)


@pytest.mark.parametrize("extension,mime,image_format", [
    ("jpg", "image/jpeg", "JPEG"), ("JPEG", "image/jpeg", "JPEG"),
    ("png", "image/png", "PNG"), ("webp", "image/webp", "WEBP"),
])
def test_upload_reattaches_as_public_raster(
    client, upload_directory, create_user, create_spot, auth_headers, extension, mime, image_format,
):
    owner = create_user()
    headers = auth_headers(owner["id"])
    response = upload(client, headers, extension=extension, mime=mime,
                      data=image_bytes(image_format) + b"<script>trailing payload</script>")
    assert response.status_code == 201
    url = response.json()["url"]
    assert re.fullmatch(r"/uploads/[0-9]+-[0-9a-f]{32}\.(jpg|png|webp)", url)
    second = upload(client, headers, extension=extension, mime=mime, data=image_bytes(image_format))
    assert second.json()["url"] != url
    served = client.get(url)
    assert served.status_code == 200
    assert served.headers["content-type"] == mime
    assert served.headers["x-content-type-options"] == "nosniff"
    assert b"trailing payload" not in served.content
    Image.open(io.BytesIO(served.content)).load()
    urls = [url, "https://example.com/parking.jpg"]
    spot = create_spot(owner["id"], photo_urls=urls)
    assert client.get(f"/parking-spots/{spot['id']}").json()["photo_urls"] == urls
    reordered = client.put(f"/parking-spots/{spot['id']}", headers=headers, json=spot | {"photo_urls": urls[::-1]})
    assert reordered.status_code == 200
    assert reordered.json()["photo_urls"] == urls[::-1]


@pytest.mark.parametrize("extension,mime,data", [
    ("svg", "image/svg+xml", b"<svg/>"), ("../png", "image/png", b""),
    ("png", "text/html", b"<html>"), ("png", "image/png", b"<html>"),
    ("jpg", "image/jpeg", image_bytes()), ("png", "image/png", image_bytes()[:20]),
])
def test_upload_rejects_extension_mime_or_content(
    client, upload_directory, create_user, auth_headers, extension, mime, data,
):
    assert upload(client, auth_headers(create_user()["id"]), extension=extension, mime=mime, data=data).status_code == 415
    assert not list(upload_directory.iterdir())


def test_upload_size_and_authorization(client, upload_directory, create_user, auth_headers):
    owner = create_user()
    renter = create_user("renter@example.com", is_owner=False)
    assert upload(client).status_code == 401
    assert upload(client, auth_headers(renter["id"])).status_code == 403
    assert upload(client, auth_headers(owner["id"]), data=b"x" * (photos.MAX_BYTES + 1)).status_code == 413
    assert not list(upload_directory.iterdir())


def test_upload_enforces_megapixel_limit_and_accepts_exact_byte_limit(
    client, upload_directory, create_user, auth_headers,
):
    headers = auth_headers(create_user()["id"])
    content = image_bytes()
    exact = content.ljust(photos.MAX_BYTES, b"\0")
    assert upload(client, headers, data=exact).status_code == 201

    buffer = io.BytesIO()
    Image.new("1", (4001, 4000)).save(buffer, "PNG")
    response = upload(client, headers, data=buffer.getvalue())
    assert response.status_code == 422
    assert response.json()["detail"] == "Photo must be at most 16 megapixels"
    assert len(list(upload_directory.iterdir())) == 1


def test_static_allowlist_and_attachment_ownership(
    client, upload_directory, create_user, create_spot, auth_headers,
):
    (upload_directory / "internal.txt").write_text("internal")
    assert client.get("/uploads/internal.txt").status_code == 404
    assert client.get("/uploads/").status_code == 404
    assert client.get("/uploads/%2e%2e/photos.py").status_code == 404
    owner = create_user()
    everyone_else = create_user("other@example.com")
    url = upload(client, auth_headers(owner["id"])).json()["url"]
    spot = create_spot(owner["id"], photo_urls=[url] + ["https://example.com/parking.jpg"] * 4)
    assert len(spot["photo_urls"]) == 5
    for owner_id, urls in [
        (owner["id"], [url] * 6),
        (everyone_else["id"], [url]),
        (owner["id"], [f"/uploads/{owner['id']}-{'0' * 32}.png"]),
        (owner["id"], ["/uploads/../photos.py"]),
    ]:
        assert client.post("/parking-spots", headers=auth_headers(owner_id), json=spot | {"photo_urls": urls}).status_code == 422


def test_favorites_are_idempotent_and_scoped_to_user(client, create_user, create_spot, auth_headers):
    owner = create_user()
    renter = create_user("renter@example.com", is_owner=False)
    spot = create_spot(owner["id"])
    root = "/users/me/favorites"
    path = f"{root}/{spot['id']}"
    owner_headers, renter_headers = auth_headers(owner["id"]), auth_headers(renter["id"])
    assert client.get(root).status_code == 401
    assert client.put(path).status_code == 401
    assert client.delete(path).status_code == 401
    assert client.put(f"{root}/999", headers=renter_headers).status_code == 404
    assert client.put(path, headers=renter_headers).json() == {"saved": True}
    assert client.put(path, headers=renter_headers).json() == {"saved": True}
    assert client.get(root, headers=renter_headers).json() == [spot]
    assert client.delete(path, headers=owner_headers).json() == {"saved": False}
    assert client.get(root, headers=owner_headers).json() == []
    assert client.get(root, headers=renter_headers).json() == [spot]
    assert client.delete(path, headers=renter_headers).json() == {"saved": False}
    assert client.get(root, headers=renter_headers).json() == []


def test_controlled_amenities(client, create_user, create_spot, auth_headers):
    owner = create_user()
    spot = create_spot(owner["id"], amenities=["Covered", "Covered", "EV Charging"])
    assert spot["amenities"] == ["Covered", "EV Charging"]
    path = f"/parking-spots/{spot['id']}"
    update = lambda values: client.put(path, headers=auth_headers(owner["id"]), json=spot | {"amenities": values})
    assert update(["<b>Covered</b>"]).status_code == 422
    assert update([]).status_code == 200
    assert client.get(path).json().get("amenities", []) == []


def test_completed_reservation_cannot_be_cancelled_and_future_window_is_open(client, booking):
    response = client.post("/reservations", json=booking | {
        "start_time": "2000-01-01T10:00:00Z", "end_time": "2000-01-01T11:00:00Z",
    })
    assert response.status_code == 200
    reservation = response.json()
    assert reservation["status"] == "completed"
    assert client.delete(f"/reservations/{reservation['id']}").status_code == 409
    window = {key: booking[key] for key in ("start_time", "end_time")}
    assert [spot["id"] for spot in client.get("/parking-spots", params=window).json()] == [booking["spot_id"]]
    assert client.post("/reservations", json=booking).json()["status"] == "active"
