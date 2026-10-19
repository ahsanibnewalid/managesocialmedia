# Tidepost Console

Tidepost is a social-media management console with a responsive React-based UI and a Node.js REST API foundation. The repository now includes persistent PostgreSQL storage, account registration/login, workspace access control, content CRUD, inbox workflow storage, and audit events.

> **Integration status:** Drafts, scheduled-post records, inbox threads and saved replies are persisted by the API. Actual publishing, OAuth account linking, social-network inbox synchronization, media upload, and live analytics ingestion still require platform credentials and provider-specific implementations. Demo content in the UI is not live social data.

## Included
- Responsive console UI and per-platform post preview concepts for Facebook, Instagram, LinkedIn, X and TikTok.
- Express API with PostgreSQL schema initialization.
- Password hashing with bcrypt, JWT authentication and rate-limited authentication endpoints.
- Workspace membership roles and server-side access checks.
- Draft/scheduled post create, list, edit and delete.
- Inbox thread list, unread state, assignment field and saved replies.
- Workspace overview, audit events, security headers, input validation and parameterized SQL.

## Requirements
- Node.js 22+
- PostgreSQL 14+
- A strong random JWT_SECRET of at least 32 characters.

## Run locally
1. Create a PostgreSQL database named tidepost.
2. Copy .env.example to .env; configure DATABASE_URL and JWT_SECRET.
3. Install and start:

    npm install
    npm start

4. Open http://localhost:3000 and verify http://localhost:3000/api/health.

Tables are created on startup. In production, use TLS, a managed PostgreSQL service with TLS, secret environment variables, regular backups, monitoring and a strong JWT secret. Never commit .env or credentials.

## API
Except for health, registration and login, endpoints require Authorization: Bearer <token>.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | API and database health |
| POST | /api/auth/register | Create account and initial workspace |
| POST | /api/auth/login | Authenticate |
| GET | /api/auth/me | Current account |
| GET | /api/workspaces | List accessible workspaces |
| GET | /api/workspaces/:id/overview | Post, account and inbox counts |
| GET/POST | /api/workspaces/:id/posts | List/create posts |
| PATCH/DELETE | /api/workspaces/:id/posts/:postId | Update/delete a post |
| GET | /api/workspaces/:id/inbox | List inbox threads and saved replies |
| PATCH | /api/workspaces/:id/inbox/:threadId | Update unread/assignment state |
| POST | /api/workspaces/:id/inbox/:threadId/replies | Save a reply draft |
| GET | /api/workspaces/:id/audit | Recent audit events (owner/admin) |

Registration JSON: {"name":"Example User","email":"you@example.com","password":"at-least-12-characters"}

Post JSON: {"text":"A post draft","platforms":["instagram","facebook"],"status":"draft"}. Scheduled posts also need an ISO-8601 scheduledAt.

## Scheduled publishing worker foundation

The repository includes a BullMQ/Redis queue and a separate worker process for scheduled posts. Configure `REDIS_URL` in `.env`, run Redis, then start the API with `npm start` and the worker separately with `npm run worker:publish`. Scheduled posts are queued when created through the workspace posts API. If Redis is unavailable, the post remains saved and the API returns a warning so it can be recovered.

**Publishing is not live yet.** The worker records publish attempts and fails safely because provider-specific OAuth, token decryption, permissions, and actual Facebook/Instagram/LinkedIn/X/TikTok API adapters have not been configured. It never pretends that a post was published. Do not treat the worker foundation as production-ready until real adapters and idempotency/recovery tests are implemented.

## Provider integration and production checklist
1. Register OAuth apps for each platform and configure redirect URLs.
2. Implement OAuth, token refresh and encrypted token storage. Keep secrets out of browser code.
3. Implement provider-specific publish workers with retries, rate-limit handling, idempotency and failure review.
4. Verify scopes, account ownership, webhook signatures and user consent.
5. Connect each UI view to authenticated API data and remove demo data once workspace data loads.
6. Add automated API/UI tests, versioned migrations, backup/restore, monitoring and deployment TLS/CORS configuration.

Social APIs differ in permissions and capabilities; connecting an account does not guarantee that every publishing or inbox action is available.
