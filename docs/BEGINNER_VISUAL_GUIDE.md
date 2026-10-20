# Tidepost Console — Visual Beginner's Guide

> **Who this is for:** someone who wants to use or host Tidepost but is new to software development. You do not need to understand every technical word. Follow the steps in order and use the diagrams as maps.

## First: what is Tidepost?

![Illustrative dashboard preview](images/dashboard-preview.svg)

> These pictures are explanatory mockups, not screenshots of a live running instance. Sample counts and post names are fictional; use the app itself to verify real features and data.

Tidepost is a dashboard for preparing social-media posts and sending them to connected social accounts. Think of it like a central desk: you write a post in one place, choose supported platforms, and Tidepost sends it using the permissions you granted.

```mermaid
flowchart LR
    YOU["👤 You"] --> DASH["🖥️ Tidepost dashboard"]
    DASH --> QUEUE["📋 Publishing queue"]
    QUEUE --> WORKER["⚙️ Background worker"]
    WORKER --> FB["Facebook"]
    WORKER --> IG["Instagram"]
    WORKER --> LI["LinkedIn"]
    WORKER --> X["X"]
    WORKER --> TT["TikTok"]
    FB --> STATS["📊 Supported saved statistics"]
    IG --> STATS
    X --> STATS
    TT --> STATS
    STATS --> DASH
```

**In everyday language:** the dashboard is where you work, the queue is a to-do list, and the worker is a helper that carries out scheduled publishing tasks. Each social platform still controls its own permissions and API access.

## Before you begin: the checklist

| Item | What it means | Ready? |
|---|---|---|
| Node.js 22 or newer | Runs the web app | ☐ |
| PostgreSQL 14 or newer | Stores users, workspaces, posts and records | ☐ |
| Redis 6 or newer | Helps manage the publishing task queue | ☐ |
| Provider developer apps | Let Tidepost request permission to act on your social accounts | ☐ |
| A secure encryption key and app secrets | Protect credentials and sessions | ☐ |

For a first local test, install the software on your own computer. For a public production service, you also need a secure HTTPS address and a hosting setup.

## Step 1 — Understand the pieces

```mermaid
flowchart TB
    B["🌐 Browser<br/>What you see"] --> W["🖥️ Tidepost web app<br/>Dashboard and forms"]
    W --> DB[("🗄️ PostgreSQL<br/>Saved app data")]
    W --> R[("📬 Redis<br/>Task queue support")]
    R --> Q["⚙️ Publishing worker<br/>Runs separately"]
    Q --> DB
    Q --> API["🔗 Social platform APIs"]
```

- **Browser:** your window into Tidepost.
- **Web app:** receives your clicks and displays pages.
- **PostgreSQL:** the organized filing cabinet for app data.
- **Redis:** helps keep track of jobs waiting to run.
- **Worker:** a separate process that sends publishing jobs.
- **Social platform API:** the official connection point provided by a platform.

The web app and worker must use the same database, Redis connection, and token-encryption key. If one of those settings differs, publishing or account access may fail.

## Step 2 — Prepare the settings file

The project includes an example settings file named `.env.example`. Make a copy called `.env` in the project folder and fill in the values for your own setup.

```mermaid
flowchart TD
    A["📁 Project folder"] --> B["Copy .env.example"]
    B --> C["Rename the copy to .env"]
    C --> D["Add database and Redis addresses"]
    D --> E["Add strong secret values"]
    E --> F["Save locally; never publish secrets"]
```

Minimum settings include:

- `APP_URL`: the address where Tidepost opens. OAuth callback URLs must match it exactly.
- `DATABASE_URL`: how Tidepost reaches PostgreSQL.
- `REDIS_URL`: how Tidepost reaches Redis.
- `JWT_SECRET`: a strong secret used for signed login sessions.
- `SOCIAL_TOKEN_ENCRYPTION_KEY`: a base64-encoded 32-byte key that protects stored social-account tokens.

Generate the encryption key with:

```bash
openssl rand -base64 32
```

**Important:** treat `.env` like a key to your house. Do not upload it to GitHub, paste it into public chats, or share it in screenshots. Keep the same encryption key for the web app and worker. Losing it can make previously stored social tokens unreadable.

## Step 3 — Install and start Tidepost locally

![Beginner-friendly setup roadmap](images/setup-steps.svg)


```mermaid
flowchart TD
    A["1. Open a terminal in the project folder"] --> B["2. Run npm ci"]
    B --> C["3. Run npm run db:migrate"]
    C --> D["4. Run npm run dev"]
    D --> E["5. Open http://localhost:3000"]
    E --> F["6. Register and sign in"]
    F --> G["Dashboard appears"]
```

Run these commands one at a time:

```bash
npm ci
npm run db:migrate
npm run dev
```

Then open **http://localhost:3000** in your browser.

- `npm ci` downloads the project's required packages.
- `npm run db:migrate` prepares the database tables.
- `npm run dev` starts the website for local development.

Keep that terminal open while you use the app. To stop the development server, press `Ctrl+C` in that terminal.

## Step 4 — Start the publishing helper

Open a **second terminal** in the same project folder. Do not close the first terminal.

```mermaid
flowchart LR
    T1["Terminal 1<br/>npm run dev<br/>🌐 Website"] --- USER["You use the browser"]
    T2["Terminal 2<br/>npm run worker:publish<br/>⚙️ Publisher"]
    USER --> T1
    T1 --> DB[("Same PostgreSQL")]
    T2 --> DB
    T2 --> REDIS[("Same Redis")]
```

Run:

```bash
npm run worker:publish
```

The website and worker are two different jobs. The website shows the dashboard; the worker handles queued publishing work. A post may remain queued if the worker is not running or cannot connect to Redis/database.

## Step 5 — Connect a social account

```mermaid
sequenceDiagram
    actor You
    participant Tidepost
    participant Platform as Social platform
    You->>Tidepost: Click Connect
    Tidepost->>Platform: Ask for authorization
    Platform->>You: Show login and permission screen
    You->>Platform: Approve or cancel
    Platform-->>Tidepost: Return authorization result
    Tidepost->>Tidepost: Protect and save granted token
    Tidepost-->>You: Show connection result
```

1. A workspace owner/admin starts connecting a supported account from **Connected Accounts**.
2. Tidepost sends you to the platform's own authorization page.
3. Read the requested permissions carefully and approve only if you trust the app.
4. The platform sends you back to Tidepost.
5. Tidepost encrypts the granted token before storing it.

**A successful build does not mean OAuth has been tested with your provider account.** You need your own correctly configured developer app, client credentials, approved permissions and an account you control. Provider review/approval may be required.

## Step 6 — Create and publish a post

![Illustrative calendar showing how scheduled content can be organized](images/calendar-preview.svg)


```mermaid
flowchart TD
    A["✍️ Write post"] --> B["Choose connected platform(s)"]
    B --> C{"Does the media match?"}
    C -- "Instagram" --> D["Use a public HTTPS image URL"]
    C -- "TikTok" --> E["Use a public HTTPS video URL"]
    C -- "Text platforms" --> F["Enter text"]
    D --> G["Submit post"]
    E --> G
    F --> G
    G --> H["📋 Job enters queue"]
    H --> I["⚙️ Worker sends request"]
    I --> J{"Platform accepts it?"}
    J -- Yes --> K["✅ Success attempt recorded"]
    J -- No --> L["⚠️ Retry or inspect error"]
```

Begin with a test post to an account you own. Platform-specific rules matter:

- **Facebook:** Page publishing requires the correct Page and approved permissions.
- **Instagram:** this implementation expects a professional account connected to a Facebook Page and a publicly reachable HTTPS image URL.
- **LinkedIn:** text publishing is implemented, subject to app access and scopes.
- **X:** text publishing is implemented, subject to OAuth write access.
- **TikTok:** this implementation uses URL-pull video publishing; the video URL/domain must be publicly reachable and verified as required by TikTok. Approved API access and scopes are needed.

Do not select incompatible media types together. Review the published post in the actual platform to confirm the result.

### What happens when a post fails?

```mermaid
flowchart TD
    A["Worker tries to publish"] --> B{"Temporary error?"}
    B -- Yes --> C["Queue may retry with backoff"]
    C --> D{"Already recorded successful?"}
    D -- Yes --> E["Skip that successful platform"]
    D -- No --> A
    B -- No --> F["Inspect account permissions, URL and logs"]
    F --> G["Reconnect or correct settings"]
```

The queue retries certain failures and recorded successful platform attempts are skipped on later retries. However, some platforms do not support idempotency keys. If a platform accepts a post and the worker crashes before saving that success, a duplicate or uncertain result is still possible. Check the provider's own account before manually retrying uncertain posts.

## Step 7 — Understand analytics

![Illustrative analytics chart with sample values only](images/analytics-preview.svg)


```mermaid
flowchart LR
    A["Trusted scheduler"] --> B["Protected analytics endpoint"]
    B --> C["Ask supported provider APIs for metrics"]
    C --> D[("Save available values")]
    D --> E["Dashboard displays saved metrics"]
```

Analytics are not automatically real-time. A trusted scheduler must call `POST /api/cron/analytics` with the configured `CRON_SECRET` in an authorization header. Never place this secret in browser code.

- Facebook/Instagram: available insights depend on API version, account type and granted permissions.
- X: public engagement metrics are ingested; impressions are not claimed without suitable API access.
- TikTok: video metrics may be available for the connected account and granted scopes.
- LinkedIn: analytics ingestion is **not implemented**; Tidepost should not invent numbers.

A dash or empty metric usually means no supported values have been synced yet, or the provider does not grant access to that metric.

## Step 8 — Run the project checks

```mermaid
flowchart TD
    A["npm run typecheck"] --> B["Types checked"]
    B --> C["npm test"]
    C --> D["Automated tests"]
    D --> E["npm run build"]
    E --> F["Production bundle built"]
    F --> G["Then perform live provider tests"]
```

Run:

```bash
npm run typecheck
npm test
npm run build
```

These checks help catch code, test and build problems. They do **not** prove that your real provider credentials, permissions, publishing, refresh, revocation, rate limits or live analytics work. Integration tests also need the relevant test database/Redis settings.

## Step 9 — Before putting it on the internet

```mermaid
flowchart TD
    A["Local app works"] --> B["Use HTTPS and secure hosting"]
    B --> C["Protect secrets; restrict database access"]
    C --> D["Configure backups and test restoring them"]
    D --> E["Run web app and worker as managed processes"]
    E --> F["Add rate limits, logs, alerts and rollback"]
    F --> G["Test each provider with authorized accounts"]
    G --> H{"All launch checks pass?"}
    H -- Yes --> I["Consider launch"]
    H -- No --> J["Fix issues before launch"]
```

Before production, set up HTTPS, secure secret storage, restricted database access, backups with a tested restore, persistent rate limiting, security headers, logs/alerts, versioned database migrations and a rollback plan. Run the web process and worker as separate managed services. Verify every enabled provider with accounts you own or are authorized to manage.

## Quick troubleshooting map

| What you see | First thing to check |
|---|---|
| Website will not open | Is `npm run dev` still running? Is port 3000 free? |
| Database connection error | Is PostgreSQL running and is `DATABASE_URL` correct? |
| Queue stays waiting | Is the worker running? Can it reach Redis and PostgreSQL? |
| Connect button returns an error | Check provider credentials, exact callback URL, app approval and scopes. |
| Instagram account is missing | Is it a professional account linked to a Facebook Page accessible to the authorizing user? |
| TikTok publishing fails | Check API approval, scopes, video URL accessibility and domain verification. |
| Analytics are blank | Has the trusted analytics sync run? Does the provider grant that metric? |
| Token cannot be decrypted | Does every app/worker instance use the original same encryption key? |

## Words in plain English

- **API:** an official way for two software systems to communicate.
- **OAuth:** a permission process that lets you authorize an app without giving it your social-media password.
- **Token:** a credential that represents the permission granted to the app.
- **Encryption:** scrambling data so it cannot be read without the correct key.
- **Worker:** a background process that carries out queued jobs.
- **Queue:** a waiting list of jobs.
- **Migration:** a controlled change to the database structure.
- **HTTPS:** an encrypted connection between a browser and a website.

## Remember

Tidepost's code and automated checks are only part of the picture. Provider credentials, API approvals, live account tests and production hosting/security work are separate requirements. See the main [README](../README.md) for the complete environment-variable list and technical limitations.
