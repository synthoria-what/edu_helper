import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bold,
  BookPlus,
  CheckCircle2,
  Image,
  Italic,
  Lightbulb,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  UsersRound,
  Video,
  X,
  Underline,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../api";
import { Layout } from "../components/Layout";
import { formatTaskCount } from "../format";
import { normalizeVideoUrl } from "../video";
import type {
  CourseDetail,
  CourseListItem,
  CourseMutation,
  LessonMutation,
  StudentProgress,
  Task,
  TaskMutation,
  TaskType,
} from "../types";

type ChartPoint = {
  label: string;
  value: number;
};

type ManagerPanel = "lessons" | "tasks" | "progress";

const COURSE_DIRECTIONS = [
  "Общие компетенции",
  "Программирование",
  "Аналитика",
  "Дизайн",
  "Маркетинг",
  "Бизнес",
  "Иностранные языки",
  "Soft skills",
];

const COURSE_LEVELS = ["Базовый", "Средний", "Продвинутый"];

const emptyCourse: CourseMutation = {
  title: "",
  description: "",
  description_html: "",
  learning_goals: [],
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
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [courseForm, setCourseForm] = useState<CourseMutation>(emptyCourse);
  const [lessonForm, setLessonForm] = useState<LessonMutation>(emptyLesson);
  const [taskForm, setTaskForm] = useState(defaultTaskForm());
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isCourseFormOpen, setIsCourseFormOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ManagerPanel>("lessons");

  async function loadCourses(preferredCourseId?: number | null) {
    const loadedCourses = await api.myCourses();
    setCourses(loadedCourses);
    if (preferredCourseId !== undefined) {
      setSelectedCourseId(preferredCourseId ?? null);
    }
  }

  function notify(text: string) {
    setMessage(text);
  }

  function openNewCourseForm() {
    setSelectedCourseId(null);
    setCourseDetail(null);
    setStudents([]);
    setCourseForm(emptyCourse);
    setSelectedLessonId(null);
    setEditingLessonId(null);
    setEditingTaskId(null);
    setIsLessonFormOpen(false);
    setIsTaskFormOpen(false);
    setLessonForm(emptyLesson);
    setTaskForm(defaultTaskForm());
    setIsCourseFormOpen(true);
  }

  function selectCourse(courseId: number) {
    setSelectedCourseId(courseId);
    setIsCourseFormOpen(false);
    setActivePanel("lessons");
    setEditingLessonId(null);
    setEditingTaskId(null);
    setIsLessonFormOpen(false);
    setIsTaskFormOpen(false);
  }

  function closeCourseForm() {
    if (courseDetail) {
      setCourseForm({
        title: courseDetail.title,
        description: courseDetail.description,
        description_html: courseDetail.description_html,
        learning_goals: courseDetail.learning_goals,
        direction: courseDetail.direction,
        level: courseDetail.level,
        duration_minutes: courseDetail.duration_minutes,
        image_url: courseDetail.image_url ?? "",
      });
    } else {
      setCourseForm(emptyCourse);
    }
    setIsCourseFormOpen(false);
  }

  async function loadCourse(courseId: number) {
    const [detail, progress] = await Promise.all([api.course(String(courseId)), api.courseStudents(courseId)]);
    setCourseDetail(detail);
    setStudents(progress);
    setSelectedLessonId((currentLessonId) =>
      detail.lessons.some((lesson) => lesson.id === currentLessonId) ? currentLessonId : detail.lessons[0]?.id ?? null,
    );
    setCourseForm({
      title: detail.title,
      description: detail.description,
      description_html: detail.description_html,
      learning_goals: detail.learning_goals,
      direction: detail.direction,
      level: detail.level,
      duration_minutes: detail.duration_minutes,
      image_url: detail.image_url ?? "",
    });
    setLessonForm({ ...emptyLesson, order_index: detail.lessons.length + 1 });
  }

  function openNewLessonForm() {
    setEditingLessonId(null);
    setLessonForm({ ...emptyLesson, order_index: (courseDetail?.lessons.length ?? 0) + 1 });
    setIsLessonFormOpen(true);
  }

  function editLesson(lessonId: number) {
    const lesson = courseDetail?.lessons.find((item) => item.id === lessonId);
    if (!lesson) return;
    setSelectedLessonId(lesson.id);
    setEditingLessonId(lesson.id);
    setIsLessonFormOpen(true);
    setLessonForm({
      title: lesson.title,
      content: lesson.content,
      video_url: lesson.video_url ?? "",
      image_url: lesson.image_url ?? "",
      order_index: lesson.order_index,
    });
  }

  function openTaskBuilder(lessonId: number) {
    setSelectedLessonId(lessonId);
    setActivePanel("tasks");
    openNewTaskForm(lessonId);
  }

  function selectTaskLesson(lessonId: number) {
    setSelectedLessonId(lessonId);
    setEditingTaskId(null);
    setIsTaskFormOpen(false);
    setTaskForm(defaultTaskForm(getNextTaskOrder(lessonId), taskForm.type));
  }

  function cancelLessonEdit() {
    setEditingLessonId(null);
    setIsLessonFormOpen(false);
    setLessonForm({ ...emptyLesson, order_index: (courseDetail?.lessons.length ?? 0) + 1 });
  }

  function editTask(lessonId: number, task: Task) {
    setSelectedLessonId(lessonId);
    setActivePanel("tasks");
    setEditingTaskId(task.id);
    setIsTaskFormOpen(true);
    setTaskForm({
      type: task.type,
      title: task.title,
      prompt: task.prompt,
      payload: task.payload,
      correct_answer: task.correct_answer ?? "",
      image_url: task.image_url ?? "",
      order_index: task.order_index,
    });
  }

  function openNewTaskForm(lessonId = selectedLessonId) {
    if (!lessonId) return;
    setEditingTaskId(null);
    setIsTaskFormOpen(true);
    setTaskForm(defaultTaskForm(getNextTaskOrder(lessonId), taskForm.type));
  }

  function closeTaskForm() {
    setEditingTaskId(null);
    setIsTaskFormOpen(false);
    setTaskForm(defaultTaskForm(getNextTaskOrder(), taskForm.type));
  }

  function getNextTaskOrder(lessonId = selectedLessonId): number {
    const lesson = courseDetail?.lessons.find((item) => item.id === lessonId);
    return (lesson?.tasks.length ?? 0) + 1;
  }

  useEffect(() => {
    void loadCourses().catch((error) => notify(error instanceof Error ? error.message : "Не удалось загрузить курсы"));
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      void loadCourse(selectedCourseId).catch((error) =>
        notify(error instanceof Error ? error.message : "Не удалось загрузить курс"),
      );
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (!message) return;
    const timerId = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timerId);
  }, [message]);

  const totalProgress = useMemo(() => {
    if (!students.length) return 0;
    return Math.round(students.reduce((sum, student) => sum + student.progress_percent, 0) / students.length);
  }, [students]);

  async function saveCourse(event: FormEvent) {
    event.preventDefault();
    try {
      let targetCourseId = selectedCourseId;
      if (selectedCourseId) {
        await api.updateCourse(selectedCourseId, normalizeCourse(courseForm));
        notify("Курс обновлен");
      } else {
        const created = await api.createCourse(normalizeCourse(courseForm));
        targetCourseId = created.id;
        setSelectedCourseId(created.id);
        notify("Курс создан");
      }
      await loadCourses(targetCourseId);
      if (targetCourseId) await loadCourse(targetCourseId);
      setIsCourseFormOpen(false);
      setActivePanel("lessons");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось сохранить курс");
    }
  }

  async function saveLesson(event: FormEvent) {
    event.preventDefault();
    if (!selectedCourseId) return;
    try {
      if (editingLessonId) {
        const updated = await api.updateLesson(editingLessonId, normalizeLesson(lessonForm));
        await loadCourse(selectedCourseId);
        setSelectedLessonId(updated.id);
        setEditingLessonId(null);
        setIsLessonFormOpen(false);
        notify("Урок обновлен");
      } else {
        const created = await api.createLesson(selectedCourseId, normalizeLesson(lessonForm));
        setLessonForm({ ...emptyLesson, order_index: lessonForm.order_index + 1 });
        await loadCourse(selectedCourseId);
        setSelectedLessonId(created.id);
        setIsLessonFormOpen(false);
        setActivePanel("tasks");
        notify("Урок добавлен. Теперь можно добавить задание к нему");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось сохранить урок");
    }
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault();
    if (!selectedLessonId || !selectedCourseId) return;
    try {
      if (editingTaskId) {
        await api.updateTask(editingTaskId, normalizeTask(taskForm));
        setEditingTaskId(null);
        notify("Задание обновлено");
      } else {
        await api.createTask(selectedLessonId, normalizeTask(taskForm));
        notify("Задание добавлено");
      }
      await loadCourse(selectedCourseId);
      setIsTaskFormOpen(false);
      setTaskForm(defaultTaskForm(editingTaskId ? getNextTaskOrder() : taskForm.order_index + 1, taskForm.type));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось сохранить задание");
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
      setEditingLessonId(null);
      setEditingTaskId(null);
      setIsLessonFormOpen(false);
      setIsTaskFormOpen(false);
      setCourseForm(emptyCourse);
      setLessonForm(emptyLesson);
      setIsCourseFormOpen(false);
      notify("Курс удален");
      await loadCourses(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось удалить курс");
    }
  }

  async function deleteLesson(lessonId: number) {
    if (!selectedCourseId) return;
    const lesson = courseDetail?.lessons.find((item) => item.id === lessonId);
    if (!lesson) return;

    const shouldDelete = window.confirm(`Удалить урок "${lesson.title}"? Задания и прогресс по ним тоже будут удалены.`);
    if (!shouldDelete) return;

    try {
      await api.deleteLesson(lessonId);
      if (editingLessonId === lessonId) {
        setEditingLessonId(null);
        setIsLessonFormOpen(false);
        setLessonForm({ ...emptyLesson, order_index: (courseDetail?.lessons.length ?? 1) });
      }
      setEditingTaskId(null);
      setIsTaskFormOpen(false);
      await loadCourse(selectedCourseId);
      notify("Урок удален");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось удалить урок");
    }
  }

  async function deleteTask(taskId: number) {
    if (!selectedCourseId) return;
    const task = courseDetail?.lessons.flatMap((lesson) => lesson.tasks).find((item) => item.id === taskId);
    if (!task) return;

    const shouldDelete = window.confirm(`Удалить задание "${task.title}"? Прогресс участников по нему тоже будет удален.`);
    if (!shouldDelete) return;

    try {
      await api.deleteTask(taskId);
      if (editingTaskId === taskId) {
        setEditingTaskId(null);
        setIsTaskFormOpen(false);
        setTaskForm(defaultTaskForm(getNextTaskOrder(), taskForm.type));
      }
      await loadCourse(selectedCourseId);
      notify("Задание удалено");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось удалить задание");
    }
  }

  return (
    <Layout>
      <section className="dashboard-hero teacher-hero">
        <div>
          <span className="eyebrow">Авторский кабинет</span>
          <h1>Мои курсы, задания и прогресс участников</h1>
          <p>Создавайте курсы в формате Stepik: уроки, материалы, задания и учебная карточка.</p>
        </div>
        <div className="summary-strip">
          <SummaryBox icon={<BookPlus size={20} />} label="Курсы" value={courses.length} />
          <SummaryBox icon={<UsersRound size={20} />} label="Участники" value={students.length} />
          <SummaryBox icon={<BarChart3 size={20} />} label="Средний прогресс" value={`${totalProgress}%`} />
        </div>
      </section>

      {message && (
        <div className="teacher-toast">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      <section className="teacher-workspace">
        <aside className="teacher-panel course-list-panel">
          <div className="section-heading">
            <div>
              <h2>Курсы</h2>
              <span>Здесь видны только ваши курсы</span>
            </div>
            <button className="primary-button" type="button" onClick={openNewCourseForm}>
              <Plus size={18} />
              Добавить
            </button>
          </div>

          <div className="teacher-list">
            {courses.length ? (
              courses.map((course) => (
                <button
                  className={course.id === selectedCourseId ? "teacher-list-item active" : "teacher-list-item"}
                  key={course.id}
                  type="button"
                  onClick={() => selectCourse(course.id)}
                >
                  <strong>{course.title}</strong>
                  <span>{course.direction}</span>
                  <small>
                    {formatTaskCount(course.total_tasks)} · {course.duration_minutes} мин.
                  </small>
                </button>
              ))
            ) : (
              <div className="empty-state compact">
                <BookPlus size={24} />
                <strong>Курсов пока нет</strong>
                <span>Нажмите "Добавить", чтобы создать первый курс.</span>
              </div>
            )}
          </div>
        </aside>

        <div className="teacher-main-panel">
          {isCourseFormOpen && (
            <form className="teacher-panel teacher-form course-editor-panel" onSubmit={saveCourse}>
              <PanelTitle icon={<Save size={20} />} title={selectedCourseId ? "Редактировать курс" : "Новый курс"} />
              <p className="helper-text">Заполните базовую карточку курса. Уроки и задания появятся отдельными шагами после сохранения.</p>
              <Field label="Название" value={courseForm.title} onChange={(value) => setCourseForm({ ...courseForm, title: value })} />
              <RichTextEditor
                label="Описание курса"
                value={courseForm.description_html}
                onChange={(value) => setCourseForm({ ...courseForm, description_html: value, description: makeCourseExcerpt(value, courseForm.description) })}
                onError={notify}
              />
              <LearningGoalsEditor
                goals={courseForm.learning_goals}
                onChange={(learningGoals) => setCourseForm({ ...courseForm, learning_goals: learningGoals })}
              />
              <div className="form-row">
                <CourseDirectionsPicker
                  value={splitCourseDirections(courseForm.direction)}
                  onChange={(directions) => setCourseForm({ ...courseForm, direction: formatCourseDirections(directions) })}
                />
                <CourseLevelSelect value={courseForm.level} onChange={(level) => setCourseForm({ ...courseForm, level })} />
              </div>
              <Field
                label="Минут"
                type="number"
                value={String(courseForm.duration_minutes)}
                onChange={(value) => setCourseForm({ ...courseForm, duration_minutes: Number(value) })}
              />
              <div className="form-row">
                <ImageUrlUploadField
                  label="Картинка курса"
                  imageUrl={courseForm.image_url ?? ""}
                  onChange={(value) => setCourseForm({ ...courseForm, image_url: value })}
                  onError={notify}
                />
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  <Save size={18} />
                  Сохранить курс
                </button>
                <button className="secondary-button" type="button" onClick={closeCourseForm}>
                  Отмена
                </button>
              </div>
            </form>
          )}

          {!isCourseFormOpen && !courseDetail && (
            <div className="teacher-panel teacher-start-panel">
              <PanelTitle icon={<Lightbulb size={20} />} title="С чего начать" />
              <div className="teacher-steps">
                <div>
                  <span>1</span>
                  <strong>Выберите курс слева</strong>
                  <p>Откроются отдельные разделы: уроки, задания и прогресс участников.</p>
                </div>
                <div>
                  <span>2</span>
                  <strong>Или создайте новый</strong>
                  <p>Кнопка "Добавить" откроет только форму курса, без лишних полей на экране.</p>
                </div>
                <div>
                  <span>3</span>
                  <strong>Двигайтесь по шагам</strong>
                  <p>Сначала урок, затем задания внутри выбранного урока.</p>
                </div>
              </div>
            </div>
          )}

          {!isCourseFormOpen && courseDetail && (
            <div className="course-manager">
              <div className="teacher-panel course-manager-header">
                <div>
                  <span className="eyebrow">{courseDetail.direction}</span>
                  <h2>{courseDetail.title}</h2>
                  <p>{courseDetail.description}</p>
                </div>
                <div className="course-manager-actions">
                  <button className="secondary-button" type="button" onClick={() => setIsCourseFormOpen(true)}>
                    <Pencil size={18} />
                    Редактировать
                  </button>
                  <button className="danger-button" type="button" onClick={deleteSelectedCourse}>
                    <Trash2 size={18} />
                    Удалить
                  </button>
                </div>
                <div className="summary-strip compact">
                  <SummaryBox icon={<Video size={20} />} label="Уроки" value={courseDetail.lessons.length} />
                  <SummaryBox icon={<ListChecks size={20} />} label="Задания" value={courseDetail.total_tasks} />
                  <SummaryBox icon={<UsersRound size={20} />} label="Участники" value={students.length} />
                </div>
              </div>

              <div className="manager-tabs">
                <button className={activePanel === "lessons" ? "manager-tab active" : "manager-tab"} type="button" onClick={() => setActivePanel("lessons")}>
                  <Video size={18} />
                  Уроки
                </button>
                <button className={activePanel === "tasks" ? "manager-tab active" : "manager-tab"} type="button" onClick={() => setActivePanel("tasks")}>
                  <ListChecks size={18} />
                  Задания
                </button>
                <button className={activePanel === "progress" ? "manager-tab active" : "manager-tab"} type="button" onClick={() => setActivePanel("progress")}>
                  <BarChart3 size={18} />
                  Прогресс
                </button>
              </div>

              {activePanel === "lessons" && (
                <div className="teacher-panel manager-section">
                  <div className="section-heading lesson-section-heading">
                    <PanelTitle icon={<Video size={20} />} title="Уроки курса" />
                    <button className="secondary-button lesson-add-button" type="button" onClick={openNewLessonForm}>
                      <Plus size={18} />
                      Добавить урок
                    </button>
                  </div>
                  <div className="lesson-module-grid">
                    {courseDetail.lessons.length ? (
                      courseDetail.lessons.map((lesson) => (
                        <div className={lesson.id === selectedLessonId ? "lesson-module active" : "lesson-module"} key={lesson.id}>
                          <button className="lesson-module-main" type="button" onClick={() => setSelectedLessonId(lesson.id)}>
                            <span className="lesson-module-number">Модуль {lesson.order_index}</span>
                            <strong>{lesson.title}</strong>
                            <p>{lesson.content}</p>
                          </button>
                          <div className="lesson-module-meta">
                            <span>{formatTaskCount(lesson.tasks.length)}</span>
                            {lesson.video_url && <span>Видео добавлено</span>}
                            {lesson.image_url && <span>Картинка добавлена</span>}
                          </div>
                          <div className="lesson-module-actions">
                            <button className="secondary-button" type="button" onClick={() => editLesson(lesson.id)}>
                              <Pencil size={18} />
                              Редактировать
                            </button>
                            <button className="secondary-button" type="button" onClick={() => openTaskBuilder(lesson.id)}>
                              <Plus size={18} />
                              Добавить задание
                            </button>
                            <button className="danger-button" type="button" onClick={() => deleteLesson(lesson.id)}>
                              <Trash2 size={18} />
                              Удалить
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <Video size={24} />
                        <strong>Уроков пока нет</strong>
                        <span>Добавьте первый модуль курса. После этого можно будет создавать задания внутри него.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activePanel === "tasks" && (
                <div className="teacher-panel manager-section task-builder">
                  <div className="section-heading lesson-section-heading">
                    <PanelTitle icon={<ListChecks size={20} />} title="Задания" />
                    <button className="secondary-button lesson-add-button" type="button" onClick={() => openNewTaskForm()} disabled={!selectedLessonId}>
                      <Plus size={18} />
                      Добавить задание
                    </button>
                  </div>
                  <p className="helper-text">Выберите урок, тип задания и заполните только нужные поля. После сохранения задание сразу появится у пользователей в этом уроке.</p>

                  {!courseDetail.lessons.length && <p className="form-error">Сначала добавьте хотя бы один урок во вкладке "Уроки".</p>}

                  <div className="task-lesson-grid">
                    {courseDetail.lessons.map((lesson) => (
                      <button
                        className={lesson.id === selectedLessonId ? "task-lesson-card active" : "task-lesson-card"}
                        disabled={Boolean(editingTaskId)}
                        key={lesson.id}
                        type="button"
                        onClick={() => selectTaskLesson(lesson.id)}
                      >
                        <span>Модуль {lesson.order_index}</span>
                        <strong>{lesson.title}</strong>
                        <small>{formatTaskCount(lesson.tasks.length)}</small>
                      </button>
                    ))}
                  </div>

                  {selectedLessonId && (
                    <div className="task-editor-list">
                      {courseDetail.lessons.find((lesson) => lesson.id === selectedLessonId)?.tasks.length ? (
                        courseDetail.lessons
                          .find((lesson) => lesson.id === selectedLessonId)
                          ?.tasks.map((task) => (
                            <div className={task.id === editingTaskId ? "task-editor-item active" : "task-editor-item"} key={task.id}>
                              <div>
                                <span>{task.order_index}. {task.type}</span>
                                <strong>{task.title}</strong>
                              </div>
                              <div className="task-editor-actions">
                                <button className="secondary-button" type="button" onClick={() => editTask(selectedLessonId, task)}>
                                  <Pencil size={18} />
                                  Редактировать
                                </button>
                                <button className="danger-button" type="button" onClick={() => deleteTask(task.id)}>
                                  <Trash2 size={18} />
                                  Удалить
                                </button>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="empty-state compact">
                          <ListChecks size={24} />
                          <strong>Заданий пока нет</strong>
                          <span>Нажмите "Добавить задание", чтобы создать первое задание для выбранного урока.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activePanel === "progress" && (
                <div className="teacher-panel manager-section progress-panel">
                  <PanelTitle icon={<UsersRound size={20} />} title="Прогресс участников" />
                  {!students.length && <p className="helper-text">Когда пользователи начнут проходить курс, здесь появятся выполненные задания и сертификаты.</p>}
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
                      {student.completed_task_titles.length > 0 && (
                        <small>Выполнено: {student.completed_task_titles.join(", ")}</small>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {isLessonFormOpen && (
        <EditorModal title={editingLessonId ? "Редактировать урок" : "Добавить урок"} onClose={cancelLessonEdit}>
          <form className="teacher-form editor-modal-form" onSubmit={saveLesson}>
            <p className="helper-text">YouTube и Rutube можно вставлять обычной ссылкой. При сохранении она станет ссылкой для встраивания.</p>
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
              <ImageUrlUploadField
                label="Картинка урока"
                imageUrl={lessonForm.image_url ?? ""}
                onChange={(value) => setLessonForm({ ...lessonForm, image_url: value })}
                onError={notify}
              />
            </div>
            <Field
              label="Порядок"
              type="number"
              value={String(lessonForm.order_index)}
              onChange={(value) => setLessonForm({ ...lessonForm, order_index: Number(value) })}
            />
            <div className="form-actions">
              <button className="primary-button" type="submit">
                <BookPlus size={18} />
                {editingLessonId ? "Сохранить урок" : "Добавить урок"}
              </button>
              <button className="secondary-button" type="button" onClick={cancelLessonEdit}>
                Отмена
              </button>
            </div>
          </form>
        </EditorModal>
      )}

      {isTaskFormOpen && (
        <EditorModal title={editingTaskId ? "Редактировать задание" : "Добавить задание"} onClose={closeTaskForm}>
          <form className="teacher-form editor-modal-form" onSubmit={saveTask}>
            <div className="builder-step">
              <span>1</span>
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
                description="Картинка и текстовый ответ"
                label="Ребус"
                onClick={() => setTaskForm(defaultTaskForm(taskForm.order_index, "rebus"))}
              />
              <TaskTypeButton
                active={taskForm.type === "multi_choice"}
                description="Можно выбрать несколько вариантов"
                label="Несколько ответов"
                onClick={() => setTaskForm(defaultTaskForm(taskForm.order_index, "multi_choice"))}
              />
              <TaskTypeButton
                active={taskForm.type === "text_input"}
                description="Короткий ручной ответ"
                label="Текст"
                onClick={() => setTaskForm(defaultTaskForm(taskForm.order_index, "text_input"))}
              />
              <TaskTypeButton
                active={taskForm.type === "order"}
                description="Последовательность элементов"
                label="Порядок"
                onClick={() => setTaskForm(defaultTaskForm(taskForm.order_index, "order"))}
              />
            </div>

            <div className="builder-step">
              <span>2</span>
              <strong>Содержание</strong>
            </div>
            <Field label="Название" value={taskForm.title} onChange={(value) => setTaskForm({ ...taskForm, title: value })} />
            <Textarea label="Вопрос для ученика" value={taskForm.prompt} onChange={(value) => setTaskForm({ ...taskForm, prompt: value })} />
            <TaskPayloadFields taskForm={taskForm} setTaskForm={setTaskForm} onError={notify} />

            <div className="builder-step">
              <span>3</span>
              <strong>Дополнительно</strong>
            </div>
            <div className="form-row">
              {taskForm.type !== "rebus" && (
                <ImageUrlUploadField
                  label="Картинка задания"
                  imageUrl={taskForm.image_url ?? ""}
                  onChange={(value) => setTaskForm({ ...taskForm, image_url: value })}
                  onError={notify}
                />
              )}
              <Field
                label="Порядок"
                type="number"
                value={String(taskForm.order_index)}
                onChange={(value) => setTaskForm({ ...taskForm, order_index: Number(value) })}
              />
            </div>

            <TaskPreview taskForm={taskForm} />

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={!selectedLessonId}>
                <ListChecks size={18} />
                {editingTaskId ? "Сохранить задание" : "Добавить задание"}
              </button>
              <button className="secondary-button" type="button" onClick={closeTaskForm}>
                Отмена
              </button>
            </div>
          </form>
        </EditorModal>
      )}
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
      prompt: "Разгадай слово по картинке.",
      payload: { hint: "" },
      correct_answer: "Ответ",
      image_url: "",
      order_index: orderIndex,
    };
  }
  if (type === "multi_choice") {
    return {
      type,
      title: "Несколько правильных ответов",
      prompt: "Выбери все подходящие варианты.",
      payload: { options: ["Вариант 1", "Вариант 2", "Вариант 3"], correct_answers: ["Вариант 1", "Вариант 2"] },
      correct_answer: "Вариант 1|Вариант 2",
      image_url: "",
      order_index: orderIndex,
    };
  }
  if (type === "text_input") {
    return {
      type,
      title: "Короткий ответ",
      prompt: "Введи правильный ответ.",
      payload: {},
      correct_answer: "Ответ",
      image_url: "",
      order_index: orderIndex,
    };
  }
  if (type === "order") {
    return {
      type,
      title: "Расставь по порядку",
      prompt: "Перемести элементы в правильной последовательности.",
      payload: { items: ["Первый шаг", "Второй шаг", "Третий шаг"] },
      correct_answer: "Первый шаг|Второй шаг|Третий шаг",
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
  const description = makeCourseExcerpt(payload.description_html, payload.description);
  const direction = formatCourseDirections(splitCourseDirections(payload.direction)) || COURSE_DIRECTIONS[0];
  return {
    ...payload,
    description,
    description_html: payload.description_html?.trim() || `<p>${escapeHtml(description)}</p>`,
    learning_goals: payload.learning_goals.map((goal) => goal.trim()).filter(Boolean),
    direction,
    level: payload.level.trim() || COURSE_LEVELS[0],
    image_url: payload.image_url?.trim() || null,
  };
}

function splitCourseDirections(value: string): string[] {
  return value.split(",").map((direction) => direction.trim()).filter(Boolean);
}

function formatCourseDirections(directions: string[]): string {
  return Array.from(new Set(directions.map((direction) => direction.trim()).filter(Boolean))).join(", ");
}

function makeCourseExcerpt(html: string, fallback: string): string {
  const plainText = htmlToPlainText(html).trim() || fallback.trim();
  const normalized = plainText.replace(/\s+/g, " ");
  if (normalized.length >= 10) {
    return normalized.slice(0, 320);
  }
  return normalized || "Описание курса";
}

function htmlToPlainText(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(html || "", "text/html");
    return document.body.textContent ?? "";
  }

  return html.replace(/<[^>]*>/g, " ");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeLesson(payload: LessonMutation): LessonMutation {
  return {
    ...payload,
    video_url: normalizeVideoUrl(payload.video_url),
    image_url: payload.image_url?.trim() || null,
  };
}

function normalizeTask(payload: TaskMutation): TaskMutation {
  if (payload.type === "multi_choice") {
    const options = getOptions(payload).map((option) => option.trim()).filter(Boolean);
    const correctAnswers = payload.correct_answer
      .split("|")
      .map((answer) => answer.trim())
      .filter((answer) => answer && options.includes(answer));
    return {
      ...payload,
      payload: { ...payload.payload, options, correct_answers: correctAnswers },
      correct_answer: correctAnswers.join("|"),
      image_url: payload.image_url?.trim() || null,
    };
  }
  if (payload.type === "order") {
    const items = Array.isArray(payload.payload.items)
      ? payload.payload.items.map(String).filter(Boolean)
      : payload.correct_answer.split("|").filter(Boolean);
    return { ...payload, payload: { ...payload.payload, items }, correct_answer: items.join("|"), image_url: payload.image_url?.trim() || null };
  }
  return { ...payload, image_url: payload.image_url?.trim() || null };
}

function getOptions(taskForm: TaskMutation): string[] {
  return Array.isArray(taskForm.payload.options) ? taskForm.payload.options.map(String) : [];
}

function getPoints(taskForm: TaskMutation): ChartPoint[] {
  return Array.isArray(taskForm.payload.points) ? (taskForm.payload.points as ChartPoint[]) : [];
}

function getCorrectAnswers(taskForm: TaskMutation): string[] {
  return Array.isArray(taskForm.payload.correct_answers) ? taskForm.payload.correct_answers.map(String) : taskForm.correct_answer.split("|").filter(Boolean);
}

function getOrderItems(taskForm: TaskMutation): string[] {
  return Array.isArray(taskForm.payload.items) ? taskForm.payload.items.map(String) : [];
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
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

function EditorModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="editor-modal-backdrop" role="presentation">
      <section className="editor-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="editor-modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
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

function LearningGoalsEditor({ goals, onChange }: { goals: string[]; onChange: (goals: string[]) => void }) {
  const visibleGoals = goals.length ? goals : [""];

  function updateGoal(index: number, value: string) {
    const nextGoals = [...visibleGoals];
    nextGoals[index] = value;
    onChange(nextGoals);
  }

  function removeGoal(index: number) {
    const nextGoals = visibleGoals.filter((_, goalIndex) => goalIndex !== index);
    onChange(nextGoals.length ? nextGoals : [""]);
  }

  return (
    <div className="learning-goals-editor">
      <div className="field-heading">
        <span>Чему научится ученик</span>
      </div>
      <div className="learning-goals-list">
        {visibleGoals.map((goal, index) => (
          <div className="learning-goal-row" key={`learning-goal-${index}`}>
            <input
              aria-label={`Результат обучения ${index + 1}`}
              placeholder={`Результат ${index + 1}`}
              value={goal}
              onChange={(event) => updateGoal(index, event.target.value)}
            />
            <button
              className="icon-button"
              type="button"
              onClick={() => removeGoal(index)}
              disabled={visibleGoals.length === 1 && !goal.trim()}
              title="Удалить результат"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <button className="secondary-button learning-goal-add" type="button" onClick={() => onChange([...visibleGoals, ""])}>
        <Plus size={18} />
        Добавить результат
      </button>
    </div>
  );
}

function CourseDirectionsPicker({ value, onChange }: { value: string[]; onChange: (directions: string[]) => void }) {
  const options = Array.from(new Set([...COURSE_DIRECTIONS, ...value]));

  function toggleDirection(direction: string) {
    if (value.includes(direction)) {
      onChange(value.filter((item) => item !== direction));
      return;
    }
    onChange([...value, direction]);
  }

  return (
    <div className="course-directions-picker">
      <div className="field-heading">
        <span>Направления</span>
      </div>
      <div className="checkbox-list course-directions-list">
        {options.map((direction) => (
          <label key={direction}>
            <input checked={value.includes(direction)} type="checkbox" onChange={() => toggleDirection(direction)} />
            <span>{direction}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function CourseLevelSelect({ value, onChange }: { value: string; onChange: (level: string) => void }) {
  const options = Array.from(new Set([...COURSE_LEVELS, value].filter(Boolean)));

  return (
    <label className="course-level-select">
      Уровень
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    </label>
  );
}

function RichTextEditor({
  label,
  value,
  onChange,
  onError,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const lastHtmlRef = useRef(value);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextValue = value || "";
    if (nextValue === editor.innerHTML) {
      lastHtmlRef.current = nextValue;
      return;
    }

    if (nextValue === lastHtmlRef.current && editor.innerHTML) {
      return;
    }

    editor.innerHTML = value || "";
    lastHtmlRef.current = value || "";
  }, [value]);

  function saveSelection(updateState = true) {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
      if (updateState) {
        updateToolbarState();
      }
    }
  }

  function restoreSelection(): boolean {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selectionRef.current || !selection) return false;

    try {
      if (!editor.contains(selectionRef.current.commonAncestorContainer)) {
        return false;
      }
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
      return true;
    } catch {
      return false;
    }
  }

  function placeCaretAtEnd() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    selectionRef.current = range.cloneRange();
  }

  function ensureEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    editor?.focus();

    if (editor && selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        selectionRef.current = range.cloneRange();
        return;
      }
    }

    if (!restoreSelection()) {
      placeCaretAtEnd();
    }
  }

  function syncValue(updateState = true) {
    const nextValue = editorRef.current?.innerHTML ?? "";
    lastHtmlRef.current = nextValue;
    onChange(nextValue);
    if (updateState) {
      updateToolbarState();
    }
  }

  function command(name: string, commandValue?: string) {
    ensureEditorSelection();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(name, false, commandValue);
    syncValue(false);
    saveSelection(false);

    if (name === "bold" || name === "italic" || name === "underline") {
      setActiveFormats((current) => ({ ...current, [name]: !current[name] }));
    } else {
      window.setTimeout(updateToolbarState);
    }
  }

  function updateToolbarState() {
    try {
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
    } catch {
      setActiveFormats({ bold: false, italic: false, underline: false });
    }
  }

  async function insertImage(file: File | undefined) {
    if (!file) return;
    try {
      const uploaded = await api.uploadImage(file);
      command("insertImage", uploaded.url);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось вставить картинку");
    }
  }

  return (
    <div className="rich-editor-field">
      <div className="field-heading">
        <span>{label}</span>
      </div>
      <div className="rich-editor-toolbar">
        <button type="button" className={activeFormats.bold ? "rich-tool-button rich-tool-button--icon active" : "rich-tool-button rich-tool-button--icon"} aria-label="Полужирный" aria-pressed={activeFormats.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")} title="Полужирный">
          <Bold size={16} />
        </button>
        <button type="button" className={activeFormats.italic ? "rich-tool-button rich-tool-button--icon active" : "rich-tool-button rich-tool-button--icon"} aria-label="Курсив" aria-pressed={activeFormats.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")} title="Курсив">
          <Italic size={16} />
        </button>
        <button type="button" className={activeFormats.underline ? "rich-tool-button rich-tool-button--icon active" : "rich-tool-button rich-tool-button--icon"} aria-label="Подчеркнуть" aria-pressed={activeFormats.underline} onMouseDown={(event) => event.preventDefault()} onClick={() => command("underline")} title="Подчеркнуть">
          <Underline size={16} />
        </button>
        <label className="rich-tool-button rich-tool-button--icon rich-image-picker" onMouseDown={() => saveSelection()} title="Вставить картинку">
          <Image size={18} />
          <input
            aria-label="Вставить картинку"
            accept="image/gif,image/jpeg,image/png,image/webp"
            type="file"
            onChange={(event) => {
              void insertImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <div
        className="rich-editor"
        aria-label={label}
        contentEditable
        data-placeholder="Напишите описание курса здесь"
        onBlur={() => {
          saveSelection();
          syncValue();
        }}
        onInput={() => syncValue()}
        onKeyUp={() => saveSelection()}
        onMouseUp={() => saveSelection()}
        onFocus={updateToolbarState}
        ref={editorRef}
        suppressContentEditableWarning
      />
    </div>
  );
}

function ImageUrlUploadField({
  label,
  imageUrl,
  onChange,
  onError,
}: {
  label: string;
  imageUrl: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [editingImage, setEditingImage] = useState<{ file: File; url: string } | null>(null);

  function editSelectedFile(file: File | undefined) {
    if (!file) return;
    if (editingImage) {
      URL.revokeObjectURL(editingImage.url);
    }
    setEditingImage({ file, url: URL.createObjectURL(file) });
  }

  async function editCurrentImage() {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error("Не удалось открыть картинку");
      }
      const blob = await response.blob();
      const file = new File([blob], "image.jpg", { type: blob.type || "image/jpeg" });
      if (editingImage) {
        URL.revokeObjectURL(editingImage.url);
      }
      setEditingImage({ file, url: URL.createObjectURL(file) });
    } catch {
      onError("Не удалось открыть картинку для редактирования. Загрузите файл заново");
    }
  }

  function closeEditor() {
    if (editingImage) {
      URL.revokeObjectURL(editingImage.url);
    }
    setEditingImage(null);
  }

  async function uploadEditedImage(settings: PhotoEditSettings) {
    if (!editingImage) return;
    setIsUploading(true);
    try {
      const file = await createEditedImageFile(editingImage.file, editingImage.url, settings);
      const uploaded = await api.uploadImage(file);
      onChange(uploaded.url);
      closeEditor();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось загрузить картинку");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="image-url-upload-field">
      <div className="field-heading">
        <span>{label}</span>
      </div>
      <div className="image-url-upload-row">
        <span className="input-with-icon">
          <Image size={16} />
          <input placeholder="Ссылка на картинку" value={imageUrl} onChange={(event) => onChange(event.target.value)} />
        </span>
        <label className="file-picker compact" title={isUploading ? "Загружаем..." : "Загрузить картинку"}>
          <Upload size={18} />
          <input
            aria-label="Загрузить картинку"
            accept="image/gif,image/jpeg,image/png,image/webp"
            disabled={isUploading}
            type="file"
            onChange={(event) => {
              editSelectedFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {imageUrl && (
        <div className="upload-preview">
          <img src={imageUrl} alt="" />
          <button className="secondary-button" type="button" onClick={() => void editCurrentImage()}>
            Кадрировать
          </button>
          <button className="secondary-button" type="button" onClick={() => onChange("")}>
            Убрать
          </button>
        </div>
      )}
      {editingImage && (
        <PhotoEditorModal
          imageUrl={editingImage.url}
          isSaving={isUploading}
          onCancel={closeEditor}
          onSave={(settings) => void uploadEditedImage(settings)}
        />
      )}
    </div>
  );
}

type PhotoEditSettings = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

function PhotoEditorModal({
  imageUrl,
  isSaving,
  onCancel,
  onSave,
}: {
  imageUrl: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (settings: PhotoEditSettings) => void;
}) {
  const [settings, setSettings] = useState<PhotoEditSettings>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [imageSize, setImageSize] = useState({ width: 16, height: 9 });
  const frameRatio = 16 / 9;
  const imageRatio = imageSize.width / imageSize.height;
  const baseWidth = imageRatio > frameRatio ? imageRatio * 100 : 100;
  const baseHeight = imageRatio > frameRatio ? 100 : (100 / imageRatio) * frameRatio;

  return (
    <EditorModal title="Редактор картинки" onClose={onCancel}>
      <div className="photo-editor">
        <div className="photo-editor-frame">
          <img
            src={imageUrl}
            alt=""
            onLoad={(event) =>
              setImageSize({
                width: event.currentTarget.naturalWidth || 16,
                height: event.currentTarget.naturalHeight || 9,
              })
            }
            style={{
              width: `${baseWidth * settings.zoom}%`,
              height: `${baseHeight * settings.zoom}%`,
              transform: `translate(-50%, -50%) translate(${settings.offsetX}%, ${settings.offsetY}%)`,
            }}
          />
        </div>
        <div className="photo-editor-controls">
          <label>
            Масштаб
            <input
              max="2.4"
              min="1"
              step="0.05"
              type="range"
              value={settings.zoom}
              onChange={(event) => setSettings({ ...settings, zoom: Number(event.target.value) })}
            />
          </label>
          <label>
            По горизонтали
            <input
              max="45"
              min="-45"
              step="1"
              type="range"
              value={settings.offsetX}
              onChange={(event) => setSettings({ ...settings, offsetX: Number(event.target.value) })}
            />
          </label>
          <label>
            По вертикали
            <input
              max="45"
              min="-45"
              step="1"
              type="range"
              value={settings.offsetY}
              onChange={(event) => setSettings({ ...settings, offsetY: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={() => onSave(settings)} disabled={isSaving}>
            <Save size={18} />
            {isSaving ? "Сохраняем..." : "Сохранить картинку"}
          </button>
          <button className="secondary-button" type="button" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </EditorModal>
  );
}

async function createEditedImageFile(file: File, imageUrl: string, settings: PhotoEditSettings): Promise<File> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const image = document.createElement("img");

  canvas.width = 1600;
  canvas.height = 900;

  if (!context) {
    return file;
  }

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Не удалось обработать картинку"));
    image.src = imageUrl;
  });

  context.fillStyle = "#f8fffc";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = canvas.width / canvas.height;
  const baseScale = imageRatio > canvasRatio ? canvas.width / image.naturalWidth : canvas.height / image.naturalHeight;
  const scale = baseScale * settings.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (canvas.width - width) / 2 + (settings.offsetX / 100) * canvas.width;
  const y = (canvas.height - height) / 2 + (settings.offsetY / 100) * canvas.height;
  context.drawImage(image, x, y, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const binary = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

function TaskPayloadFields({
  taskForm,
  setTaskForm,
  onError,
}: {
  taskForm: TaskMutation;
  setTaskForm: (value: TaskMutation) => void;
  onError: (message: string) => void;
}) {
  if (taskForm.type === "chart") {
    const points = getPoints(taskForm);
    return (
      <div className="specific-fields">
        <p className="helper-text">Добавьте подписи и числа. Ученик увидит график и выберет одну из подписей.</p>
        {points.map((point, index) => (
          <div className="option-editor-row" key={`chart-point-${index}`}>
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
            {points.map((point, index) => (
              <option key={`${point.label}-${point.value}-${index}`} value={point.label}>
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
        <p className="helper-text">Загрузите картинку ребуса. Ученик увидит ее крупно и введет ответ вручную.</p>
        <ImageUrlUploadField
          label="Картинка ребуса"
          imageUrl={taskForm.image_url ?? ""}
          onChange={(value) => setTaskForm({ ...taskForm, image_url: value })}
          onError={onError}
        />
        <div className="form-row">
          <Field
            label="Подсказка"
            value={String(taskForm.payload.hint ?? "")}
            onChange={(value) => setTaskForm({ ...taskForm, payload: { ...taskForm.payload, hint: value } })}
          />
          <Field
            label="Правильный ответ"
            value={taskForm.correct_answer}
            onChange={(value) => setTaskForm({ ...taskForm, correct_answer: value })}
          />
        </div>
      </div>
    );
  }

  if (taskForm.type === "text_input") {
    return (
      <div className="specific-fields">
        <p className="helper-text">Ученик вводит короткий текст, ответ сравнивается без учета регистра.</p>
        <Field
          label="Правильный ответ"
          value={taskForm.correct_answer}
          onChange={(value) => setTaskForm({ ...taskForm, correct_answer: value })}
        />
      </div>
    );
  }

  if (taskForm.type === "order") {
    const items = getOrderItems(taskForm);
    return (
      <div className="specific-fields">
        <p className="helper-text">Порядок строк ниже считается правильным ответом.</p>
        {items.map((item, index) => (
          <div className="option-editor-row order-editor-row" key={`order-item-${index}`}>
            <input
              value={item}
              onChange={(event) => {
                const nextItems = items.map((value, itemIndex) => (itemIndex === index ? event.target.value : value));
                setTaskForm({ ...taskForm, payload: { items: nextItems }, correct_answer: nextItems.join("|") });
              }}
              placeholder={`Шаг ${index + 1}`}
              required
            />
            <div className="option-editor-actions">
              <button
                className="icon-button"
                type="button"
                disabled={index === 0}
                onClick={() => {
                  const nextItems = moveArrayItem(items, index, index - 1);
                  setTaskForm({ ...taskForm, payload: { items: nextItems }, correct_answer: nextItems.join("|") });
                }}
                title="Выше"
              >
                <ArrowUp size={16} />
              </button>
              <button
                className="icon-button"
                type="button"
                disabled={index === items.length - 1}
                onClick={() => {
                  const nextItems = moveArrayItem(items, index, index + 1);
                  setTaskForm({ ...taskForm, payload: { items: nextItems }, correct_answer: nextItems.join("|") });
                }}
                title="Ниже"
              >
                <ArrowDown size={16} />
              </button>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
                setTaskForm({ ...taskForm, payload: { items: nextItems }, correct_answer: nextItems.join("|") });
              }}
              title="Удалить"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            const nextItems = [...items, `Шаг ${items.length + 1}`];
            setTaskForm({ ...taskForm, payload: { items: nextItems }, correct_answer: nextItems.join("|") });
          }}
        >
          <Plus size={18} />
          Добавить шаг
        </button>
      </div>
    );
  }

  const options = getOptions(taskForm);
  const correctAnswers = getCorrectAnswers(taskForm);
  return (
    <div className="specific-fields">
      <p className="helper-text">
        {taskForm.type === "multi_choice" ? "Отметьте все правильные варианты." : "Варианты станут кнопками. Правильный ответ выбирается из списка ниже."}
      </p>
      {options.map((option, index) => (
        <div className="option-editor-row" key={`quiz-option-${index}`}>
          <input
            value={option}
            onChange={(event) => {
              const nextOptions = options.map((item, itemIndex) => (itemIndex === index ? event.target.value : item));
              const nextCorrectAnswers = correctAnswers
                .map((item) => (item === option ? event.target.value : item))
                .filter((item) => nextOptions.includes(item));
              setTaskForm({
                ...taskForm,
                payload: taskForm.type === "multi_choice"
                  ? { ...taskForm.payload, options: nextOptions, correct_answers: nextCorrectAnswers }
                  : { ...taskForm.payload, options: nextOptions },
                correct_answer: taskForm.type === "multi_choice"
                  ? nextCorrectAnswers.join("|")
                  : taskForm.correct_answer === option ? event.target.value : taskForm.correct_answer,
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
              const nextCorrectAnswers = correctAnswers.filter((item) => nextOptions.includes(item));
              setTaskForm({
                ...taskForm,
                payload: taskForm.type === "multi_choice"
                  ? { ...taskForm.payload, options: nextOptions, correct_answers: nextCorrectAnswers }
                  : { ...taskForm.payload, options: nextOptions },
                correct_answer: taskForm.type === "multi_choice" ? nextCorrectAnswers.join("|") : nextOptions[0] ?? "",
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
            payload: { ...taskForm.payload, options: [...options, `Вариант ${options.length + 1}`] },
          })
        }
      >
        <Plus size={18} />
        Добавить вариант
      </button>
      <label>
        Правильный ответ
        {taskForm.type === "multi_choice" ? (
          <div className="checkbox-list">
            {options.map((option, index) => (
              <label key={`${option}-${index}`}>
                <input
                  checked={correctAnswers.includes(option)}
                  type="checkbox"
                  onChange={(event) => {
                    const nextAnswers = event.target.checked
                      ? [...correctAnswers, option]
                      : correctAnswers.filter((item) => item !== option);
                    setTaskForm({
                      ...taskForm,
                      payload: { ...taskForm.payload, correct_answers: nextAnswers },
                      correct_answer: nextAnswers.join("|"),
                    });
                  }}
                />
                {option}
              </label>
            ))}
          </div>
        ) : (
          <select
            value={taskForm.correct_answer}
            onChange={(event) => setTaskForm({ ...taskForm, correct_answer: event.target.value })}
            required
          >
            {options.map((option, index) => (
              <option key={`${option}-${index}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
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
      {(taskForm.type === "quiz" || taskForm.type === "multi_choice") && (
        <div className="preview-options">
          {options.map((option, index) => (
            <button key={`preview-option-${index}`} type="button">
              {option}
            </button>
          ))}
        </div>
      )}
      {taskForm.type === "chart" && (
        <div className="preview-bars">
          {points.map((point, index) => (
            <div key={`preview-point-${index}`}>
              <span style={{ height: `${Math.max(12, Math.min(100, point.value * 4))}px` }} />
              <small>{point.label}</small>
            </div>
          ))}
        </div>
      )}
      {taskForm.type === "rebus" && (
        <div className="preview-rebus">
          {taskForm.image_url ? (
            <img className="preview-rebus-image" src={taskForm.image_url} alt="" />
          ) : (
            <strong>{String(taskForm.payload.clue ?? "") || "Загрузите картинку ребуса"}</strong>
          )}
          {String(taskForm.payload.hint ?? "") && <small>{String(taskForm.payload.hint)}</small>}
        </div>
      )}
      {taskForm.type === "text_input" && <div className="preview-rebus"><small>Поле короткого ответа</small></div>}
      {taskForm.type === "order" && (
        <div className="preview-options">
          {getOrderItems(taskForm).map((item, index) => (
            <button key={`preview-order-${index}`} type="button">{index + 1}. {item}</button>
          ))}
        </div>
      )}
    </div>
  );
}
