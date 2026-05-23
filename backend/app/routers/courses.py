import secrets
import uuid
from html import escape
from html.parser import HTMLParser

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.dependencies import get_current_user
from app.models import Certificate, Course, CourseEnrollment, Lesson, Task, TaskResult, TaskType, User, UserRole
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


class CourseHtmlSanitizer(HTMLParser):
    allowed_tags = {"p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "span", "font", "img"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag not in self.allowed_tags:
            return
        if tag == "img":
            attr_map = dict(attrs)
            src = str(attr_map.get("src", "")).strip()
            if not src or src.lower().startswith("javascript:"):
                return
            alt = escape(str(attr_map.get("alt", "")), quote=True)
            self.parts.append(f'<img src="{escape(src, quote=True)}" alt="{alt}">')
            return
        if tag == "span":
            style = sanitize_style(dict(attrs).get("style", ""))
            self.parts.append(f'<span style="{style}">' if style else "<span>")
            return
        if tag == "font":
            size = str(dict(attrs).get("size", "3"))
            self.parts.append(f'<font size="{escape(size, quote=True)}">' if size in {"1", "2", "3", "4", "5", "6", "7"} else "<font>")
            return
        self.parts.append(f"<{tag}>")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.allowed_tags and tag not in {"br", "img"}:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self.parts.append(escape(data))

    def get_html(self) -> str:
        return "".join(self.parts)


def normalize_answer(value: str) -> str:
    return value.strip().casefold()


def sanitize_style(value: str) -> str:
    parts = [part.strip() for part in value.split(";")]
    safe_parts = []
    for part in parts:
        if not part.lower().startswith("font-size:"):
            continue
        size = part.split(":", 1)[1].strip().lower()
        if size.endswith("px") and size[:-2].isdigit() and 10 <= int(size[:-2]) <= 36:
            safe_parts.append(f"font-size: {int(size[:-2])}px")
    return "; ".join(safe_parts)


def sanitize_course_html(value: str) -> str:
    sanitizer = CourseHtmlSanitizer()
    sanitizer.feed(value or "")
    return sanitizer.get_html()


def normalize_answer_list(values: list[str]) -> list[str]:
    return sorted(normalize_answer(value) for value in values if value.strip())


def answer_is_correct(task: Task, answer: str) -> bool:
    if task.type == TaskType.multi_choice:
        expected = task.payload.get("correct_answers")
        if not isinstance(expected, list):
            expected = task.correct_answer.split("|")
        return normalize_answer_list(answer.split("|")) == normalize_answer_list([str(item) for item in expected])
    if task.type == TaskType.order:
        expected = task.payload.get("items")
        if not isinstance(expected, list):
            expected = task.correct_answer.split("|")
        return [normalize_answer(item) for item in answer.split("|")] == [
            normalize_answer(str(item)) for item in expected if str(item).strip()
        ]
    return normalize_answer(answer) == normalize_answer(task.correct_answer)


def normalize_task_payload(payload: TaskMutation) -> dict:
    data = payload.model_dump()
    if payload.type == TaskType.multi_choice:
        correct_answers = data["payload"].get("correct_answers")
        if not isinstance(correct_answers, list):
            correct_answers = data["correct_answer"].split("|")
        normalized = [str(item).strip() for item in correct_answers if str(item).strip()]
        data["payload"] = {**data["payload"], "correct_answers": normalized}
        data["correct_answer"] = "|".join(normalized)
    elif payload.type == TaskType.order:
        items = data["payload"].get("items")
        if not isinstance(items, list):
            items = data["correct_answer"].split("|")
        normalized = [str(item).strip() for item in items if str(item).strip()]
        data["payload"] = {**data["payload"], "items": normalized}
        data["correct_answer"] = "|".join(normalized)
    return data


def can_edit_course(course: Course, user: User) -> bool:
    return user.role == UserRole.admin or course.owner_id == user.id


def require_course_editor(course: Course, user: User) -> None:
    if not can_edit_course(course, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Можно редактировать только свои курсы")


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
    lessons_count = await session.scalar(select(func.count(Lesson.id)).where(Lesson.course_id == course.id))
    owner_name = None
    if course.owner_id:
        owner_name = await session.scalar(select(User.full_name).where(User.id == course.owner_id))
    is_enrolled = await session.scalar(
        select(CourseEnrollment.id).where(CourseEnrollment.course_id == course.id, CourseEnrollment.user_id == user.id)
    )
    progress_percent = round((completed_tasks / total_tasks) * 100) if total_tasks else 0
    return CourseListItem(
        id=course.id,
        title=course.title,
        description=course.description,
        description_html=course.description_html or escape(course.description),
        learning_goals=list(course.learning_goals or []),
        direction=course.direction,
        level=course.level,
        duration_minutes=course.duration_minutes,
        price_rubles=course.price_rubles,
        image_url=course.image_url,
        owner_name=owner_name or "Автор курса",
        lessons_count=lessons_count or 0,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        progress_percent=progress_percent,
        is_enrolled=bool(is_enrolled),
        can_edit=can_edit_course(course, user),
    )


async def get_course_or_404(session: AsyncSession, course_id: int) -> Course:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    return course


async def assert_task_is_unlocked(session: AsyncSession, task_id: int, user: User) -> None:
    course_id = await session.scalar(select(Lesson.course_id).join(Task).where(Task.id == task_id))
    if course_id is None:
        raise HTTPException(status_code=404, detail="Задание не найдено")

    course = await session.scalar(
        select(Course).where(Course.id == course_id).options(selectinload(Course.lessons).selectinload(Lesson.tasks))
    )
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    if can_edit_course(course, user):
        return

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
    q: str | None = Query(default=None),
    price: str | None = Query(default=None, pattern="^(free|paid)$"),
    direction: str | None = Query(default=None),
    level: str | None = Query(default=None),
    owner_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CourseListItem]:
    query = select(Course).outerjoin(User, Course.owner_id == User.id).order_by(Course.id)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(
                Course.title.ilike(pattern),
                Course.description.ilike(pattern),
                Course.direction.ilike(pattern),
                User.full_name.ilike(pattern),
            )
        )
    if price == "free":
        query = query.where(Course.price_rubles == 0)
    elif price == "paid":
        query = query.where(Course.price_rubles > 0)
    if direction:
        query = query.where(Course.direction.ilike(f"%{direction.strip()}%"))
    if level:
        query = query.where(Course.level == level)
    if owner_id:
        try:
            query = query.where(Course.owner_id == uuid.UUID(owner_id))
        except ValueError:
            query = query.where(Course.owner_id.is_(None))
    courses = (await session.scalars(query)).all()
    return [await build_course_list_item(session, course, current_user) for course in courses]


@router.get("/mine", response_model=list[CourseListItem])
async def list_my_courses(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CourseListItem]:
    query = select(Course).order_by(Course.id)
    if current_user.role != UserRole.admin:
        query = query.where(Course.owner_id == current_user.id)
    courses = (await session.scalars(query)).all()
    return [await build_course_list_item(session, course, current_user) for course in courses]


@router.get("/enrolled", response_model=list[CourseListItem])
async def list_enrolled_courses(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CourseListItem]:
    courses = (
        await session.scalars(
            select(Course).join(CourseEnrollment).where(CourseEnrollment.user_id == current_user.id).order_by(Course.id)
        )
    ).all()
    return [await build_course_list_item(session, course, current_user) for course in courses]


@router.post("", response_model=CourseListItem, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseMutation,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CourseListItem:
    data = payload.model_dump()
    data["description_html"] = sanitize_course_html(data.get("description_html") or data["description"])
    data["learning_goals"] = [goal.strip() for goal in data.get("learning_goals", []) if goal.strip()]
    course = Course(**data, owner_id=current_user.id)
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return await build_course_list_item(session, course, current_user)


@router.post("/{course_id}/enroll", response_model=CourseListItem)
async def enroll_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CourseListItem:
    course = await get_course_or_404(session, course_id)
    existing = await session.scalar(
        select(CourseEnrollment).where(CourseEnrollment.course_id == course_id, CourseEnrollment.user_id == current_user.id)
    )
    if not existing and not can_edit_course(course, current_user):
        session.add(CourseEnrollment(course_id=course_id, user_id=current_user.id))
        await session.commit()
    return await build_course_list_item(session, course, current_user)


@router.put("/{course_id}", response_model=CourseListItem)
async def update_course(
    course_id: int,
    payload: CourseMutation,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CourseListItem:
    course = await get_course_or_404(session, course_id)
    require_course_editor(course, current_user)
    data = payload.model_dump()
    data["description_html"] = sanitize_course_html(data.get("description_html") or data["description"])
    data["learning_goals"] = [goal.strip() for goal in data.get("learning_goals", []) if goal.strip()]
    for field, value in data.items():
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
    course = await get_course_or_404(session, course_id)
    require_course_editor(course, current_user)

    lesson_ids = select(Lesson.id).where(Lesson.course_id == course_id)
    task_ids = select(Task.id).where(Task.lesson_id.in_(lesson_ids))

    await session.execute(delete(TaskResult).where(TaskResult.task_id.in_(task_ids)))
    await session.execute(delete(CourseEnrollment).where(CourseEnrollment.course_id == course_id))
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
    course = await get_course_or_404(session, course_id)
    require_course_editor(course, current_user)
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
    lesson = await session.scalar(
        select(Lesson).where(Lesson.id == lesson_id).options(selectinload(Lesson.tasks))
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await get_course_or_404(session, lesson.course_id)
    require_course_editor(course, current_user)
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
    lesson = await session.scalar(select(Lesson).where(Lesson.id == lesson_id))
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await get_course_or_404(session, lesson.course_id)
    require_course_editor(course, current_user)

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
    lesson = await session.scalar(select(Lesson).where(Lesson.id == lesson_id))
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await get_course_or_404(session, lesson.course_id)
    require_course_editor(course, current_user)
    task = Task(lesson_id=lesson_id, **normalize_task_payload(payload))
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
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    course_id = await session.scalar(select(Lesson.course_id).where(Lesson.id == task.lesson_id))
    if course_id is None:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await get_course_or_404(session, course_id)
    require_course_editor(course, current_user)
    for field, value in normalize_task_payload(payload).items():
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
    task = await session.scalar(select(Task).where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Задание не найдено")
    course_id = await session.scalar(select(Lesson.course_id).where(Lesson.id == task.lesson_id))
    if course_id is None:
        raise HTTPException(status_code=404, detail="Урок не найден")
    course = await get_course_or_404(session, course_id)
    require_course_editor(course, current_user)

    await session.execute(delete(TaskResult).where(TaskResult.task_id == task_id))
    await session.execute(delete(Task).where(Task.id == task_id))
    await session.commit()


@router.get("/{course_id}/students", response_model=list[CourseProgressStudent])
async def course_students_progress(
    course_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CourseProgressStudent]:
    course = await get_course_or_404(session, course_id)
    require_course_editor(course, current_user)
    students = (
        await session.scalars(select(User).where(User.role != UserRole.admin).order_by(User.full_name))
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

    include_answers = can_edit_course(course, current_user)
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
    is_correct = answer_is_correct(task, payload.answer)
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
