from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Course, Lesson, Task, TaskType, User, UserRole
from app.security import get_password_hash


async def seed_demo_data(session: AsyncSession) -> None:
    await ensure_media_columns(session)
    await ensure_user_role_enum(session)
    await seed_demo_users(session)

    existing_course = await session.scalar(select(Course).limit(1))
    if existing_course:
        return

    course = Course(
        title="Цифровая грамотность студента",
        description="Короткий курс о безопасной работе с информацией, учебными сервисами и данными.",
        direction="Общие компетенции",
        level="Базовый",
        duration_minutes=55,
        image_url="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80",
        lessons=[
            Lesson(
                title="Информационная безопасность",
                content="Студент учится отличать надежные источники от сомнительных и защищать учебные аккаунты.",
                video_url="https://www.youtube.com/embed/inWWhr5tnEA",
                image_url="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
                order_index=1,
                tasks=[
                    Task(
                        type=TaskType.quiz,
                        title="Проверка источника",
                        prompt="Какой признак лучше всего указывает на надежность учебного источника?",
                        image_url=None,
                        payload={
                            "options": [
                                "Яркий баннер на главной странице",
                                "Наличие автора, даты публикации и ссылок на первичные данные",
                                "Большое количество комментариев",
                                "Обещание быстро решить любую задачу",
                            ]
                        },
                        correct_answer="Наличие автора, даты публикации и ссылок на первичные данные",
                        order_index=1,
                    )
                ],
            ),
            Lesson(
                title="Анализ учебных данных",
                content="Интерактивный график помогает увидеть динамику выполнения заданий и сделать выводы.",
                video_url=None,
                image_url=None,
                order_index=2,
                tasks=[
                    Task(
                        type=TaskType.chart,
                        title="Найди пик активности",
                        prompt="Посмотри на график и выбери месяц, в котором выполнено больше всего заданий.",
                        image_url=None,
                        payload={
                            "points": [
                                {"label": "Январь", "value": 18},
                                {"label": "Февраль", "value": 26},
                                {"label": "Март", "value": 33},
                                {"label": "Апрель", "value": 41},
                                {"label": "Май", "value": 30},
                            ]
                        },
                        correct_answer="Апрель",
                        order_index=1,
                    )
                ],
            ),
            Lesson(
                title="Термины без скуки",
                content="Небольшой ребус закрепляет терминологию и делает финал курса менее формальным.",
                video_url=None,
                image_url=None,
                order_index=3,
                tasks=[
                    Task(
                        type=TaskType.rebus,
                        title="Ребус",
                        prompt="Разгадай учебный термин: ДАН + НЫЕ. Ответ введи одним словом.",
                        image_url=None,
                        payload={"clue": "ДАН + НЫЕ", "hint": "То, что мы собираем, храним и анализируем."},
                        correct_answer="Данные",
                        order_index=1,
                    )
                ],
            ),
        ],
    )
    session.add(course)
    await session.commit()


async def ensure_media_columns(session: AsyncSession) -> None:
    bind = session.get_bind()
    if bind.dialect.name != "postgresql":
        return

    await session.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)"))
    await session.execute(text("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)"))
    await session.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)"))
    await session.commit()


async def ensure_user_role_enum(session: AsyncSession) -> None:
    bind = session.get_bind()
    if bind.dialect.name != "postgresql":
        return

    await session.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'teacher'"))
    await session.commit()


async def seed_demo_users(session: AsyncSession) -> None:
    demo_users = [
        {
            "full_name": "Администратор платформы",
            "email": "admin@example.com",
            "password": "admin123",
            "role": UserRole.admin,
        },
        {
            "full_name": "Преподаватель Демонстрационный",
            "email": "teacher@example.com",
            "password": "teacher123",
            "role": UserRole.teacher,
        },
        {
            "full_name": "Студент Демонстрационный",
            "email": "student@example.com",
            "password": "student123",
            "role": UserRole.student,
        },
    ]

    for demo_user in demo_users:
        existing_user = await session.scalar(select(User).where(User.email == demo_user["email"]))
        if existing_user:
            continue

        session.add(
            User(
                full_name=demo_user["full_name"],
                email=demo_user["email"],
                hashed_password=get_password_hash(demo_user["password"]),
                role=demo_user["role"],
            )
        )

    await session.commit()
