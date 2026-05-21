import { Award, CheckCircle2, ChevronLeft, Lock, PlayCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";
import { InteractiveTask } from "../components/InteractiveTask";
import { Layout } from "../components/Layout";
import { formatTaskCount } from "../format";
import type { CourseDetail, Task } from "../types";

export function CoursePage() {
  const { courseId = "" } = useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState("");
  const [retryTaskIds, setRetryTaskIds] = useState<Set<number>>(() => new Set());

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

  const orderedTasks = useMemo(() => {
    if (!course) return [];
    return course.lessons
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap((lesson) => lesson.tasks.slice().sort((a, b) => a.order_index - b.order_index));
  }, [course]);

  const activeTaskId = orderedTasks.find((task) => !task.result?.is_correct)?.id ?? null;

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
            {course.image_url && <img className="course-cover" src={course.image_url} alt="" />}
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

          <div className="lesson-list">
            {course.lessons.map((lesson) => (
              <section className="lesson-block" key={lesson.id}>
                <div className="lesson-copy">
                  <span>Модуль {lesson.order_index}</span>
                  <h2>{lesson.title}</h2>
                  <p>{lesson.content}</p>
                  {lesson.image_url && <img className="lesson-image" src={lesson.image_url} alt="" />}
                  {lesson.video_url && (
                    <div className="video-frame">
                      <iframe src={getEmbedVideoUrl(lesson.video_url)} title={lesson.title} allowFullScreen />
                    </div>
                  )}
                </div>
                <div className="task-stack">
                  {lesson.tasks.map((task) => {
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
                  })}
                </div>
              </section>
            ))}
          </div>

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

function getEmbedVideoUrl(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${url.pathname.replace("/", "")}`;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v");
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }
      if (url.pathname.startsWith("/shorts/")) {
        return `https://www.youtube.com/embed/${url.pathname.split("/")[2]}`;
      }
    }
    if (host === "rutube.ru" || host === "m.rutube.ru") {
      if (url.pathname.startsWith("/play/embed/")) {
        return value;
      }
      if (url.pathname.startsWith("/video/")) {
        const videoId = url.pathname.split("/").filter(Boolean)[1];
        if (videoId) return `https://rutube.ru/play/embed/${videoId}`;
      }
    }
  } catch {
    return value;
  }

  return value;
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
