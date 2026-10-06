# IDRA Frontend

React + Vite + TypeScript frontend for the IDRA (Identity & Digital Risk Assessment) platform.

## Prerequisites

- **Node.js** 18+
- **pnpm** — install with `npm install -g pnpm` if you don't have it

## Setup

```bash
# From the repository root, navigate into the frontend directory
cd frontend

# Install dependencies
pnpm install
```

## Running the Dev Server

```bash
pnpm dev
```

Opens at **http://localhost:5173**

> No backend is required. All auth, KYC, and credential state logic is simulated in-browser using `localStorage`.

## Building for Production

```bash
pnpm build
```

Output goes to `frontend/dist/`. TypeScript is checked first (`tsc`), then Vite bundles.

## Preview the Production Build

```bash
pnpm preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Shared UI components (Sidebar, Topbar, IdraWordmark, etc.)
│   ├── contexts/        # React contexts (AuthContext, CredentialContext)
│   ├── layouts/         # Dashboard shell layout
│   ├── pages/
│   │   ├── auth/        # Login, Signup
│   │   └── dashboard/   # All dashboard pages
│   ├── types/           # TypeScript types (idra.ts)
│   ├── styles/          # Legacy CSS (not imported — app uses Tailwind inline)
│   ├── App.tsx          # Routes
│   ├── main.tsx         # Entry point
│   └── index.css        # Tailwind v4 + brand colour tokens + fonts
├── index.html
├── vite.config.ts
└── package.json
```

## Simulated Auth Flow

- **Sign up** — stored in `localStorage` under key `idra_users`
- **Log in** — matched against `idra_users` in `localStorage`
- **Session** — active user stored under key `idra_current_user`
- **Log out** — clears `idra_current_user`

No real backend calls are made.

## Environment Variables

No environment variables are required to run the frontend locally.

For production deployment (e.g. Vercel), you may need:

```
VITE_API_BASE_URL=https://your-api.example.com
```

(Not used in the current simulation-only build.)
