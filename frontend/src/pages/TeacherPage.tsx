import { BarChart3, BookPlus, Image, ListChecks, Plus, Save, Trash2, UsersRound, Video } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth";
import { Layout } from "../components/Layout";
import type {
  CourseDetail,
  CourseListItem,
  CourseMutation,
  LessonMutation,
  StudentProgress,
  TaskMutation,
  TaskType,
} from "../types";

type ChartPoint = {
  label: string;
  value: number;
};

const emptyCourse: CourseMutation = {
  title: "",
  description: "",
  direction: "Общие компетенции",
  level: "Базовый",
  duration_minutes: 45,
  image_url: "",
};

const emptyLesson: LessonMutation = {
  title: "",
  content: "",
  video_url: "",
  image_url: "",
  order_index: 1,
};

export function TeacherPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [courseForm, setCourseForm] = useState<CourseMutation>(emptyCourse);
  const [lessonForm, setLessonForm] = useState<LessonMutation>(emptyLesson);
  const [taskForm, setTaskForm] = useState(defaultTaskForm());
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const canEdit = user?.role === "teacher" || user?.role === "admin";

  async function loadCourses() {
    const loadedCourses = await api.courses();
    setCourses(loadedCourses);
    if (!selectedCourseId && loadedCourses[0]) {
      setSelectedCourseId(loadedCourses[0].id);
    }
  }

  async function loadCourse(courseId: number) {
    const [detail, progress] = await Promise.all([api.course(String(courseId)), api.courseStudents(courseId)]);
    setCourseDetail(detail);
    setStudents(progress);
    setSelectedLessonId((currentLessonId) => currentLessonId ?? detail.lessons[0]?.id ?? null);
    setCourseForm({
      title: detail.title,
      description: detail.description,
      direction: detail.direction,
      level: detail.level,
      duration_minutes: detail.duration_minutes,
      image_url: detail.image_url ?? "",
    });
    setLessonForm({ ...emptyLesson, order_index: detail.lessons.length + 1 });
  }

  useEffect(() => {
    void loadCourses().catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось загрузить курсы"));
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      void loadCourse(selectedCourseId).catch((error) =>
        setMessage(error instanceof Error ? error.message : "Не удалось загрузить курс"),
      );
    }
  }, [selectedCourseId]);

  const totalProgress = useMemo(() => {
    if (!students.length) return 0;
    return Math.round(students.reduce((sum, student) => sum + student.progress_percent, 0) / students.length);
  }, [students]);

  if (!canEdit) {
    return (
      <Layout>
        <div className="screen-loader">Кабинет доступен преподавателю или администратору</div>
      </Layout>
    );
  }

  async function saveCourse(event: FormEvent) {
    event.preventDefault();
    try {
      let targetCourseId = selectedCourseId;
      if (selectedCourseId) {
        await api.updateCourse(selectedCourseId, normalizeCourse(courseForm));
        setMessage("Курс обновлен");
      } else {
        const created = await api.createCourse(normalizeCourse(courseForm));
        targetCourseId = created.id;
        setSelectedCourseId(created.id);
        setMessage("Курс создан");
      }
      await loadCourses();
      if (targetCourseId) await loadCourse(targetCourseId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить курс");
    }
  }

  async function createLesson(event: FormEvent) {
    event.preventDefault();
    if (!selectedCourseId) return;
    try {
      const created = await api.createLesson(selectedCourseId, normalizeLesson(lessonForm));
      setLessonForm({ ...emptyLesson, order_index: lessonForm.order_index + 1 });
      await loadCourse(selectedCourseId);
      setSelectedLessonId(created.id);
      setMessage("Урок добавлен");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить урок");
    }
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    if (!selectedLessonId || !selectedCourseId) return;
    try {
      await api.createTask(selectedLessonId, normalizeTask(taskForm));
      setTaskForm(defaultTaskForm(taskForm.order_index + 1, taskForm.type));
      await loadCourse(selectedCourseId);
      setMessage("Задание добавлено");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось добавить задание");
    }
  }

  async function deleteSelectedCourse() {
    if (!selectedCourseId || !courseDetail) return;
    const shouldDelete = window.confirm(`Удалить курс "${courseDetail.title}"? Уроки, задания и прогресс по нему тоже будут удалены.`);
    if (!shouldDelete) return;

    try {
      await api.deleteCourse(selectedCourseId);
      setSelectedCourseId(null);
      setCourseDetail(null);
      setStudents([]);
      setSelectedLessonId(null);
      setCourseForm(emptyCourse);
      setLessonForm(emptyLesson);
      setMessage("Курс удален");
      await loadCourses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось удалить курс");
    }
  }

  return (
    <Layout>
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Роль преподавателя</span>
          <h1>Создание курсов, заданий и отслеживание прогресса</h1>
          <p>Добавляйте уроки, картинки, видео-ссылки и задания без технических настроек.</p>
        </div>
        <div className="summary-strip">
          <SummaryBox icon={<BookPlus size={20} />} label="Курсы" value={courses.length} />
          <SummaryBox icon={<UsersRound size={20} />} label="Студенты" value={students.length} />
          <SummaryBox icon={<BarChart3 size={20} />} label="Средний прогресс" value={`${totalProgress}%`} />
        </div>
      </section>

      {message && <div className="teacher-message">{message}</div>}

      <section className="teacher-grid">
        <div className="teacher-panel">
          <div className="section-heading">
            <h2>Курсы</h2>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setSelectedCourseId(null);
                setCourseDetail(null);
                setStudents([]);
                setCourseForm(emptyCourse);
                setSelectedLessonId(null);
              }}
            >
              <BookPlus size={18} />
              Новый
            </button>
          </div>
          <div className="teacher-list">
            {courses.map((course) => (
              <button
                className={course.id === selectedCourseId ? "teacher-list-item active" : "teacher-list-item"}
                key={course.id}
                type="button"
                onClick={() => setSelectedCourseId(course.id)}
              >
                <strong>{course.title}</strong>
                <span>{course.total_tasks} заданий</span>
              </button>
            ))}
          </div>
        </div>

        <form className="teacher-panel teacher-form" onSubmit={saveCourse}>
          <PanelTitle icon={<Save size={20} />} title={selectedCourseId ? "Редактировать курс" : "Новый курс"} />
          <Field label="Название" value={courseForm.title} onChange={(value) => setCourseForm({ ...courseForm, title: value })} />
          <Textarea
            label="Описание"
            value={courseForm.description}
            onChange={(value) => setCourseForm({ ...courseForm, description: value })}
          />
          <div className="form-row">
            <Field
              label="Направление"
              value={courseForm.direction}
              onChange={(value) => setCourseForm({ ...courseForm, direction: value })}
            />
            <Field label="Уровень" value={courseForm.level} onChange={(value) => setCourseForm({ ...courseForm, level: value })} />
          </div>
          <div className="form-row">
            <Field
              label="Минут"
              type="number"
              value={String(courseForm.duration_minutes)}
              onChange={(value) => setCourseForm({ ...courseForm, duration_minutes: Number(value) })}
            />
            <Field
              label="Картинка курса"
              value={courseForm.image_url ?? ""}
              onChange={(value) => setCourseForm({ ...courseForm, image_url: value })}
              icon={<Image size={16} />}
              required={false}
            />
          </div>
          <button className="primary-button" type="submit">
            <Save size={18} />
            Сохранить курс
          </button>
          {selectedCourseId && (
            <button className="danger-button" type="button" onClick={deleteSelectedCourse}>
              <Trash2 size={18} />
              Удалить курс
            </button>
          )}
        </form>

        <form className="teacher-panel teacher-form" onSubmit={createLesson}>
          <PanelTitle icon={<Video size={20} />} title="Добавить урок" />
          {!selectedCourseId && <p className="helper-text">Сначала создайте или выберите курс слева.</p>}
          <Field label="Название урока" value={lessonForm.title} onChange={(value) => setLessonForm({ ...lessonForm, title: value })} />
          <Textarea
            label="Описание и теория"
            value={lessonForm.content}
            onChange={(value) => setLessonForm({ ...lessonForm, content: value })}
          />
          <div className="form-row">
            <Field
              label="Видео-ссылка"
              value={lessonForm.video_url ?? ""}
              onChange={(value) => setLessonForm({ ...lessonForm, video_url: value })}
              icon={<Video size={16} />}
              required={false}
            />
            <Field
              label="Картинка урока"
              value={lessonForm.image_url ?? ""}
              onChange={(value) => setLessonForm({ ...lessonForm, image_url: value })}
              icon={<Image size={16} />}
              required={false}
            />
          </div>
          <Field
            label="Порядок"
            type="number"
            value={String(lessonForm.order_index)}
            onChange={(value) => setLessonForm({ ...lessonForm, order_index: Number(value) })}
          />
          <button className="primary-button" type="submit" disabled={!selectedCourseId}>
            <BookPlus size={18} />
            Добавить урок
          </button>
        </form>

        <form className="teacher-panel teacher-form task-builder" onSubmit={createTask}>
          <PanelTitle icon={<ListChecks size={20} />} title="Добавить задание" />
          <p className="helper-text">
            Задания показываются ученику по порядку. Следующее откроется только после правильного ответа.
          </p>

          <div className="builder-step">
            <span>1</span>
            <strong>Куда добавить</strong>
          </div>
          <label>
            Урок
            <select
              value={selectedLessonId ?? ""}
              onChange={(event) => setSelectedLessonId(Number(event.target.value))}
              required
            >
              <option value="" disabled>
                Выберите урок
              </option>
              {courseDetail?.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.order_index}. {lesson.title}
                </option>
              ))}
            </select>
          </label>

          <div className="builder-step">
            <span>2</span>
            <strong>Тип задания</strong>
          </div>
          <div className="task-type-grid">
            <TaskTypeButton
              active={taskForm.type === "quiz"}
              description="Вопрос и несколько вариантов"
              label="Квиз"
              onClick={() => setTaskForm(defaultTaskForm(taskForm.order_index, "quiz"))}
            />
            <TaskTypeButton
              active={taskForm.type === "chart"}
              description="График, ответ кликом"
              label="График"
              onClick={() => setTaskForm(defaultTaskForm(taskForm.order_index, "chart"))}
            />
            <TaskTypeButton
              active={taskForm.type === "rebus"}
              description="Ребус и текстовый ответ"
              label="Ребус"
              onClick={() => setTaskForm(defaultTaskForm(taskForm.order_index, "rebus"))}
            />
          </div>

          <div className="builder-step">
            <span>3</span>
            <strong>Содержание</strong>
          </div>
          <Field label="Название" value={taskForm.title} onChange={(value) => setTaskForm({ ...taskForm, title: value })} />
          <Textarea label="Вопрос для ученика" value={taskForm.prompt} onChange={(value) => setTaskForm({ ...taskForm, prompt: value })} />
          <TaskPayloadFields taskForm={taskForm} setTaskForm={setTaskForm} />

          <div className="builder-step">
            <span>4</span>
            <strong>Дополнительно</strong>
          </div>
          <div className="form-row">
            <Field
              label="Картинка задания"
              value={taskForm.image_url ?? ""}
              onChange={(value) => setTaskForm({ ...taskForm, image_url: value })}
              icon={<Image size={16} />}
              required={false}
            />
            <Field
              label="Порядок"
              type="number"
              value={String(taskForm.order_index)}
              onChange={(value) => setTaskForm({ ...taskForm, order_index: Number(value) })}
            />
          </div>

          <TaskPreview taskForm={taskForm} />

          <button className="primary-button" type="submit" disabled={!selectedLessonId}>
            <ListChecks size={18} />
            Добавить задание
          </button>
        </form>

        <div className="teacher-panel progress-panel">
          <PanelTitle icon={<UsersRound size={20} />} title="Прогресс студентов" />
          {students.map((student) => (
            <div className="student-progress" key={student.user_id}>
              <div>
                <strong>{student.full_name}</strong>
                <span>{student.email}</span>
              </div>
              <span>{student.progress_percent}%</span>
              <div className="progress-line">
                <span style={{ width: `${student.progress_percent}%` }} />
              </div>
              {student.certificate_code && <small>Сертификат: {student.certificate_code}</small>}
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}

function defaultTaskForm(orderIndex = 1, type: TaskType = "quiz"): TaskMutation {
  if (type === "chart") {
    return {
      type,
      title: "Найди самый высокий показатель",
      prompt: "Посмотри на график и выбери правильный вариант.",
      payload: { points: [{ label: "Январь", value: 10 }, { label: "Февраль", value: 20 }] },
      correct_answer: "Февраль",
      image_url: "",
      order_index: orderIndex,
    };
  }
  if (type === "rebus") {
    return {
      type,
      title: "Ребус",
      prompt: "Разгадай термин.",
      payload: { clue: "ИН + ФО", hint: "Подсказка для ученика" },
      correct_answer: "Инфо",
      image_url: "",
      order_index: orderIndex,
    };
  }
  return {
    type,
    title: "Квиз",
    prompt: "Выбери правильный вариант.",
    payload: { options: ["Вариант 1", "Вариант 2", "Вариант 3"] },
    correct_answer: "Вариант 1",
    image_url: "",
    order_index: orderIndex,
  };
}

function normalizeCourse(payload: CourseMutation): CourseMutation {
  return { ...payload, image_url: payload.image_url?.trim() || null };
}

function normalizeLesson(payload: LessonMutation): LessonMutation {
  return {
    ...payload,
    video_url: payload.video_url?.trim() || null,
    image_url: payload.image_url?.trim() || null,
  };
}

function normalizeTask(payload: TaskMutation): TaskMutation {
  return { ...payload, image_url: payload.image_url?.trim() || null };
}

function getOptions(taskForm: TaskMutation): string[] {
  return Array.isArray(taskForm.payload.options) ? taskForm.payload.options.map(String) : [];
}

function getPoints(taskForm: TaskMutation): ChartPoint[] {
  return Array.isArray(taskForm.payload.points) ? (taskForm.payload.points as ChartPoint[]) : [];
}

function SummaryBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="summary-item">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="panel-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function TaskTypeButton({
  active,
  description,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "task-type-card active" : "task-type-card"} type="button" onClick={onClick}>
      <strong>{label}</strong>
      <span>{description}</span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  icon,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <span className={icon ? "input-with-icon" : undefined}>
        {icon}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
      </span>
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

function TaskPayloadFields({
  taskForm,
  setTaskForm,
}: {
  taskForm: TaskMutation;
  setTaskForm: (value: TaskMutation) => void;
}) {
  if (taskForm.type === "chart") {
    const points = getPoints(taskForm);
    return (
      <div className="specific-fields">
        <p className="helper-text">Добавьте подписи и числа. Ученик увидит график и выберет одну из подписей.</p>
        {points.map((point, index) => (
          <div className="option-editor-row" key={`${point.label}-${index}`}>
            <input
              value={point.label}
              onChange={(event) => {
                const nextPoints = points.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, label: event.target.value } : item,
                );
                setTaskForm({
                  ...taskForm,
                  payload: { points: nextPoints },
                  correct_answer: taskForm.correct_answer === point.label ? event.target.value : taskForm.correct_answer,
                });
              }}
              placeholder="Подпись"
              required
            />
            <input
              type="number"
              value={String(point.value)}
              onChange={(event) => {
                const nextPoints = points.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, value: Number(event.target.value) } : item,
                );
                setTaskForm({ ...taskForm, payload: { points: nextPoints } });
              }}
              placeholder="Значение"
              required
            />
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                const nextPoints = points.filter((_, itemIndex) => itemIndex !== index);
                setTaskForm({
                  ...taskForm,
                  payload: { points: nextPoints },
                  correct_answer: nextPoints[0]?.label ?? "",
                });
              }}
              title="Удалить точку"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            setTaskForm({
              ...taskForm,
              payload: { points: [...points, { label: `Вариант ${points.length + 1}`, value: 0 }] },
            })
          }
        >
          <Plus size={18} />
          Добавить точку
        </button>
        <label>
          Правильный ответ
          <select
            value={taskForm.correct_answer}
            onChange={(event) => setTaskForm({ ...taskForm, correct_answer: event.target.value })}
            required
          >
            {points.map((point) => (
              <option key={point.label} value={point.label}>
                {point.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (taskForm.type === "rebus") {
    return (
      <div className="specific-fields">
        <p className="helper-text">Ребус показывается крупно. Ответ ученик вводит вручную.</p>
        <div className="form-row">
          <Field
            label="Текст ребуса"
            value={String(taskForm.payload.clue ?? "")}
            onChange={(value) => setTaskForm({ ...taskForm, payload: { ...taskForm.payload, clue: value } })}
          />
          <Field
            label="Подсказка"
            value={String(taskForm.payload.hint ?? "")}
            onChange={(value) => setTaskForm({ ...taskForm, payload: { ...taskForm.payload, hint: value } })}
          />
        </div>
        <Field
          label="Правильный ответ"
          value={taskForm.correct_answer}
          onChange={(value) => setTaskForm({ ...taskForm, correct_answer: value })}
        />
      </div>
    );
  }

  const options = getOptions(taskForm);
  return (
    <div className="specific-fields">
      <p className="helper-text">Варианты станут кнопками. Правильный ответ выбирается из списка ниже.</p>
      {options.map((option, index) => (
        <div className="option-editor-row" key={`${option}-${index}`}>
          <input
            value={option}
            onChange={(event) => {
              const nextOptions = options.map((item, itemIndex) => (itemIndex === index ? event.target.value : item));
              setTaskForm({
                ...taskForm,
                payload: { options: nextOptions },
                correct_answer: taskForm.correct_answer === option ? event.target.value : taskForm.correct_answer,
              });
            }}
            placeholder={`Вариант ${index + 1}`}
            required
          />
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              const nextOptions = options.filter((_, itemIndex) => itemIndex !== index);
              setTaskForm({
                ...taskForm,
                payload: { options: nextOptions },
                correct_answer: nextOptions[0] ?? "",
              });
            }}
            title="Удалить вариант"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        className="secondary-button"
        type="button"
        onClick={() =>
          setTaskForm({
            ...taskForm,
            payload: { options: [...options, `Вариант ${options.length + 1}`] },
          })
        }
      >
        <Plus size={18} />
        Добавить вариант
      </button>
      <label>
        Правильный ответ
        <select
          value={taskForm.correct_answer}
          onChange={(event) => setTaskForm({ ...taskForm, correct_answer: event.target.value })}
          required
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function TaskPreview({ taskForm }: { taskForm: TaskMutation }) {
  const options = getOptions(taskForm);
  const points = getPoints(taskForm);
  return (
    <div className="task-preview">
      <span>Предпросмотр</span>
      <strong>{taskForm.title || "Название задания"}</strong>
      <p>{taskForm.prompt || "Вопрос для ученика"}</p>
      {taskForm.type === "quiz" && (
        <div className="preview-options">
          {options.map((option) => (
            <button key={option} type="button">
              {option}
            </button>
          ))}
        </div>
      )}
      {taskForm.type === "chart" && (
        <div className="preview-bars">
          {points.map((point) => (
            <div key={point.label}>
              <span style={{ height: `${Math.max(12, Math.min(100, point.value * 4))}px` }} />
              <small>{point.label}</small>
            </div>
          ))}
        </div>
      )}
      {taskForm.type === "rebus" && (
        <div className="preview-rebus">
          <strong>{String(taskForm.payload.clue ?? "")}</strong>
          <small>{String(taskForm.payload.hint ?? "")}</small>
        </div>
      )}
    </div>
  );
}
