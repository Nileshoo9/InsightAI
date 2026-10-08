# Fresh Computer Setup Guide

This guide takes InsightAI from a newly prepared computer to a running local development app. It covers Windows, macOS, and Linux.

> A truly blank computer cannot run this application without installing a runtime. You need Node.js and Git on the computer. You can use a hosted PostgreSQL database to avoid installing a database server locally. Gemini is optional; core reports use deterministic analytics and work without an AI key.

## 1. Install the prerequisites

- Install **Node.js 20 LTS** or newer from [nodejs.org](https://nodejs.org/). npm is included with Node.js.
- Install **Git** from [git-scm.com](https://git-scm.com/downloads).
- A code editor is optional. You can use VS Code or any editor that can edit plain text files.

Open a new terminal and check that both commands work:

```sh
node --version
npm --version
git --version
```

## 2. Download the project

```sh
git clone https://github.com/Nileshoo9/InsightAI.git
cd InsightAI
npm ci
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json`. It requires an internet connection the first time it runs.

## 3. Create a PostgreSQL database

InsightAI requires PostgreSQL for user accounts, uploaded-file metadata, and saved insights. The simplest setup on a computer without a database server is to create a free or paid PostgreSQL database with a managed provider such as [Neon](https://neon.tech/) or [Supabase](https://supabase.com/).

Create a database, then copy its PostgreSQL connection string. Use the provider's direct connection URL for the schema setup command below. Keep the URL private; it contains database credentials.

## 4. Configure environment variables

Create a local `.env` file in the repository root by copying the example file.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS or Linux:

```sh
cp .env.example .env
```

Edit `.env` and set at least these values:

```env
DATABASE_URL="paste-your-postgresql-connection-string-here"
JWT_SECRET="paste-a-unique-random-secret-here"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-3.8-flash"
AI_PROVIDER="gemini"
```

Generate a random secret using Node.js, then paste its output as the `JWT_SECRET` value:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`JWT_SECRET` must be unique and at least 32 characters. Keep `.env` private; it is excluded from Git. To enable optional Gemini explanations, create an API key in [Google AI Studio](https://aistudio.google.com/apikey) and put it in `GEMINI_API_KEY`. Leave it empty to run without AI enrichment.

## 5. Initialize and start the app

Run these commands from the repository root:

```sh
npm run prisma:generate
npm run prisma:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and upload a dataset. Sample datasets are in `demo-data/`.

`prisma:push` creates or updates the schema in the configured database. Use a dedicated development database for this command; do not use it as a substitute for reviewed migrations on a production database.

## 6. Verify or build

Run the test suite:

```sh
npm test
```

Create a production build:

```sh
npm run build
```

## Troubleshooting

- **`node` or `npm` is not recognized:** finish installing Node.js, then close and reopen the terminal.
- **Database connection errors:** check that `DATABASE_URL` is correct, the database is running, and the provider allows connections from your network. Use the provider's PostgreSQL URL, not its dashboard URL.
- **`JWT_SECRET` validation error:** replace the example value with a random value of at least 32 characters.
- **Gemini errors:** clear `GEMINI_API_KEY` to disable the optional AI layer. Deterministic report generation remains available.
- **Port 3000 is busy:** Next.js will offer another local port in the terminal; open the URL it prints.