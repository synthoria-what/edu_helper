import { Award, BookOpen, Camera, CheckCircle2, LockKeyhole, Save, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth";
import { Layout } from "../components/Layout";
import type { Certificate, CompletedTask, CourseListItem } from "../types";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createdCourses, setCreatedCourses] = useState<CourseListItem[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseListItem[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([api.myCourses(), api.enrolledCourses(), api.certificates(), api.completedTasks()])
      .then(([created, enrolled, certs, tasks]) => {
        setCreatedCourses(created);
        setEnrolledCourses(enrolled);
        setCertificates(certs);
        setCompletedTasks(tasks);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось загрузить профиль"));
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    try {
      await api.updateMe({ full_name: fullName, email, avatar_url: avatarUrl || null });
      await refreshUser();
      setMessage("Профиль обновлен");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить профиль");
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    try {
      await api.updateMyPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Пароль обновлен");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось обновить пароль");
    }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file) return;
    try {
      const uploaded = await api.uploadImage(file);
      setAvatarUrl(uploaded.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить аватар");
    }
  }

  const completedCourseIds = new Set(certificates.map((certificate) => certificate.course_id));
  const completedCourses = enrolledCourses.filter((course) => completedCourseIds.has(course.id));

  return (
    <Layout>
      <section className="dashboard-hero profile-hero">
        <div>
          <span className="eyebrow">Профиль</span>
          <h1>{user?.full_name}</h1>
          <p>Личные данные, обучение, сертификаты и история выполненных заданий.</p>
        </div>
        <div className="profile-avatar-card">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={48} />}
          <label className="secondary-button">
            <Camera size={18} />
            Аватар
            <input accept="image/gif,image/jpeg,image/png,image/webp" type="file" onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
          </label>
        </div>
      </section>

      {message && <div className="teacher-message">{message}</div>}

      <section className="profile-grid profile-grid--forms">
        <form className="teacher-panel teacher-form" onSubmit={saveProfile}>
          <h2>Данные аккаунта</h2>
          <label>
            ФИО
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Ссылка на аватар
            <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">
            <Save size={18} />
            Сохранить
          </button>
        </form>

        <form className="teacher-panel teacher-form" onSubmit={savePassword}>
          <h2>Пароль</h2>
          <label>
            Текущий пароль
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required minLength={6} />
          </label>
          <label>
            Новый пароль
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} />
          </label>
          <button className="primary-button" type="submit">
            <LockKeyhole size={18} />
            Обновить пароль
          </button>
        </form>
      </section>

      <section className="profile-grid profile-grid--history">
        <div className="profile-history-column">
          <CourseList title="Мои курсы" icon={<BookOpen size={20} />} courses={createdCourses} />
          <CourseList title="Пройденные" icon={<Award size={20} />} courses={completedCourses} />
          <div className="teacher-panel">
            <div className="panel-title">
              <Award size={20} />
              <h2>Сертификаты</h2>
            </div>
            <div className="history-list">
              {certificates.length ? certificates.map((certificate) => (
                <Link className="history-item" to={`/courses/${certificate.course_id}/certificate`} key={certificate.id}>
                  <strong>{certificate.course_title}</strong>
                  <span>{certificate.code}</span>
                </Link>
              )) : <p className="helper-text">Сертификатов пока нет.</p>}
            </div>
          </div>
        </div>
        <div className="profile-history-column">
          <CourseList title="Я прохожу" icon={<BookOpen size={20} />} courses={enrolledCourses} />
          <TaskList tasks={completedTasks} showStudent={user?.role !== "student"} />
        </div>
      </section>
    </Layout>
  );
}

function CourseList({ title, icon, courses }: { title: string; icon: React.ReactNode; courses: CourseListItem[] }) {
  return (
    <div className="teacher-panel">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      <div className="history-list">
        {courses.length ? courses.map((course) => (
          <Link className="history-item" key={course.id} to={`/courses/${course.id}`}>
            <strong>{course.title}</strong>
            <span>{course.direction} · {course.progress_percent}%</span>
          </Link>
        )) : <p className="helper-text">Пока пусто.</p>}
      </div>
    </div>
  );
}

function TaskList({ tasks, showStudent }: { tasks: CompletedTask[]; showStudent: boolean }) {
  return (
    <div className="teacher-panel">
      <div className="panel-title">
        <CheckCircle2 size={20} />
        <h2>Выполненные задания</h2>
      </div>
      <div className="history-list">
        {tasks.length ? tasks.slice(0, 12).map((task) => (
          <Link className="history-item" key={`${task.user_id}-${task.task_id}`} to={`/courses/${task.course_id}`}>
            <strong>{task.task_title}</strong>
            <span>{task.course_title} · {task.lesson_title}</span>
            <small>
              {showStudent ? `${task.student_name} · ` : ""}
              {new Date(task.completed_at).toLocaleDateString("ru-RU")}
            </small>
          </Link>
        )) : <p className="helper-text">После правильных ответов здесь будет история выполненных заданий.</p>}
      </div>
    </div>
  );
}
