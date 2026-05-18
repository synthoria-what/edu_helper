import { ShieldCheck, Users, UserRoundCog } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "../api";
import { useAuth } from "../auth";
import { Layout } from "../components/Layout";
import type { AdminUser, UserRole } from "../types";

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filter, setFilter] = useState<"all" | UserRole>("all");
  const [message, setMessage] = useState("");

  const canManage = user?.role === "admin";

  async function loadUsers() {
    try {
      setUsers(await api.users());
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить пользователей");
    }
  }

  useEffect(() => {
    if (canManage) {
      void loadUsers();
    }
  }, [canManage]);

  async function changeRole(userId: string, role: UserRole) {
    try {
      await api.updateUserRole(userId, role);
      await loadUsers();
      setMessage("Роль обновлена");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось изменить роль");
    }
  }

  if (!canManage) {
    return (
      <Layout>
        <div className="screen-loader">Раздел доступен только администратору</div>
      </Layout>
    );
  }

  const visibleUsers = users.filter((item) => filter === "all" || item.role === filter);
  const teachersCount = users.filter((item) => item.role === "teacher").length;
  const studentsCount = users.filter((item) => item.role === "student").length;

  return (
    <Layout>
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Роль администратора</span>
          <h1>Управление аккаунтами и ролями</h1>
          <p>Здесь видны студенты, преподаватели и администраторы. Роль можно менять прямо в списке.</p>
        </div>
        <div className="summary-strip">
          <SummaryCard icon={<Users size={20} />} label="Всего" value={users.length} />
          <SummaryCard icon={<UserRoundCog size={20} />} label="Преподаватели" value={teachersCount} />
          <SummaryCard icon={<ShieldCheck size={20} />} label="Студенты" value={studentsCount} />
        </div>
      </section>

      {message && <div className="teacher-message">{message}</div>}

      <section className="admin-shell">
        <div className="admin-filter-row">
          <button className={filter === "all" ? "filter-chip active" : "filter-chip"} type="button" onClick={() => setFilter("all")}>
            Все
          </button>
          <button
            className={filter === "student" ? "filter-chip active" : "filter-chip"}
            type="button"
            onClick={() => setFilter("student")}
          >
            Студенты
          </button>
          <button
            className={filter === "teacher" ? "filter-chip active" : "filter-chip"}
            type="button"
            onClick={() => setFilter("teacher")}
          >
            Преподаватели
          </button>
          <button
            className={filter === "admin" ? "filter-chip active" : "filter-chip"}
            type="button"
            onClick={() => setFilter("admin")}
          >
            Админы
          </button>
        </div>

        <div className="admin-table">
          {visibleUsers.map((item) => {
            const isCurrentAdmin = item.id === user?.id;
            return (
              <article className="admin-user-card" key={item.id}>
                <div className="admin-user-main">
                  <strong>{item.full_name}</strong>
                  <span>{item.email}</span>
                </div>
                <div className="admin-user-meta">
                  <span>{new Date(item.created_at).toLocaleDateString("ru-RU")}</span>
                  <select
                    value={item.role}
                    onChange={(event) => void changeRole(item.id, event.target.value as UserRole)}
                    disabled={isCurrentAdmin}
                  >
                    <option value="student">Студент</option>
                    <option value="teacher">Преподаватель</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
                {isCurrentAdmin && <small className="helper-text">Свою роль нельзя изменить из интерфейса.</small>}
              </article>
            );
          })}
        </div>
      </section>
    </Layout>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="summary-item">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
