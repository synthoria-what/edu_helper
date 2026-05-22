import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import TaskType, UserRole


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: UserRole

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class UserAdminRead(UserRead):
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: UserRole


class TaskResultRead(BaseModel):
    task_id: int
    answer: str
    is_correct: bool
    score: int
    completed_at: datetime

    model_config = {"from_attributes": True}


class TaskRead(BaseModel):
    id: int
    type: TaskType
    title: str
    prompt: str
    payload: dict
    correct_answer: str | None = None
    image_url: str | None
    order_index: int
    result: TaskResultRead | None = None

    model_config = {"from_attributes": True}


class LessonRead(BaseModel):
    id: int
    title: str
    content: str
    video_url: str | None
    image_url: str | None
    order_index: int
    tasks: list[TaskRead]

    model_config = {"from_attributes": True}


class CourseListItem(BaseModel):
    id: int
    title: str
    description: str
    direction: str
    level: str
    duration_minutes: int
    image_url: str | None = None
    total_tasks: int
    completed_tasks: int
    progress_percent: int

    model_config = {"from_attributes": True}


class CourseDetail(CourseListItem):
    lessons: list[LessonRead]
    certificate: "CertificateRead | None" = None


class SubmitTaskRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=255)


class SubmitTaskResponse(BaseModel):
    result: TaskResultRead
    message: str


class CertificateRead(BaseModel):
    id: uuid.UUID
    course_id: int
    course_title: str
    student_name: str
    code: str
    issued_at: datetime


class ProgressSummary(BaseModel):
    courses_total: int
    completed_courses: int
    tasks_total: int
    completed_tasks: int
    average_progress: int


class CompletedTaskRead(BaseModel):
    task_id: int
    task_title: str
    course_id: int
    course_title: str
    lesson_title: str
    answer: str
    score: int
    completed_at: datetime
    user_id: uuid.UUID
    student_name: str
    student_email: EmailStr


class CourseMutation(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(min_length=10)
    direction: str = Field(min_length=2, max_length=120)
    level: str = Field(min_length=2, max_length=80)
    duration_minutes: int = Field(ge=5, le=600)
    image_url: str | None = Field(default=None, max_length=500)


class LessonMutation(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    content: str = Field(min_length=10)
    video_url: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)
    order_index: int = Field(ge=1, le=999)


class TaskMutation(BaseModel):
    type: TaskType
    title: str = Field(min_length=3, max_length=180)
    prompt: str = Field(min_length=5)
    payload: dict = Field(default_factory=dict)
    correct_answer: str = Field(min_length=1, max_length=255)
    image_url: str | None = Field(default=None, max_length=500)
    order_index: int = Field(ge=1, le=999)


class CourseProgressStudent(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: EmailStr
    completed_tasks: int
    total_tasks: int
    progress_percent: int
    certificate_code: str | None = None
    completed_task_titles: list[str] = Field(default_factory=list)
