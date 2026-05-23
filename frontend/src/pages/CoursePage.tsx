import { Award, BookOpen, CheckCircle2, ChevronLeft, ListChecks, Lock, PlayCircle, RotateCcw, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { InteractiveTask } from "../components/InteractiveTask";
import { Layout } from "../components/Layout";
import { formatTaskCount } from "../format";
import { getEmbedVideoUrl } from "../video";
import type { CourseDetail, Task } from "../types";

export function CoursePage() {
  const { courseId = "" } = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState("");
  const [retryTaskIds, setRetryTaskIds] = useState<Set<number>>(() => new Set());
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  async function loadCourse() {
    try {
      setCourse(await api.course(courseId));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Курс не найден");
    }
  }

  useEffect(() => {
    void loadCourse();
  }, [courseId]);

  const orderedLessons = useMemo(() => {
    return course ? course.lessons.slice().sort((a, b) => a.order_index - b.order_index) : [];
  }, [course]);

  const orderedTasks = useMemo(() => {
    return orderedLessons.flatMap((lesson) => lesson.tasks.slice().sort((a, b) => a.order_index - b.order_index));
  }, [orderedLessons]);

  const activeTaskId = orderedTasks.find((task) => !task.result?.is_correct)?.id ?? null;
  const activeTaskLessonId = orderedLessons.find((lesson) => lesson.tasks.some((task) => task.id === activeTaskId))?.id ?? null;
  const selectedLesson = orderedLessons.find((lesson) => lesson.id === selectedLessonId) ?? orderedLessons[0] ?? null;

  useEffect(() => {
    if (!orderedLessons.length) return;
    setSelectedLessonId((currentLessonId) => {
      if (currentLessonId && orderedLessons.some((lesson) => lesson.id === currentLessonId)) {
        return currentLessonId;
      }
      return activeTaskLessonId ?? orderedLessons[0].id;
    });
  }, [activeTaskLessonId, orderedLessons]);

  async function issueCertificate() {
    if (!course) return;
    try {
      const certificate = await api.issueCertificate(course.id);
      setCourse({ ...course, certificate });
      setError("");
    } catch (certificateError) {
      setError(certificateError instanceof Error ? certificateError.message : "Сертификат пока недоступен");
    }
  }

  function retryTask(taskId: number) {
    setRetryTaskIds((current) => new Set(current).add(taskId));
  }

  async function handleTaskAnswered(taskId: number, isCorrect: boolean) {
    await loadCourse();
    if (isCorrect) {
      setRetryTaskIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  }

  return (
    <Layout>
      <div className="page-nav">
        <Link to="/">
          <ChevronLeft size={18} />
          Назад
        </Link>
      </div>

      {error && <div className="form-error">{error}</div>}
      {!course && !error && <div className="screen-loader">Загрузка курса...</div>}

      {course && (
        <>
          <section className="course-hero">
            <div>
              <span className="eyebrow">{course.direction}</span>
              <h1>{course.title}</h1>
              <p>{course.description}</p>
            </div>
            <div className="progress-widget">
              <strong>{course.progress_percent}%</strong>
              <span>
                {course.completed_tasks}/{formatTaskCount(course.total_tasks)}
              </span>
              <div className="progress-line">
                <span style={{ width: `${course.progress_percent}%` }} />
              </div>
            </div>
          </section>

          <section className="student-module-shell">
            <aside className="student-module-nav">
              <div className="student-module-nav-heading">
                <BookOpen size={20} />
                <h2>Модули курса</h2>
              </div>
              <div className="student-module-list">
                {orderedLessons.length ? (
                  orderedLessons.map((lesson) => {
                    const completedTasks = lesson.tasks.filter((task) => task.result?.is_correct).length;
                    return (
                      <button
                        className={lesson.id === selectedLesson?.id ? "student-module-card active" : "student-module-card"}
                        key={lesson.id}
                        type="button"
                        onClick={() => setSelectedLessonId(lesson.id)}
                      >
                        <span>Модуль {lesson.order_index}</span>
                        <strong>{lesson.title}</strong>
                        <small>
                          {completedTasks}/{formatTaskCount(lesson.tasks.length)}
                        </small>
                      </button>
                    );
                  })
                ) : (
                  <div className="empty-state compact">
                    <BookOpen size={24} />
                    <strong>Модулей пока нет</strong>
                    <span>Преподаватель еще не добавил уроки в этот курс.</span>
                  </div>
                )}
              </div>
            </aside>

            {selectedLesson ? (
              <section className="student-module-detail">
                <div className={selectedLesson.image_url || selectedLesson.video_url ? "student-module-overview has-media" : "student-module-overview"}>
                  <div className="student-module-copy">
                    <span>Модуль {selectedLesson.order_index}</span>
                    <h2>{selectedLesson.title}</h2>
                    <p>{selectedLesson.content}</p>
                  </div>

                  {(selectedLesson.image_url || selectedLesson.video_url) && (
                    <aside className="student-module-media">
                      <div className="student-module-task-heading">
                        <Video size={20} />
                        <h3>Материалы модуля</h3>
                      </div>
                      {selectedLesson.image_url && <img className="lesson-image" src={selectedLesson.image_url} alt="" />}
                      {selectedLesson.video_url && (
                        <div>
                          <div className="video-frame">
                            <iframe
                              src={getEmbedVideoUrl(selectedLesson.video_url)}
                              title={selectedLesson.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              referrerPolicy="strict-origin-when-cross-origin"
                            />
                          </div>
                          <a className="video-open-link" href={selectedLesson.video_url} target="_blank" rel="noreferrer">
                            Открыть видео в новом окне
                          </a>
                        </div>
                      )}
                    </aside>
                  )}
                </div>

                <div className="student-module-tasks">
                  <div className="student-module-task-heading">
                    <ListChecks size={20} />
                    <h3>Задания модуля</h3>
                  </div>
                  <div className="task-stack">
                    {selectedLesson.tasks.length ? (
                      selectedLesson.tasks.map((task) => {
                        if (task.result?.is_correct && !retryTaskIds.has(task.id)) {
                          return <TaskStateCard key={task.id} task={task} state="done" onRetry={() => retryTask(task.id)} />;
                        }
                        if (task.id === activeTaskId) {
                          return <InteractiveTask key={task.id} task={task} onSolved={(isCorrect) => handleTaskAnswered(task.id, isCorrect)} />;
                        }
                        if (retryTaskIds.has(task.id)) {
                          return <InteractiveTask key={task.id} task={task} onSolved={(isCorrect) => handleTaskAnswered(task.id, isCorrect)} />;
                        }
                        return <TaskStateCard key={task.id} task={task} state="locked" />;
                      })
                    ) : (
                      <div className="task-panel task-panel--locked">
                        <div className="task-header">
                          <span className="task-icon"><Video size={18} /></span>
                          <div>
                            <h3>Заданий пока нет</h3>
                            <p>Изучите материал модуля и переходите к следующему разделу курса.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <section className="student-module-detail">
                <div className="student-module-copy">
                  <span>Курс в подготовке</span>
                  <h2>Материалы еще не добавлены</h2>
                  <p>Как только преподаватель создаст первый модуль, он появится здесь вместе с заданиями.</p>
                </div>
              </section>
            )}
          </section>

          <section className="certificate-band">
            <div>
              <span className="eyebrow">Финал курса</span>
              <h2>{course.certificate ? "Сертификат оформлен" : "Сертификат после завершения"}</h2>
              <p>
                {course.certificate
                  ? `Код сертификата: ${course.certificate.code}`
                  : "Выполните все задания курса, чтобы получить учебный сертификат."}
              </p>
            </div>
            {course.certificate ? (
              <Link className="primary-button" to={`/courses/${course.id}/certificate`}>
                <Award size={18} />
                Посмотреть
              </Link>
            ) : (
              <button className="primary-button" type="button" onClick={issueCertificate}>
                <PlayCircle size={18} />
                Получить
              </button>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

function TaskStateCard({ task, state, onRetry }: { task: Task; state: "done" | "locked"; onRetry?: () => void }) {
  return (
    <section className={`task-panel task-panel--${state}`}>
      <div className="task-header">
        <span className="task-icon">{state === "done" ? <CheckCircle2 size={18} /> : <Lock size={18} />}</span>
        <div>
          <h3>{task.title}</h3>
          <p>{state === "done" ? "Задание выполнено. Следующий шаг открыт." : "Откроется после предыдущего задания."}</p>
        </div>
      </div>
      {state === "done" && onRetry && (
        <button className="secondary-button retry-button" type="button" onClick={onRetry}>
          <RotateCcw size={18} />
          Пройти заново
        </button>
      )}
    </section>
  );
}
