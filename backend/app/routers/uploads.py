import mimetypes
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.config import get_settings
from app.dependencies import get_current_user
from app.models import User, UserRole

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024


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
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Размер картинки не должен превышать 5 МБ")

    extension = mimetypes.guess_extension(content_type) or Path(file.filename or "").suffix
    if extension == ".jpe":
        extension = ".jpg"
    filename = f"{secrets.token_urlsafe(18)}{extension.lower()}"

    settings = get_settings()
    image_dir = Path(settings.upload_dir) / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    (image_dir / filename).write_bytes(contents)

    return {"url": f"/uploads/images/{filename}"}
