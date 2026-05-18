import type {
  AdminUser,
  AuthResponse,
  Certificate,
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

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "eduhelper_token";

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
    throw new Error(errorBody.detail ?? "Ошибка запроса");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
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
