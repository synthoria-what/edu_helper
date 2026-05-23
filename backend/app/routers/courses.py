import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.dependencies import get_current_user
from app.models import Certificate, Course, Lesson, Task, TaskResult, User, UserRole
from app.schemas import (
    CertificateRead,
    CourseDetail,
    CourseListItem,
    CourseMutation,
    CourseProgressStudent,
    LessonMutation,
    LessonRead,
    SubmitTaskRequest,
    SubmitTaskResponse,
    TaskMutation,
    TaskRead,
    TaskResultRead,
)

router = APIRouter(prefix="/courses", tags=["courses"])


def normalize_answer(value: str) -> str:
    return value.strip().casefold()


def require_course_editor(user: User) -> None:
    if user.role not in {UserRole.teacher, UserRole.admin}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступно только преподавателю или администратору")


def build_certificate_read(certificate: Certificate) -> CertificateRead:
    return CertificateRead(
        id=certificate.id,
        course_id=certificate.course_id,
        course_title=certificate.course.title,
        student_name=certificate.user.full_name,
        code=certificate.code,
        issued_at=certificate.issued_at,
    )


def build_task_read(task: Task, result: TaskResult | None = None, include_answer: bool = False) -> TaskRead:
    return TaskRead(
        id=task.id,
        type=task.type,
        title=task.title,
        prompt=task.prompt,
        payload=task.payload,
        correct_answer=task.correct_answer if include_answer else None,
        image_url=task.image_url,
        order_index=task.order_index,
        result=TaskResultRead.model_validate(result) if result else None,
    )


def build_lesson_read(lesson: Lesson) -> LessonRead:
    return LessonRead(
        id=lesson.id,
        title=lesson.title,
        content=lesson.content,
        video_url=lesson.video_url,
        image_url=lesson.image_url,
        order_index=lesson.order_index,
        tasks=[build_task_read(task) for task in lesson.tasks],
    )


async def get_course_stats(session: AsyncSession, course_id: int, user_id) -> tuple[int, int]:
    total_tasks = await session.scalar(select(func.count(Task.id)).join(Lesson).where(Lesson.course_id == course_id))
    completed_tasks = await session.scalar(
        select(func.count(TaskResult.id))
        .join(Task)
        .join(Lesson)
        .where(Lesson.course_id == course_id, TaskResult.user_id == user_id, TaskResult.is_correct.is_(True))
    )
    return total_tasks or 0, completed_tasks or 0


async def build_course_list_item(session: AsyncSession, course: Course, user: User) -> CourseListItem:
    total_tasks, completed_tasks = await get_course_stats(session, course.id, user.id)
    progress_percent = round((completed_tasks / total_tasks) * 100) if total_tasks else 0
    return CourseListItem(
        id=course.id,
        title=course.title,
        description=course.description,
        direction=course.direction,
        level=course.level,
        duration_minutes=course.duration_minutes,
        image_url=course.image_url,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        progress_percent=progress_percent,
    )


async def get_course_or_404(session: AsyncSession, course_id: int) -> Course:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    return course


async def assert_task_is_unlocked(session: AsyncSession, task_id: int, user: User) -> None:
    if user.role in {UserRole.teacher, UserRole.admin}:
        return

    course_id = await session.scalar(select(Lesson.course_id).join(Task).where(Task.id == task_id))
    if course_id is None:
        raise HTTPException(status_code=404, detail="Задание не найдено")

    course = await session.scalar(
        select(Course).where(Course.id == course_id).options(selectinload(Course.lessons).selectinload(Lesson.tasks))
    )
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    ordered_tasks = [
        task
        for lesson in sorted(course.lessons, key=lambda item: item.order_index)
        for task in sorted(lesson.tasks, key=lambda item: item.order_index)
    ]
    task_ids = [task.id for task in ordered_tasks]
    current_index = task_ids.index(task_id)
    previous_task_ids = task_ids[:current_index]
    if not previous_task_ids:
        return

    completed_previous = await session.scalar(
        select(func.count(TaskResult.id)).where(
            TaskResult.user_id == user.id,
            TaskResult.task_id.in_(previous_task_ids),
            TaskResult.is_correct.is_(True),
        )
    )
    if (completed_previous or 0) < len(previous_task_ids):
        raise HTTPException(status_code=400, detail="Это задание откроется после предыдущего")


@router.get("", response_model=list[CourseListItem])
async def list_courses(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CourseListItem]:
    courses = (await session.scalars(select(Course).order_by(Course.id))).all()
    return [await build_course_list_item(session, course, current_user) for course in courses]


@router.post("", response_model=CourseListItem, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseMutation,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CourseListItem:
    require_course_editor(current_user)
    course = Course(**payload.model_dump())
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return await build_course_list_item(session, course, current_user)


@router.put("/{course_id}", response_model=CourseListItem)
async def update_course(
    course_id: int,
    payload: CourseMutation,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CourseListItem:
    require_course_editor(current_user)
    course = await get_course_or_404(session, course_id)
    for field, value in payload.model_dump().items():
        setattr(course, field, value)
    await session.commit()
    await session.refresh(course)
    return await build_course_list_item(session, course, current_user)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    require_course_editor(current_user)
    await get_course_or_404(session, course_id)

    lesson_ids = select(Lesson.id).where(Lesson.course_id == course_id)
    task_ids = select(Task.id).where(Task.lesson_id.in_(lesson_ids))

    await session.execute(delete(TaskResult).where(TaskResult.task_id.in_(task_ids)))
    await session.execute(delete(Certificate).where(Certificate.course_id == course_id))
    await session.execute(delete(Task).where(Task.lesson_id.in_(lesson_ids)))
    await session.execute(delete(Lesson).where(Lesson.course_id == course_id))
    await session.execute(delete(Course).where(Course.id == course_id))
    await session.commit()


@router.post("/{course_id}/lessons", response_model=LessonRead, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    course_id: int,
    payload: LessonMutation,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LessonRead:
    require_course_editor(current_user)
    await get_course_or_404(session, course_id)
    lesson = Lesson(course_id=course_id, **payload.model_dump())
    session.add(lesson)
    await session.commit()
    await session.refresh(lesson)
    return LessonRead(
        id=lesson.id,
        title=lesson.title,
        content=lesson.content,
        video_url=lesson.video_url,
        image_url=lesson.image_url,
        order_index=lesson.order_index,
        tasks=[],
    )


@router.put("/lessons/{lesson_id}", response_model=LessonRead)
async def update_lesson(
    lesson_id: int,
    payload: LessonMutation,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LessonRead:
    require_course_editor(current_user)
    lesson = await session.scalar(
        select(Lesson).where(Lesson.id == lesson_id).options(selectinload(Lesson.tasks))
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    for field, value in payload.model_dump().items():
        setattr(lesson, field, value)
    await session.commit()
    await session.refresh(lesson)
    return build_lesson_read(lesson)


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(
    lesson_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    require_course_editor(current_user)
    lesson = await session.scalar(select(Lesson).where(Lesson.id == lesson_id))
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    task_ids = select(Task.id).where(Task.lesson_id == lesson_id)
    await session.execute(delete(TaskResult).where(TaskResult.task_id.in_(task_ids)))
    await session.execute(delete(Task).where(Task.lesson_id == lesson_id))
    await session.execute(delete(Lesson).where(Lesson.id == lesson_id))
    await session.commit()


@router.post("/lessons/{lesson_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    lesson_id: int,
    payload: TaskMutation,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    require_course_editor(current_user)
    lesson = await session.scalar(select(Lesson).where(Lesson.id == lesson_id))
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    task = Task(lesson_id=lesson_id, **payload.model_dump())
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return build_task_read(task, include_answer=True)


@router.put("/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: int,
    payload: TaskMutation,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskRead:
    require_course_editor(current_user)
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    for field, value in payload.model_dump().items():
        setattr(task, field, value)
    await session.commit()
    await session.refresh(task)
    return build_task_read(task, include_answer=True)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    require_course_editor(current_user)
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")

    await session.execute(delete(TaskResult).where(TaskResult.task_id == task_id))
    await session.execute(delete(Task).where(Task.id == task_id))
    await session.commit()


@router.get("/{course_id}/students", response_model=list[CourseProgressStudent])
async def course_students_progress(
    course_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CourseProgressStudent]:
    require_course_editor(current_user)
    await get_course_or_404(session, course_id)
    students = (
        await session.scalars(select(User).where(User.role == UserRole.student).order_by(User.full_name))
    ).all()

    rows: list[CourseProgressStudent] = []
    for student in students:
        total_tasks, completed_tasks = await get_course_stats(session, course_id, student.id)
        certificate = await session.scalar(
            select(Certificate).where(Certificate.course_id == course_id, Certificate.user_id == student.id)
        )
        completed_task_titles = (
            await session.scalars(
                select(Task.title)
                .join(TaskResult, TaskResult.task_id == Task.id)
                .join(Lesson, Lesson.id == Task.lesson_id)
                .where(
                    Lesson.course_id == course_id,
                    TaskResult.user_id == student.id,
                    TaskResult.is_correct.is_(True),
                )
                .order_by(Lesson.order_index, Task.order_index)
            )
        ).all()
        rows.append(
            CourseProgressStudent(
                user_id=student.id,
                full_name=student.full_name,
                email=student.email,
                completed_tasks=completed_tasks,
                total_tasks=total_tasks,
                progress_percent=round((completed_tasks / total_tasks) * 100) if total_tasks else 0,
                certificate_code=certificate.code if certificate else None,
                completed_task_titles=list(completed_task_titles),
            )
        )
    return rows


@router.get("/{course_id}", response_model=CourseDetail)
async def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CourseDetail:
    course = await session.scalar(
        select(Course)
        .where(Course.id == course_id)
        .options(selectinload(Course.lessons).selectinload(Lesson.tasks))
    )
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    result_rows = await session.scalars(
        select(TaskResult)
        .join(Task)
        .join(Lesson)
        .where(Lesson.course_id == course_id, TaskResult.user_id == current_user.id)
    )
    results_by_task = {result.task_id: result for result in result_rows.all()}

    include_answers = current_user.role in {UserRole.teacher, UserRole.admin}
    lessons = [
        LessonRead(
            id=lesson.id,
            title=lesson.title,
            content=lesson.content,
            video_url=lesson.video_url,
            image_url=lesson.image_url,
            order_index=lesson.order_index,
            tasks=[
                build_task_read(task, results_by_task.get(task.id), include_answer=include_answers)
                for task in lesson.tasks
            ],
        )
        for lesson in course.lessons
    ]

    base = await build_course_list_item(session, course, current_user)
    certificate = await session.scalar(
        select(Certificate)
        .where(Certificate.course_id == course_id, Certificate.user_id == current_user.id)
        .options(selectinload(Certificate.course), selectinload(Certificate.user))
    )
    return CourseDetail(
        **base.model_dump(),
        lessons=lessons,
        certificate=build_certificate_read(certificate) if certificate else None,
    )


@router.post("/tasks/{task_id}/submit", response_model=SubmitTaskResponse)
async def submit_task(
    task_id: int,
    payload: SubmitTaskRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubmitTaskResponse:
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")

    await assert_task_is_unlocked(session, task_id, current_user)
    is_correct = normalize_answer(payload.answer) == normalize_answer(task.correct_answer)
    result = await session.scalar(
        select(TaskResult).where(TaskResult.task_id == task.id, TaskResult.user_id == current_user.id)
    )

    if result:
        result.answer = payload.answer
        result.is_correct = is_correct
        result.score = 100 if is_correct else 0
    else:
        result = TaskResult(
            user_id=current_user.id,
            task_id=task.id,
            answer=payload.answer,
            is_correct=is_correct,
            score=100 if is_correct else 0,
        )
        session.add(result)

    await session.commit()
    await session.refresh(result)
    return SubmitTaskResponse(
        result=TaskResultRead.model_validate(result),
        message="Верно, следующее задание открыто" if is_correct else "Ответ сохранен, попробуйте еще раз",
    )


@router.post("/{course_id}/certificate", response_model=CertificateRead)
async def issue_certificate(
    course_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CertificateRead:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    existing_certificate = await session.scalar(
        select(Certificate)
        .where(Certificate.course_id == course_id, Certificate.user_id == current_user.id)
        .options(selectinload(Certificate.course), selectinload(Certificate.user))
    )
    if existing_certificate:
        return build_certificate_read(existing_certificate)

    total_tasks, completed_tasks = await get_course_stats(session, course_id, current_user.id)
    if total_tasks == 0 or completed_tasks < total_tasks:
        raise HTTPException(status_code=400, detail="Сертификат доступен после выполнения всех заданий")

    certificate = Certificate(
        user_id=current_user.id,
        course_id=course.id,
        code=f"EDU-{secrets.token_hex(4).upper()}",
    )
    session.add(certificate)
    await session.commit()

    certificate = await session.scalar(
        select(Certificate)
        .where(Certificate.id == certificate.id)
        .options(selectinload(Certificate.course), selectinload(Certificate.user))
    )
    return build_certificate_read(certificate)
