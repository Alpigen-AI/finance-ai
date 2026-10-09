"""
Uploads receipt images to Firebase Storage (backed by GCS) and returns a
signed/public URL for the ADK vision agent to read.
"""
import uuid

from firebase_admin import storage


async def upload_receipt_image(
    user_id: str,
    image_bytes: bytes,
    content_type: str | None,
) -> str:

    bucket = storage.bucket()

    ext = (
        "jpg"
        if not content_type or "jpeg" in content_type
        else content_type.split("/")[-1]
    )

    blob_path = f"receipts/{user_id}/{uuid.uuid4()}.{ext}"

    blob = bucket.blob(blob_path)

    blob.upload_from_string(
        image_bytes,
        content_type=content_type or "image/jpeg",
    )

    url = blob.generate_signed_url(
        version="v4",
        expiration=900,
        method="GET",
    )

    return url