import { BookOpenCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth";

export function LoginPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("Пользователь Демонстрационный");
  const [email, setEmail] = useState("student@example.com");
  const [password, setPassword] = useState("student123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(fullName, email, password);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось выполнить вход");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <div className="brand large">
          <span className="brand-mark">
            <BookOpenCheck size={26} />
          </span>
          <span>EduHelper</span>
        </div>
        <h1>Кабинет интерактивных учебных курсов</h1>
        <p>Проходите короткие модули, решайте задания с графиками и квизами, отслеживайте прогресс.</p>
      </section>

      <form className="auth-form" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Вход
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Регистрация
          </button>
        </div>

        {mode === "register" && (
          <label>
            ФИО
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
          <BookOpenCheck size={18} />
          {mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
    </main>
  );
}
