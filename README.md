# Tidepost Console

Tidepost is a social-media management console built with **Next.js App Router**, TypeScript, PostgreSQL, Redis and BullMQ. The migration preserves the existing Express API as an optional legacy service and keeps the publishing worker as a separate process.

> **Important integration status:** The dashboard, workspace registration/login, post persistence and scheduled-job queue are implemented. The provider publisher currently supports Facebook Page text posts, Instagram image posts, LinkedIn text posts and X text posts when correctly configured. TikTok is deliberately rejected for text-only publishing because its publishing flow requires video upload. OAuth authorization/account linking, provider permissions, webhook sync, analytics ingestion and end-to-end live provider verification are not complete. Never assume a connected account can publish until its provider configuration and scopes have been verified.

## Stack and requirements

- Node.js 22+
- PostgreSQL 14+
- Redis 6+
- npm
- A strong random `JWT_SECRET` (at least 32 characters)
- A base64-encoded 32-byte `SOCIAL_TOKEN_ENCRYPTION_KEY` for encrypted provider token bundles

## Run locally

1. Create a PostgreSQL database and a Redis instance.
2. Copy `.env.example` to `.env`; set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` and (when working with provider tokens) `SOCIAL_TOKEN_ENCRYPTION_KEY`.
3. Install dependencies and apply the schema:

   ```bash
   npm install
   npm run db:migrate
   ```

4. Start the Next.js app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`, create an account and sign in. Production uses HTTP-only, same-site session cookies; set HTTPS in production so the cookie is Secure.
6. For scheduled posts, start the worker in a separate terminal:

   ```bash
   npm run worker:publish
   ```

Redis must be available to schedule posts. The worker and Next.js app must share the same database and Redis configuration.

## Runtime scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js development server |
| `npm run build` | Production Next.js build |
| `npm start` | Production Next.js server |
| `npm run typecheck` | TypeScript validation |
| `npm run db:migrate` | Apply the idempotent initial schema |
| `npm run worker:publish` | Separate BullMQ publishing worker |
| `npm run start:legacy` | Optional legacy Express API (uses `PORT`, default 3000; choose a different port if Next.js is running) |

The schema migration is an idempotent initial bootstrap, not yet a versioned migration framework. Back up production data before schema changes.

## Application capabilities

- Workspace registration, login, logout and role checks.
- HTTP-only JWT session cookie (12-hour expiry) and password hashing with bcrypt.
- Workspace-scoped dashboard data from PostgreSQL.
- Create drafts and schedule posts using Zod validation and server actions.
- BullMQ queue with retries/backoff and a separate worker process.
- Publish-attempt records and skip logic for platforms already recorded as successful during retries.
- AES-256-GCM decryption for provider token bundles; refreshed tokens are re-encrypted before persistence.
- A conservative dashboard that displays no reach value until analytics ingestion is implemented.

## Provider token format

The publisher expects `social_accounts.token_ciphertext` in this format:

```text
v1:<base64-iv>:<base64-auth-tag>:<base64-ciphertext>
```

The decrypted JSON bundle contains `accessToken`, optional `refreshToken`, and optional `expiresAt` (Unix milliseconds). The encryption key is `SOCIAL_TOKEN_ENCRYPTION_KEY`, encoded as base64 and exactly 32 bytes after decoding. Generate a new key with:

```bash
openssl rand -base64 32
```

Do not change or rotate this key without a token re-encryption/rotation procedure. Existing plaintext or differently encrypted tokens are not automatically migrated. Tokens and client secrets must never be sent to the browser or committed to Git.

## Provider limitations and environment

- **Facebook Pages:** text posts use the Graph API Page feed endpoint. Requires an authorized Page token and correct Meta permissions.
- **LinkedIn:** text posts use the Posts API and require `LINKEDIN_API_VERSION`, an approved app and the correct author URN/scopes.
- **X:** text posts use API v2 and require suitable OAuth 2.0 user context and write scopes.
- **Instagram:** image posts use the Graph API media-container then media-publish flow. Supply a publicly accessible HTTPS image URL. Video, carousel, Stories and other media types are not implemented.
- **TikTok:** text-only publishing is disabled; implement the approved video upload/publish flow before enabling.
- Meta token refresh is deliberately not guessed; implement and validate the approved Meta token lifecycle for your app type. LinkedIn, X and TikTok refresh calls depend on the stored refresh token and server-side credentials.

The worker must not be treated as production-ready until OAuth/account linking, token encryption on write, provider scopes, token refresh, rate limits, duplicate-send/idempotency behavior and provider sandbox/live tests are complete. Provider APIs can change; verify endpoint versions and permissions against each platform's current official documentation before launch.

## CI verification

GitHub Actions runs dependency installation, TypeScript checking, a Next.js production build and syntax checks for the retained Express/worker code on pushes to `feat/nextjs-migration` and pull requests to `main`. A successful build proves compilation, not live database/Redis connectivity or successful provider publishing.

## Deployment checklist

1. Configure PostgreSQL with TLS and Redis with authentication/TLS where supported.
2. Set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SOCIAL_TOKEN_ENCRYPTION_KEY` and provider credentials in the deployment secret manager.
3. Run `npm run db:migrate` as a release step; back up the database first.
4. Deploy `npm run build` and `npm start` for the web app.
5. Run `npm run worker:publish` as a separate long-running worker process.
6. Add rate limiting for Next.js registration/login actions, monitoring, backup/restore tests, account disconnect/revocation flows, and a versioned migration system before production use.
7. Complete OAuth, token storage and refresh, provider permission checks, retry/idempotency tests, and analytics ingestion before advertising live publishing or reach metrics.
