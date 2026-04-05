# Afaq

AI-powered career guidance for students who need clarity, direction, and actionable next steps.

This MVP combines an Angular frontend, a Node.js API, and a LangGraph-based agent workflow to analyze a student profile, recommend career paths, generate a 30/60/90-day action plan, surface matching opportunities, and export the result as a branded PDF report.

## Features

- Marketing landing page with product overview and conversion CTAs
- Guided input flow for collecting profile, context, goals, values, and opportunity preferences
- Frontend validation and draft persistence in `localStorage`
- Profile analysis endpoint that normalizes input and produces a diagnosis
- Career recommendation flow that returns 3 ranked paths
- Action-plan generation for the selected recommendation
- Matched opportunities based on the selected path and user preferences
- Result page with summary, roadmap, opportunities, and PDF export
- Persistent result state in `localStorage` so refresh does not lose the flow

## How It Works

1. The user lands on the marketing page and starts the guided flow.
2. On the input page, the user completes a structured profile:
   passions, interests, causes, strengths, academic context, goals, values, and opportunity preferences.
3. The frontend sends the profile to `POST /api/profile/analyze`.
4. The backend agent normalizes the profile, infers themes/readiness, and returns a diagnosis.
5. The frontend sends the normalized profile to `POST /api/career/recommend`.
6. The backend scores static career paths and returns 3 recommendations.
7. When the user selects a recommendation, the frontend calls `POST /api/plan/generate`.
8. The backend builds a 30/60/90-day roadmap and filters matching opportunities.
9. The result page displays the summary and allows PDF export.

## Architecture Overview

### Frontend

The frontend is an Angular standalone-component SPA in [`frontend/`](./frontend). It includes:

- a persistent app layout with shared header and footer
- the landing page
- the input/discovery page
- the result page
- a central `ProfileFlowService` that manages draft state, result state, and API calls

### Backend

The backend is an Express API in [`backend/`](./backend). It exposes three endpoints:

- profile analysis
- career recommendation
- plan generation

The backend is stateless. It does not use a database. Requests are processed in memory and combined with static JSON datasets.

### AI / Agent Layer

The agent logic lives in [`backend/src/agent/graph.mjs`](./backend/src/agent/graph.mjs). It uses LangGraph to orchestrate the main reasoning flow:

- normalize the incoming profile
- infer themes and readiness
- generate a diagnosis
- score careers from the dataset
- select 3 scenarios
- build a concrete plan for a selected path

### Data Layer

Static datasets live in [`backend/src/data/`](./backend/src/data):

- `careers.json`
- `oportunities.json`

These files provide the local source of truth for career metadata, tags, roadmap steps, and opportunities.

## Tech Stack

- Angular 17
- TypeScript
- Angular Router
- Node.js
- Express
- LangGraph
- LangChain Core
- jsPDF
- `localStorage` for client-side draft/result persistence

## Project Structure

```text
.
├── backend/
│   ├── app.js
│   ├── package.json
│   └── src/
│       ├── agent/
│       ├── controllers/
│       ├── data/
│       ├── routes/
│       └── services/
├── frontend/
│   ├── angular.json
│   ├── package.json
│   ├── proxy.conf.json
│   ├── scripts/
│   └── src/
│       └── app/
├── package.json
└── README.md
```

### Important Folders

- [`backend/app.js`](./backend/app.js): Express entrypoint
- [`backend/src/routes`](./backend/src/routes): API routes
- [`backend/src/controllers`](./backend/src/controllers): request handlers
- [`backend/src/services`](./backend/src/services): service layer bridging routes and agent logic
- [`backend/src/agent`](./backend/src/agent): LangGraph orchestration
- [`backend/src/data`](./backend/src/data): static career/opportunity datasets
- [`frontend/src/app/pages`](./frontend/src/app/pages): landing, input, and result pages
- [`frontend/src/app/profile-flow.service.ts`](./frontend/src/app/profile-flow.service.ts): frontend state and API flow
- [`frontend/src/app/shared/services/result-pdf-export.service.ts`](./frontend/src/app/shared/services/result-pdf-export.service.ts): PDF export

## Core API Endpoints

| Method | Endpoint | Responsibility |
| --- | --- | --- |
| `POST` | `/api/profile/analyze` | Normalize the profile and return diagnosis data |
| `POST` | `/api/career/recommend` | Score careers and return 3 recommended paths |
| `POST` | `/api/plan/generate` | Build a roadmap and return matched opportunities for the selected path |

## Local Setup

### Prerequisites

- Node.js 18+ recommended
- npm

### Install

Install dependencies for both apps:

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Run Locally

#### Option 1: Start each app separately

Backend:

```bash
cd backend
npm start
```

Frontend:

```bash
cd frontend
npm run start:frontend
```

#### Option 2: Use the frontend dev wrapper

```bash
cd frontend
npm start
```

This script checks whether the backend is already running on port `3000`. If not, it starts the backend automatically, waits for it, then launches the Angular dev server.

#### Option 3: Use root convenience scripts

From the repository root:

```bash
npm run dev:backend
npm run dev:frontend
```

Or:

```bash
npm run dev
```

`npm run dev` delegates to the frontend wrapper flow.

### Local URLs

- Frontend: `http://127.0.0.1:4200`
- Backend: `http://127.0.0.1:3000`

### Proxy Behavior

The Angular dev server proxies frontend API calls from:

- `/api/*`

to:

- `http://127.0.0.1:3000`

The proxy config is defined in [`frontend/proxy.conf.json`](./frontend/proxy.conf.json).

## Environment Variables

No required environment variables are needed for the current local MVP.

The backend loads `.env` if present via `dotenv`, and supports:

- `PORT` to override the default backend port (`3000`)

## Notes / Current Limitations

- There is no database yet; all recommendation and plan logic uses static JSON data.
- There is no authentication or user account system.
- The backend is stateless; persistence is handled on the client with `localStorage`.
- Some legacy UI copy still references `PathAI` while the shared logo and current branding use `Afaq`.

## Authors

Built by **Team Zenix** for the **ENSET Challenge Hackathon 2026**.


