export type User = {
  id: string;
  full_name: string;
  email: string;
  role: "student" | "admin";
};

export type UserRole = User["role"];

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: User;
};

export type TaskResult = {
  task_id: number;
  answer: string;
  is_correct: boolean;
  score: number;
  completed_at: string;
};

export type TaskType = "quiz" | "chart" | "rebus";

export type Task = {
  id: number;
  type: TaskType;
  title: string;
  prompt: string;
  payload: Record<string, unknown>;
  correct_answer: string | null;
  image_url: string | null;
  order_index: number;
  result: TaskResult | null;
};

export type Lesson = {
  id: number;
  title: string;
  content: string;
  video_url: string | null;
  image_url: string | null;
  order_index: number;
  tasks: Task[];
};

export type CourseListItem = {
  id: number;
  title: string;
  description: string;
  direction: string;
  level: string;
  duration_minutes: number;
  price_rubles: number;
  image_url: string | null;
  total_tasks: number;
  completed_tasks: number;
  progress_percent: number;
};

export type Certificate = {
  id: string;
  course_id: number;
  course_title: string;
  student_name: string;
  code: string;
  issued_at: string;
};

export type CourseDetail = CourseListItem & {
  lessons: Lesson[];
  certificate: Certificate | null;
};

export type ProgressSummary = {
  courses_total: number;
  completed_courses: number;
  tasks_total: number;
  completed_tasks: number;
  average_progress: number;
};

export type CompletedTask = {
  task_id: number;
  task_title: string;
  course_id: number;
  course_title: string;
  lesson_title: string;
  answer: string;
  score: number;
  completed_at: string;
  user_id: string;
  student_name: string;
  student_email: string;
};

export type CourseMutation = {
  title: string;
  description: string;
  direction: string;
  level: string;
  duration_minutes: number;
  price_rubles: number;
  image_url?: string | null;
};

export type LessonMutation = {
  title: string;
  content: string;
  video_url?: string | null;
  image_url?: string | null;
  order_index: number;
};

export type TaskMutation = {
  type: TaskType;
  title: string;
  prompt: string;
  payload: Record<string, unknown>;
  correct_answer: string;
  image_url?: string | null;
  order_index: number;
};

export type StudentProgress = {
  user_id: string;
  full_name: string;
  email: string;
  completed_tasks: number;
  total_tasks: number;
  progress_percent: number;
  certificate_code: string | null;
  completed_task_titles: string[];
};

export type AdminUser = User & {
  created_at: string;
};
