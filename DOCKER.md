# Docker launch

Minimal start:

```bash
cp .env.example .env
# Edit DATABASE_URL in .env before starting.
docker compose up -d --build
docker compose ps
```

By default Docker publishes only local ports for the host nginx:

- frontend: `127.0.0.1:8080`
- backend: `127.0.0.1:8000`

The frontend image does not include nginx. It builds the React app and serves it with Vite preview. Configure the host nginx to proxy routes separately:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8000/;
}

location / {
  proxy_pass http://127.0.0.1:8080;
}
```

For a temporary direct frontend check from another machine, set this in `.env` before starting:

```env
FRONTEND_HOST=0.0.0.0
FRONTEND_PORT=8080
```

Useful checks on the server:

```bash
docker compose config
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8000/health
docker compose logs -f backend
```

The backend and frontend images include healthchecks.
