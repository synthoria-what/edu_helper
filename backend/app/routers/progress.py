from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user
from app.models import Certificate, Course, Task, TaskResult, User
from app.schemas import ProgressSummary

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/summary", response_model=ProgressSummary)
async def progress_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProgressSummary:
    courses_total = await session.scalar(select(func.count(Course.id)))
    tasks_total = await session.scalar(select(func.count(Task.id)))
    completed_tasks = await session.scalar(
        select(func.count(TaskResult.id)).where(TaskResult.user_id == current_user.id, TaskResult.is_correct.is_(True))
    )
    completed_courses = await session.scalar(
        select(func.count(Certificate.id)).where(Certificate.user_id == current_user.id)
    )

    average_progress = round(((completed_tasks or 0) / (tasks_total or 1)) * 100) if tasks_total else 0
    return ProgressSummary(
        courses_total=courses_total or 0,
        completed_courses=completed_courses or 0,
        tasks_total=tasks_total or 0,
        completed_tasks=completed_tasks or 0,
        average_progress=average_progress,
    )

