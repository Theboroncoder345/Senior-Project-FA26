"""Local raster uploads for the classroom deployment."""
import io
import os
import re
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps
from starlette.staticfiles import StaticFiles

from backend.routers.auth import current_user
from backend.validation import require_owner

PHOTO_DIRECTORY = Path(os.environ.get("PARKSHARE_UPLOAD_DIR") or Path(__file__).resolve().parent / "uploads")
PHOTO_PREFIX = "/uploads/"
PHOTO_PATH = re.compile(r"/uploads/([1-9][0-9]*)-[0-9a-f]{32}\.(?:jpg|png|webp)")


class ListingPhotoFiles(StaticFiles):
    async def get_response(self, path, scope):
        if not PHOTO_PATH.fullmatch(PHOTO_PREFIX + path):
            raise HTTPException(404, "Photo not found")
        response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response


MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 16_000_000
FORMATS = {
    "jpg": ("JPEG", "image/jpeg", "jpg"),
    "jpeg": ("JPEG", "image/jpeg", "jpg"),
    "png": ("PNG", "image/png", "png"),
    "webp": ("WEBP", "image/webp", "webp"),
}
router = APIRouter()


def validate_new_uploads(urls, owner_id, previous=()):
    for url in urls:
        match = PHOTO_PATH.fullmatch(url)
        if match and url not in previous and (
            int(match[1]) != owner_id or not (PHOTO_DIRECTORY / Path(url).name).is_file()
        ):
            raise HTTPException(422, "Select an uploaded photo from your own account")


def store_photo(data, owner_id, image_format, extension):
    try:
        with Image.open(io.BytesIO(data), formats=[image_format]) as source:
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(422, "Photo must be at most 16 megapixels")
            source.verify()
        with Image.open(io.BytesIO(data), formats=[image_format]) as source:
            mode = "RGB" if image_format == "JPEG" else "RGBA"
            pixels = ImageOps.exif_transpose(source).convert(mode)
            # Paste into a fresh image so metadata and trailing payloads are discarded.
            clean = Image.new(mode, pixels.size)
            clean.paste(pixels)
            encoded = io.BytesIO()
            clean.save(encoded, format=image_format)
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(415, "The photo content does not match a supported image") from None

    filename = f"{owner_id}-{uuid4().hex}.{extension}"
    PHOTO_DIRECTORY.mkdir(parents=True, exist_ok=True)
    with (PHOTO_DIRECTORY / filename).open("xb") as destination:
        destination.write(encoded.getbuffer())
    return PHOTO_PREFIX + filename


@router.post("/parking-photos", status_code=201)
async def upload_photo(request: Request, extension: str, user: Annotated[dict, Depends(current_user)]):
    require_owner(user)
    photo_format = FORMATS.get(extension.lower())
    if photo_format is None or request.headers.get("content-type") != photo_format[1]:
        raise HTTPException(415, "Choose a JPG, JPEG, PNG, or WebP photo")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Each photo must be 5 MiB or smaller")
        data.extend(chunk)
    url = await run_in_threadpool(store_photo, data, user["id"], photo_format[0], photo_format[2])
    return {"url": url}
