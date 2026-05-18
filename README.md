# EduHelper

Веб-приложение для учебных заведений, где студенты проходят дополнительные интерактивные курсы, выполняют задания, видят прогресс и получают учебный сертификат после завершения курса.

## Стек

- Backend: FastAPI, SQLAlchemy Async, PostgreSQL, JWT
- Frontend: React, TypeScript, Vite, Recharts
- Инфраструктура: Docker Compose для PostgreSQL

## Быстрый запуск

1. Запустите PostgreSQL:

```bash
docker compose up -d postgres
```

2. Настройте backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

3. Настройте frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend будет доступен на `http://localhost:8000`, frontend - на `http://localhost:5173`.

## Автодеплой

В проект добавлен GitHub Actions workflow: `.github/workflows/deploy.yml`.

Он запускается:

- при push в ветку `main`;
- вручную через `workflow_dispatch`.

Для работы нужно добавить GitHub Secrets:

- `SSH_HOST` - IP или домен сервера;
- `SSH_USER` - пользователь на сервере;
- `SSH_PRIVATE_KEY` - приватный SSH-ключ для входа;
- `SSH_PORT` - SSH-порт, обычно `22`;
- `DEPLOY_PATH` - путь до папки проекта на сервере;
- `DEPLOY_BRANCH` - ветка деплоя, обычно `main`;
- `BACKEND_SERVICE_NAME` - имя systemd-сервиса backend;
- `FRONTEND_SERVICE_NAME` - имя systemd-сервиса frontend, если frontend тоже крутится как сервис.

Что делает workflow:

- подключается к серверу по SSH;
- обновляет код из git;
- создает или обновляет `backend/.venv`;
- устанавливает backend-зависимости;
- собирает frontend через `npm run build`;
- перезапускает backend и frontend через `systemctl`.

Предполагается, что на сервере уже установлены:

- `git`
- `python3`
- `node` и `npm`
- `systemd`

Также предполагается, что репозиторий уже один раз склонирован на сервер в папку `DEPLOY_PATH`.

## Что уже реализовано

- регистрация и вход по JWT;
- PostgreSQL-модели пользователей, курсов, уроков, заданий, результатов и сертификатов;
- демонстрационный курс с интерактивными заданиями;
- прогресс по курсу;
- выдача сертификата после прохождения всех заданий;
- официальный светлый интерфейс с умеренными развлекательными элементами.
- кабинет преподавателя: создание и редактирование курсов, добавление уроков, картинок, видео-ссылок и заданий;
- просмотр прогресса студентов по курсу;
- последовательное прохождение заданий: следующее открывается только после правильного ответа на предыдущее;
- задания с графиками отвечаются кликом по варианту, а не ручным вводом.

## Демо-аккаунты

При запуске backend автоматически создает аккаунты, если их еще нет:

- студент: `student@example.com` / `student123`
- преподаватель: `teacher@example.com` / `teacher123`
- администратор: `admin@example.com` / `admin123`
