import { ArrowRight, Award, Clock, GraduationCap, PencilRuler, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth";
import { Layout } from "../components/Layout";
import type { CourseListItem, ProgressSummary } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.courses(), api.progress()])
      .then(([coursesResponse, progressResponse]) => {
        setCourses(coursesResponse);
        setSummary(progressResponse);
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
          {courses.map((course) => (
            <article className="course-card" key={course.id}>
              {course.image_url && <img className="course-card-image" src={course.image_url} alt="" />}
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
                  {course.completed_tasks}/{course.total_tasks} заданий
                </span>
              </div>
              <Link className="secondary-button" to={`/courses/${course.id}`}>
                Открыть
                <ArrowRight size={18} />
              </Link>
            </article>
          ))}
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
