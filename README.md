# FitAI 🏋️

An Arabic-language fitness platform. Users chat with an AI coach that builds a personalized weekly **workout** and **nutrition** plan. Premium users get a **human coach** who can review and adjust their plan, leave notes, chat with them, track their progress, and more.

Monorepo:
- **`fitai-backend/`** — Express + Prisma + PostgreSQL REST API (TypeScript)
- **`fitai-frontend/`** — Vite + React + Redux Toolkit SPA (TypeScript + Tailwind)

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **PostgreSQL** (running locally)
- A free **Groq API key** — https://console.groq.com (required for the AI)
- Optional: a **Stripe test key** (premium checkout) and a **RapidAPI key** (exercise GIFs)

---

## Setup

### 1. Clone & create a database
```bash
git clone https://github.com/ronymarcel44-sys/new-fitness.git
cd new-fitness
# create an empty PostgreSQL database, e.g. named "fitai"
```

### 2. Backend
```bash
cd fitai-backend
npm install
cp .env.example .env          # then edit .env with your values
npx prisma migrate deploy     # create all tables
npx prisma generate           # build the DB client
npm run db:seed               # create the default admin + sample coach
npm run dev                   # API on http://localhost:3001
```

### 3. Frontend
```bash
cd ../fitai-frontend
npm install
cp .env.example .env          # then edit .env with your values
npm run dev                   # app on http://localhost:5173
```

Open **http://localhost:5173**.

---

## Default accounts (created by `npm run db:seed`)

| Role  | Email             | Password   |
|-------|-------------------|------------|
| Admin | `admin@fitai.com` | `admin123` |
| Coach | `coach@fitai.com` | `coach123` |

Regular users can register themselves from the app. Coaches can also self-register from **"سجّل كمدرب"** on the login page (an admin then approves them from the admin panel).

---

## Environment variables

See **`fitai-backend/.env.example`** and **`fitai-frontend/.env.example`** for the full list with explanations. The essentials:

**Backend** — `DATABASE_URL`, `JWT_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `PORT`, `GROQ_API_KEY`, `FRONTEND_URL`, `STRIPE_SECRET_KEY`
**Frontend** — `VITE_API_URL`, `VITE_RAPIDAPI_KEY`

---

## Useful commands

**Backend** (`fitai-backend/`)
| Command | Description |
|---|---|
| `npm run dev` | Start the API with hot reload |
| `npm run db:seed` | Create the default admin + coach |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npx prisma migrate deploy` | Apply database migrations |

**Frontend** (`fitai-frontend/`)
| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |

---

## Notes
- **Stripe** runs in **test mode** — use card `4242 4242 4242 4242` (any future expiry / CVC). No real charges.
- The AI requires a valid **`GROQ_API_KEY`**; without it, plan generation and meal analysis won't work.
