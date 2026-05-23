import { Award, BookOpen, Check, ChevronLeft, Clock, Copy, ListChecks, PlayCircle, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import { Layout } from "../components/Layout";
import { formatCoursePrice, formatTaskCount } from "../format";
import type { CourseDetail } from "../types";

export function CoursePage() {
  const { courseId = "" } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.course(courseId).then(setCourse).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Курс не найден");
    });
  }, [courseId]);

  const stats = useMemo(() => {
    const lessonsWithVideo = course?.lessons.filter((lesson) => lesson.video_url).length ?? 0;
    return {
      lessons: course?.lessons_count ?? 0,
      tasks: course?.total_tasks ?? 0,
      videos: lessonsWithVideo,
    };
  }, [course]);

  async function startCourse() {
    if (!course) return;
    try {
      await api.enrollCourse(course.id);
      navigate(`/courses/${course.id}/learn`);
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : "Не удалось записаться на курс");
    }
  }

  async function shareCourse() {
    await navigator.clipboard?.writeText(window.location.href);
    setMessage("Ссылка на курс скопирована");
  }

  return (
    <Layout>
      <div className="page-nav">
        <Link to="/">
          <ChevronLeft size={18} />
          Каталог
        </Link>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="teacher-message">{message}</div>}
      {!course && !error && <div className="screen-loader">Загрузка курса...</div>}

      {course && (
        <section className="course-promo-layout">
          <div className="promo-main">
            <section className="course-promo-copy">
              <span className="eyebrow">{course.direction}</span>
              <h1>{course.title}</h1>
              <p>{course.description}</p>
              <div className="course-promo-author">
                <UserRound size={18} />
                <span>{course.owner_name}</span>
              </div>
              <div className="course-promo-actions">
                <button className="primary-button" type="button" onClick={startCourse}>
                  <PlayCircle size={18} />
                  {course.is_enrolled || course.can_edit ? "Перейти к курсу" : "Пройти курс"}
                </button>
                <button className="secondary-button" type="button" onClick={shareCourse}>
                  <Copy size={18} />
                  Поделиться
                </button>
              </div>
            </section>

            <section className="course-promo-section">
              <div className="section-heading">
                <h2>Чему вы научитесь</h2>
              </div>
              {course.learning_goals.length ? (
                <div className="learning-goals-list">
                  {course.learning_goals.map((goal) => (
                    <span key={goal}>
                      <Check size={18} />
                      {goal}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="helper-text">Автор пока не добавил список результатов обучения.</p>
              )}
            </section>

            <section className="course-promo-section">
              <div className="section-heading">
                <h2>О курсе</h2>
              </div>
              <div className="rich-content" dangerouslySetInnerHTML={{ __html: course.description_html || course.description }} />
            </section>

            <section className="course-promo-section">
              <div className="section-heading">
                <h2>Программа курса</h2>
                <span>{stats.lessons} модулей</span>
              </div>
              <div className="program-list">
                {course.lessons.map((lesson) => (
                  <article className="program-item" key={lesson.id}>
                    <BookOpen size={18} />
                    <div>
                      <strong>{lesson.order_index}. {lesson.title}</strong>
                      <span>
                        {lesson.tasks.length ? formatTaskCount(lesson.tasks.length) : "Без заданий"}
                        {lesson.video_url ? " · видео" : ""}
                      </span>
                    </div>
                  </article>
                ))}
                {!course.lessons.length && <p className="helper-text">Программа появится после добавления уроков.</p>}
              </div>
            </section>
          </div>

          <aside className="course-promo-sidebar">
            <div className="course-promo-aside">
              {course.image_url && <img src={course.image_url} alt="" />}
              <strong>{formatCoursePrice(course.price_rubles)}</strong>
              <div className="promo-includes">
                <div className="section-heading">
                  <h2>В курс входят</h2>
                </div>
                <span>{stats.lessons} уроков</span>
                <span>{course.duration_minutes} минут материала</span>
                <span>{formatTaskCount(stats.tasks)}</span>
                <span>{stats.videos} видео</span>
                <span>Сертификат после завершения</span>
              </div>
            </div>

            <div className="promo-summary-panel">
              <div>
                <Clock size={18} />
                <span>{course.duration_minutes} мин.</span>
              </div>
              <div>
                <ListChecks size={18} />
                <span>{formatTaskCount(course.total_tasks)}</span>
              </div>
              <div>
                <Award size={18} />
                <span>Сертификат</span>
              </div>
            </div>
          </aside>
        </section>
      )}
    </Layout>
  );
}
