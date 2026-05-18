# Nginx for eduhelper.synthori.space

Use this setup when the server already has a shared public nginx that owns ports `80` and `443`.

Current scheme:

- Docker publishes local debug ports `127.0.0.1:8080` and `127.0.0.1:8000`.
- The nginx container and app containers must share the external Docker network `proxy-network`.
- The nginx container proxies `/api/*` to `http://backend:8000`.
- The nginx container proxies the React app to `http://frontend:4173`.

Copy or symlink:

```bash
sudo ln -s /path/to/project/deploy/nginx/eduhelper.synthori.space.conf /etc/nginx/sites-enabled/eduhelper.synthori.space.conf
sudo nginx -t
sudo systemctl reload nginx
```

Minimal production `.env`:

```env
DB_HOST=ru.synthori.space
DB_PORT=5432
DB_NAME=edu_helper
DB_USER=edu_helper_user
DB_PASSWORD=strong-password
JWT_SECRET_KEY=super-secret-key
CORS_ORIGINS=https://eduhelper.synthori.space
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_HOST=127.0.0.1
FRONTEND_PORT=8080
```

Start or update containers:

```bash
docker network create proxy-network
docker compose up -d --build
```
