import { ArrowRight, Award, Clock, GraduationCap, PencilRuler, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth";
import { Layout } from "../components/Layout";
import { formatTaskCount } from "../format";
import type { Certificate, CompletedTask, CourseListItem, ProgressSummary } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.courses(), api.progress(), api.certificates(), api.completedTasks()])
      .then(([coursesResponse, progressResponse, certificateResponse, completedTaskResponse]) => {
        setCourses(coursesResponse);
        setSummary(progressResponse);
        setCertificates(certificateResponse);
        setCompletedTasks(completedTaskResponse);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные"));
  }, []);

  return (
    <Layout>
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Учебная платформа</span>
          <h1>Дополнительные курсы с интерактивными заданиями</h1>
          <p>Официальный формат обучения с небольшими игровыми элементами и понятной фиксацией прогресса.</p>
          {(user?.role === "teacher" || user?.role === "admin") && (
            <Link className="primary-button hero-action" to="/teacher">
              <PencilRuler size={18} />
              Управлять курсами
            </Link>
          )}
        </div>
        <div className="summary-strip">
          <SummaryItem icon={<GraduationCap size={20} />} label="Курсы" value={summary?.courses_total ?? 0} />
          <SummaryItem icon={<Target size={20} />} label="Задания" value={summary?.completed_tasks ?? 0} />
          <SummaryItem icon={<Award size={20} />} label="Сертификаты" value={summary?.completed_courses ?? 0} />
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}

      <section className="content-section">
        <div className="section-heading">
          <h2>Доступные курсы</h2>
          <span>{summary?.average_progress ?? 0}% общего прогресса</span>
        </div>
        <div className="course-grid">
          {courses.length ? (
            courses.map((course) => (
              <article className="course-card" key={course.id}>
                {course.image_url && (
                  <div className="course-card-media" style={{ "--course-image": `url(${course.image_url})` } as React.CSSProperties}>
                    <img className="course-card-image" src={course.image_url} alt="" />
                  </div>
                )}
                <div className="course-meta">
                  <span>{course.direction}</span>
                  <span>{course.level}</span>
                </div>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="progress-line">
                  <span style={{ width: `${course.progress_percent}%` }} />
                </div>
                <div className="course-footer">
                  <span>
                    <Clock size={16} />
                    {course.duration_minutes} мин.
                  </span>
                  <span>
                    {course.completed_tasks}/{formatTaskCount(course.total_tasks)}
                  </span>
                </div>
                <Link className="secondary-button" to={`/courses/${course.id}`}>
                  Открыть
                  <ArrowRight size={18} />
                </Link>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <GraduationCap size={24} />
              <strong>Курсов пока нет</strong>
              <span>Когда преподаватель добавит курс, он появится в этом разделе.</span>
            </div>
          )}
        </div>
      </section>

      <section className="content-section progress-history-section">
        <div className="history-column">
          <div className="section-heading">
            <h2>Сертификаты</h2>
            <span>{certificates.length}</span>
          </div>
          <div className="history-list">
            {certificates.length ? (
              certificates.map((certificate) => (
                <Link className="history-item" key={certificate.id} to={`/courses/${certificate.course_id}/certificate`}>
                  <strong>{certificate.course_title}</strong>
                  <span>{certificate.code}</span>
                  <small>
                    {certificate.student_name} · {new Date(certificate.issued_at).toLocaleDateString("ru-RU")}
                  </small>
                </Link>
              ))
            ) : (
              <p className="helper-text">Здесь появятся сертификаты после завершения курсов.</p>
            )}
          </div>
        </div>
        <div className="history-column">
          <div className="section-heading">
            <h2>Выполненные задания</h2>
            <span>{completedTasks.length}</span>
          </div>
          <div className="history-list">
            {completedTasks.length ? (
              completedTasks.slice(0, 8).map((task) => (
                <Link className="history-item" key={`${task.user_id}-${task.task_id}`} to={`/courses/${task.course_id}`}>
                  <strong>{task.task_title}</strong>
                  <span>{task.course_title} · {task.lesson_title}</span>
                  <small>
                    {user?.role !== "student" ? `${task.student_name} · ` : ""}
                    {new Date(task.completed_at).toLocaleDateString("ru-RU")}
                  </small>
                </Link>
              ))
            ) : (
              <p className="helper-text">После правильных ответов здесь будет история выполненных заданий.</p>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="summary-item">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
