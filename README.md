# EduHelper

Веб-приложение для учебных заведений, где студенты проходят дополнительные интерактивные курсы, выполняют задания, видят прогресс и получают учебный сертификат после завершения курса.

## Стек

- Backend: FastAPI, SQLAlchemy Async, PostgreSQL, JWT
- Frontend: React, TypeScript, Vite, Recharts
- Инфраструктура: Docker Compose для PostgreSQL

## Быстрый запуск

1. Запустите весь стек через Docker:

```bash
docker compose up -d --build
```

После запуска:

- локально frontend будет доступен на `http://localhost`
- backend будет доступен через `http://localhost/api`

2. Локальная разработка без Docker:

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

В dev-режиме Vite проксирует `/api` на backend `http://localhost:8000`, поэтому фронтенд можно открывать на `http://localhost:5173` без ручной настройки CORS-URL.

## Docker-деплой

Для production используется один `docker-compose.yml`:

- `postgres` - база данных;
- `backend` - FastAPI + Uvicorn;
- `frontend` - собранный Vite через `Caddy`;
- `Caddy` внутри frontend отдает SPA, проксирует `/api/*` на backend и автоматически поднимает HTTPS для домена.

Для сервера нужен `.env` в корне проекта. Минимальный пример:

```env
POSTGRES_DB=edu_helper
POSTGRES_USER=postgres
POSTGRES_PASSWORD=strong-password
JWT_SECRET_KEY=super-secret-key
DOMAIN=eduhelper.synthori.space
CORS_ORIGINS=https://eduhelper.synthori.space
```

Для домена `eduhelper.synthori.space` нужно:

- чтобы A-запись домена указывала на IP сервера;
- чтобы порты `80` и `443` были открыты наружу;
- чтобы на сервере не было другого процесса, который уже занимает `80/443`.

Запуск на сервере:

```bash
docker compose up -d --build
```

После первого запуска Caddy сам выпустит сертификат, и приложение будет доступно по `https://eduhelper.synthori.space`.

Обновление:

```bash
git pull
docker compose up -d --build
```

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
- `DEPLOY_ENV_FILE` - содержимое production `.env`, которое workflow запишет на сервер.

Что делает workflow:

- подключается к серверу по SSH;
- обновляет код из git;
- записывает production `.env` из GitHub Secret;
- запускает `docker compose up -d --build`.

Предполагается, что на сервере уже установлены:

- `git`
- `docker`
- `docker compose`

Также предполагается, что репозиторий уже один раз склонирован на сервер в папку `DEPLOY_PATH`.

## Что уже реализовано

- регистрация и вход по JWT;
- PostgreSQL-модели пользователей, курсов, уроков, заданий, результатов и сертификатов;
- демонстрационный курс с интерактивными заданиями;
- прогресс по курсу;
- выдача сертификата после прохождения всех заданий;
- официальный светлый интерфейс с умеренными развлекательными элементами.
- авторский кабинет: создание и редактирование только своих курсов, добавление уроков, картинок, видео-ссылок и заданий;
- просмотр прогресса участников по своему курсу;
- последовательное прохождение заданий: следующее открывается только после правильного ответа на предыдущее;
- задания с графиками отвечаются кликом по варианту, а не ручным вводом.

## Демо-аккаунты

При запуске backend автоматически создает аккаунты, если их еще нет:

- пользователь: `student@example.com` / `student123`
- администратор: `admin@example.com` / `admin123`
