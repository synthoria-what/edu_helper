import { ArrowRight, BookOpen, Clock, GraduationCap, Layers3, PencilRuler, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api";
import { Layout } from "../components/Layout";
import { formatCoursePrice, formatTaskCount } from "../format";
import type { CourseListItem, ProgressSummary } from "../types";

const COURSES_PER_PAGE = 9;

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const ownerId = searchParams.get("owner_id") ?? "";
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [query, setQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  async function loadDashboard(
    filters: { q?: string; price?: string; direction?: string; level?: string; owner_id?: string } = {
      q: query,
      price: priceFilter,
      direction: directionFilter,
      level: levelFilter,
      owner_id: ownerId,
    },
  ) {
    Promise.all([api.courses(filters), api.progress()])
      .then(([coursesResponse, progressResponse]) => {
        setCourses(coursesResponse);
        setSummary(progressResponse);
        setPage(1);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить данные"));
  }

  useEffect(() => {
    void loadDashboard({ q: "", price: "", direction: "", level: "", owner_id: ownerId });
  }, [searchParams]);

  const directions = useMemo(() => Array.from(new Set(courses.map((course) => course.direction))).sort(), [courses]);
  const levels = useMemo(() => Array.from(new Set(courses.map((course) => course.level))).sort(), [courses]);
  const totalPages = Math.max(1, Math.ceil(courses.length / COURSES_PER_PAGE));
  const pageCourses = useMemo(
    () => courses.slice((page - 1) * COURSES_PER_PAGE, page * COURSES_PER_PAGE),
    [courses, page],
  );

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void loadDashboard();
  }

  function resetFilters() {
    setQuery("");
    setPriceFilter("");
    setDirectionFilter("");
    setLevelFilter("");
    void loadDashboard({ q: "", price: "", direction: "", level: "", owner_id: ownerId });
  }

  return (
    <Layout>
      <section className="dashboard-hero dashboard-home-hero">
        <div>
          <span className="eyebrow">Учебная платформа</span>
          <h1>Дополнительные курсы с интерактивными заданиями</h1>
          <p>Официальный формат обучения с небольшими игровыми элементами и понятной фиксацией прогресса.</p>
          <Link className="primary-button hero-action" to="/my-courses">
            <PencilRuler size={18} />
            Создать курс
          </Link>
        </div>
        <div className="summary-strip">
          <SummaryItem icon={<GraduationCap size={20} />} label="Курсы" value={summary?.courses_total ?? 0} />
          <SummaryItem icon={<BookOpen size={20} />} label="Найдено" value={courses.length} />
          <SummaryItem icon={<Layers3 size={20} />} label="Направления" value={directions.length} />
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}

      <section className="content-section dashboard-home-section">
        <div className="section-heading">
          <h2>Поиск курсов</h2>
          <span>{courses.length} найдено</span>
        </div>
        <form className="course-search-panel" onSubmit={submitSearch}>
          <label className="search-input">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название курса, автор или предмет" />
          </label>
          <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}>
            <option value="">Любая цена</option>
            <option value="free">Бесплатные</option>
            <option value="paid">Платные</option>
          </select>
          <select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}>
            <option value="">Все направления</option>
            {directions.map((direction) => <option key={direction} value={direction}>{direction}</option>)}
          </select>
          <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
            <option value="">Все уровни</option>
            {levels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <button className="primary-button" type="submit">Искать</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>Сбросить</button>
        </form>
        <div className="course-grid">
          {courses.length ? (
            pageCourses.map((course) => (
              <article className="course-card" key={course.id}>
                <div
                  className={course.image_url ? "course-card-media" : "course-card-media course-card-media--empty"}
                  style={course.image_url ? ({ "--course-image": `url(${course.image_url})` } as React.CSSProperties) : undefined}
                >
                  {course.image_url ? (
                    <img className="course-card-image" src={course.image_url} alt="" />
                  ) : (
                    <GraduationCap size={42} />
                  )}
                </div>
                <div className="course-meta">
                  <span>{course.direction}</span>
                  <span>{course.level}</span>
                  <span>{formatCoursePrice(course.price_rubles)}</span>
                </div>
                <h3>{course.title}</h3>
                <small className="course-author">{course.owner_name}</small>
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
                    {course.lessons_count} уроков · {formatTaskCount(course.total_tasks)}
                  </span>
                </div>
                <Link className="secondary-button" to={`/courses/${course.id}`}>
                  Подробнее
                  <ArrowRight size={18} />
                </Link>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <GraduationCap size={24} />
              <strong>Курсов пока нет</strong>
              <span>Когда пользователи добавят курсы, они появятся в этом разделе.</span>
            </div>
          )}
        </div>
        {courses.length > COURSES_PER_PAGE && (
          <div className="pagination">
            <button className="secondary-button" type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Назад
            </button>
            <span>
              Страница {page} из {totalPages}
            </span>
            <button className="secondary-button" type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Вперёд
            </button>
          </div>
        )}
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
