import { BookOpenCheck, LogOut, Medal, PencilRuler, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <BookOpenCheck size={22} />
          </span>
          <span>EduHelper</span>
        </Link>
        <div className="topbar-actions">
          {(user?.role === "teacher" || user?.role === "admin") && (
            <Link className="topbar-link" to="/teacher">
              <PencilRuler size={16} />
              Кабинет преподавателя
            </Link>
          )}
          {user?.role === "admin" && (
            <Link className="topbar-link" to="/admin">
              <ShieldCheck size={16} />
              Панель администратора
            </Link>
          )}
          <span className="user-chip">
            <Medal size={16} />
            {user?.full_name}
          </span>
          <button className="icon-button" type="button" onClick={handleLogout} title="Выйти">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
