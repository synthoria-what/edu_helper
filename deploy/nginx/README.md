# Nginx for eduhelper.synthori.space

Use this setup when the server already has a shared public nginx that owns ports `80` and `443`.

Current scheme:

- Docker publishes the app frontend only on `127.0.0.1:8080`.
- The shared nginx accepts `https://eduhelper.synthori.space`.
- The shared nginx proxies all traffic to `http://127.0.0.1:8080`.
- The nginx inside the frontend container serves the React app and proxies `/api/*` to the backend container.

Copy or symlink:

```bash
sudo ln -s /path/to/project/deploy/nginx/eduhelper.synthori.space.conf /etc/nginx/sites-enabled/eduhelper.synthori.space.conf
sudo nginx -t
sudo systemctl reload nginx
```

Minimal production `.env`:

```env
POSTGRES_DB=edu_helper
POSTGRES_USER=postgres
POSTGRES_PASSWORD=strong-password
JWT_SECRET_KEY=super-secret-key
CORS_ORIGINS=https://eduhelper.synthori.space
FRONTEND_PORT=8080
```

Start or update containers:

```bash
docker compose up -d --build
```
