# Deployment Configuration — TaskVerse Automatic Backend Environment

TaskVerse automatically selects the appropriate backend API target based on the environment:

- **Local Development**: When accessed from `localhost`, `127.0.0.1`, `[::1]`, or `file:`, API requests automatically target `http://localhost:8080`.
- **Production (Live)**: When deployed to live servers (e.g. Render, Vercel, Netlify), API requests automatically target `https://todo-backend-zyqf.onrender.com`.

No manual API target switching is required by users or developers.

## Centralized Environment Variables

- `.env.development`: `API_BASE_URL=http://localhost:8080`
- `.env.production`: `API_BASE_URL=https://todo-backend-zyqf.onrender.com`
- `TodoFrontend/config.js` and `TodoFrontend/script.js`: Centralized runtime resolution (`window.__ENV__` fallback to hostname detection).

## Spring backend

Deploy `SpringLearning` as a Docker web service using its `Dockerfile`. Attach a PostgreSQL database and configure these service environment variables:

- `SPRING_DATASOURCE_URL`: `jdbc:postgresql://<database-host>:<port>/<database-name>`
- `SPRING_DATASOURCE_USERNAME`: database username
- `SPRING_DATASOURCE_PASSWORD`: database password
- `JWT_SECRET`: a private random string of at least 32 bytes; keep it unchanged between deploys so existing tokens remain valid

Alternatively, `DATABASE_URL` is supported in PostgreSQL URI form (`postgresql://user:password@host:port/database`). Do not use localhost for the database in a hosted service: localhost refers to the service container itself.

The web service must be reachable over HTTPS. The backend already permits browser CORS requests from all origins (`setAllowedOriginPatterns(List.of("*"))`) with credentials enabled.

## Frontend

Host the contents of `TodoFrontend` as a static web site over HTTPS. When loaded in production, it will automatically connect to `https://todo-backend-zyqf.onrender.com` without prompting the user.
