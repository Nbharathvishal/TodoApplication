# Deployment configuration

The frontend calls `https://todo-backend-zyqf.onrender.com` when served from a non-localhost domain. Keep that URL in `TodoFrontend/script.js` in sync with the public URL of the deployed Spring service.

## Spring backend

Deploy `SpringLearning` as a Docker web service using its `Dockerfile`. Attach a PostgreSQL database and configure these service environment variables:

- `SPRING_DATASOURCE_URL`: `jdbc:postgresql://<database-host>:<port>/<database-name>`
- `SPRING_DATASOURCE_USERNAME`: database username
- `SPRING_DATASOURCE_PASSWORD`: database password
- `JWT_SECRET`: a private random string of at least 32 bytes; keep it unchanged between deploys so existing tokens remain valid

Alternatively, `DATABASE_URL` is supported in PostgreSQL URI form (`postgresql://user:password@host:port/database`). Do not use localhost for the database in a hosted service: localhost refers to the service container itself.

The web service must be reachable over HTTPS. The backend already permits browser CORS requests, including preflight requests.

## Frontend

Host the contents of `TodoFrontend` as a static site over HTTPS. If the backend's public URL changes, update `SERVER_URL` in `TodoFrontend/script.js` to match. The localhost branch continues to target `http://localhost:8080` for local development.
