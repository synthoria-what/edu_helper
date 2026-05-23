import type {
  AdminUser,
  AuthResponse,
  Certificate,
  CompletedTask,
  CourseDetail,
  CourseListItem,
  CourseMutation,
  Lesson,
  LessonMutation,
  ProgressSummary,
  StudentProgress,
  Task,
  TaskMutation,
  TaskResult,
  User,
  UserRole,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "eduhelper_token";
const MAX_UPLOAD_SIZE_MB = 50;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: "Ошибка запроса" }));
    throw new Error(formatApiError(errorBody));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error("Сессия истекла. Войдите снова и повторите загрузку");
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Сессия истекла. Войдите снова и повторите загрузку");
    }
    if (response.status === 403) {
      throw new Error("Загружать картинки может только преподаватель или администратор");
    }
    if (response.status === 413) {
      throw new Error(`Размер картинки не должен превышать ${MAX_UPLOAD_SIZE_MB} МБ`);
    }
    const errorBody = await response.json().catch(() => ({ detail: "Ошибка загрузки" }));
    throw new Error(formatApiError(errorBody));
  }

  return response.json() as Promise<T>;
}

function resolveApiAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatApiError(errorBody: unknown): string {
  if (!isRecord(errorBody)) {
    return "Ошибка запроса";
  }

  const detail = errorBody.detail;
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail.map(formatValidationIssue).filter(Boolean);
    return messages.length ? messages.join("; ") : "Проверьте поля формы";
  }

  if (isRecord(detail)) {
    return formatValidationIssue(detail) || "Проверьте поля формы";
  }

  return "Ошибка запроса";
}

function formatValidationIssue(issue: unknown): string {
  if (!isRecord(issue)) {
    return "";
  }

  const fieldPath = Array.isArray(issue.loc)
    ? issue.loc
        .filter((part) => part !== "body")
        .map(String)
        .join(".")
    : "";
  const message = typeof issue.msg === "string" ? issue.msg : "некорректное значение";
  return fieldPath ? `${fieldPath}: ${message}` : message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export const api = {
  async register(fullName: string, email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name: fullName, email, password }),
    });
  },
  async login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  async me(): Promise<User> {
    return request<User>("/auth/me");
  },
  async users(): Promise<AdminUser[]> {
    return request<AdminUser[]>("/auth/users");
  },
  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    return request<User>(`/auth/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },
  async courses(): Promise<CourseListItem[]> {
    return request<CourseListItem[]>("/courses");
  },
  async course(id: string): Promise<CourseDetail> {
    return request<CourseDetail>(`/courses/${id}`);
  },
  async progress(): Promise<ProgressSummary> {
    return request<ProgressSummary>("/progress/summary");
  },
  async certificates(): Promise<Certificate[]> {
    return request<Certificate[]>("/progress/certificates");
  },
  async completedTasks(): Promise<CompletedTask[]> {
    return request<CompletedTask[]>("/progress/completed-tasks");
  },
  async createCourse(payload: CourseMutation): Promise<CourseListItem> {
    return request<CourseListItem>("/courses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateCourse(courseId: number, payload: CourseMutation): Promise<CourseListItem> {
    return request<CourseListItem>(`/courses/${courseId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteCourse(courseId: number): Promise<void> {
    await request<void>(`/courses/${courseId}`, { method: "DELETE" });
  },
  async createLesson(courseId: number, payload: LessonMutation): Promise<Lesson> {
    return request<Lesson>(`/courses/${courseId}/lessons`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateLesson(lessonId: number, payload: LessonMutation): Promise<Lesson> {
    return request<Lesson>(`/courses/lessons/${lessonId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteLesson(lessonId: number): Promise<void> {
    await request<void>(`/courses/lessons/${lessonId}`, { method: "DELETE" });
  },
  async uploadImage(file: File): Promise<{ url: string }> {
    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      throw new Error(`Размер картинки не должен превышать ${MAX_UPLOAD_SIZE_MB} МБ`);
    }

    const formData = new FormData();
    formData.append("file", file);
    const uploaded = await upload<{ url: string }>("/uploads/images", formData);
    return { url: resolveApiAssetUrl(uploaded.url) };
  },
  async createTask(lessonId: number, payload: TaskMutation): Promise<Task> {
    return request<Task>(`/courses/lessons/${lessonId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateTask(taskId: number, payload: TaskMutation): Promise<Task> {
    return request<Task>(`/courses/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteTask(taskId: number): Promise<void> {
    await request<void>(`/courses/tasks/${taskId}`, { method: "DELETE" });
  },
  async courseStudents(courseId: number): Promise<StudentProgress[]> {
    return request<StudentProgress[]>(`/courses/${courseId}/students`);
  },
  async submitTask(taskId: number, answer: string): Promise<{ result: TaskResult; message: string }> {
    return request<{ result: TaskResult; message: string }>(`/courses/tasks/${taskId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
  },
  async issueCertificate(courseId: number): Promise<Certificate> {
    return request<Certificate>(`/courses/${courseId}/certificate`, { method: "POST" });
  },
};
