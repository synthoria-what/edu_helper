import { BookOpenCheck, LogOut, Medal, PencilRuler, ShieldCheck, UserRound } from "lucide-react";
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
          <Link className="topbar-link" to="/my-courses">
            <PencilRuler size={16} />
            Мои курсы
          </Link>
          {user?.role === "admin" && (
            <Link className="topbar-link" to="/admin">
              <ShieldCheck size={16} />
              Панель администратора
            </Link>
          )}
          <Link className="topbar-link" to="/profile">
            <UserRound size={16} />
            Профиль
          </Link>
          <span className="user-chip">
            {user?.avatar_url ? <img className="user-chip-avatar" src={user.avatar_url} alt="" /> : <Medal size={16} />}
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
