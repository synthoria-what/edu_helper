# Docker launch

Minimal start:

```bash
cp .env.example .env
# Edit DB_PASSWORD in .env before starting.
docker network create proxy-network
docker compose up -d --build
docker compose ps
```

The app joins the external Docker network `proxy-network`, so an nginx container on the same network can proxy to:

- frontend: `http://frontend:4173`
- backend: `http://backend:8000`

The frontend image does not include nginx. It builds the React app and serves it with Vite preview. Configure the nginx container like this:

```nginx
location /api/ {
  proxy_pass http://backend:8000/;
}

location / {
  proxy_pass http://frontend:4173;
}
```

The compose file also publishes local host ports for debugging:

- frontend: `127.0.0.1:8080`
- backend: `127.0.0.1:8000`

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
