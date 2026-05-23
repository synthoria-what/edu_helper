import mimetypes
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.config import get_settings
from app.dependencies import get_current_user
from app.models import User, UserRole

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def require_editor(user: User) -> None:
    if user.role not in {UserRole.teacher, UserRole.admin}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступно только преподавателю или администратору")


@router.post("/images", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    require_editor(current_user)

    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Загрузите изображение JPG, PNG, WebP или GIF")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Файл пустой")

    settings = get_settings()
    max_image_size = settings.max_upload_size_mb * 1024 * 1024
    if len(contents) > max_image_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Размер картинки не должен превышать {settings.max_upload_size_mb} МБ",
        )

    extension = mimetypes.guess_extension(content_type) or Path(file.filename or "").suffix
    if extension == ".jpe":
        extension = ".jpg"
    filename = f"{secrets.token_urlsafe(18)}{extension.lower()}"

    image_dir = Path(settings.upload_dir) / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    (image_dir / filename).write_bytes(contents)

    return {"url": f"/uploads/images/{filename}"}
