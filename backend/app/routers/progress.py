from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.dependencies import get_current_user
from app.models import Certificate, Course, Lesson, Task, TaskResult, User, UserRole
from app.schemas import CertificateRead, CompletedTaskRead, ProgressSummary

router = APIRouter(prefix="/progress", tags=["progress"])


def build_certificate_read(certificate: Certificate) -> CertificateRead:
    return CertificateRead(
        id=certificate.id,
        course_id=certificate.course_id,
        course_title=certificate.course.title,
        student_name=certificate.user.full_name,
        code=certificate.code,
        issued_at=certificate.issued_at,
    )


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


@router.get("/certificates", response_model=list[CertificateRead])
async def list_certificates(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CertificateRead]:
    query = select(Certificate).options(selectinload(Certificate.course), selectinload(Certificate.user))
    if current_user.role == UserRole.student:
        query = query.where(Certificate.user_id == current_user.id)

    certificates = (await session.scalars(query.order_by(Certificate.issued_at.desc()))).all()
    return [build_certificate_read(certificate) for certificate in certificates]


@router.get("/completed-tasks", response_model=list[CompletedTaskRead])
async def list_completed_tasks(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CompletedTaskRead]:
    query = (
        select(TaskResult, Task, Lesson, Course, User)
        .join(Task, Task.id == TaskResult.task_id)
        .join(Lesson, Lesson.id == Task.lesson_id)
        .join(Course, Course.id == Lesson.course_id)
        .join(User, User.id == TaskResult.user_id)
        .where(TaskResult.is_correct.is_(True))
        .order_by(TaskResult.completed_at.desc())
    )
    if current_user.role == UserRole.student:
        query = query.where(TaskResult.user_id == current_user.id)

    rows = (await session.execute(query)).all()
    return [
        CompletedTaskRead(
            task_id=result.task_id,
            task_title=task.title,
            course_id=course.id,
            course_title=course.title,
            lesson_title=lesson.title,
            answer=result.answer,
            score=result.score,
            completed_at=result.completed_at,
            user_id=user.id,
            student_name=user.full_name,
            student_email=user.email,
        )
        for result, task, lesson, course, user in rows
    ]
