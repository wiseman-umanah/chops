# frontend/

The Chop React SPA. Built with React 19, Vite 8, Tailwind CSS v4, and React Router v7. Deployed to Vercel.

---

## Running locally

```bash
# From the workspace root
pnpm dev:frontend

# Or from this directory
pnpm dev
```

Starts Vite at `http://localhost:5173`. Requires `frontend/.env.local` — see [Environment variables](#environment-variables).

## Building for production

```bash
# From the workspace root
pnpm build:frontend

# Or from this directory
pnpm build
```

Output goes to `frontend/dist/`.

---

## Project structure

```
frontend/
  api/
    og.ts                 ← Vercel serverless function: OG tag injection for /s/:slug crawlers
  src/
    main.tsx              ← Entry point — ConvexAuthProvider, BrowserRouter, HelmetProvider
    App.tsx               ← All routes
    index.css             ← Global styles + Tailwind v4 config (no tailwind.config.js)
    components/
      RemixIcon.tsx       ← Thin wrapper around Remix Icon CSS classes
      Logo.tsx            ← SVG logo component
      ProtectedRoute.tsx  ← Redirects unauthenticated users to /login
      FadeUp.tsx          ← Reusable motion wrapper
      dashboard/
        Topbar.tsx        ← Sticky top bar; mobile hamburger sidebar on < sm
      landing/            ← Landing page sections
      howItWorks/         ← How it works stack cards
    contexts/
      AuthContext.tsx     ← useAuth() hook; wraps useConvexAuth + getMyProfile
    hooks/
      useSeo.tsx          ← <Seo> component via react-helmet-async
    layouts/
      DashboardLayout.tsx ← Protected shell with Topbar + content area
      PublicLayout.tsx    ← Topbar only (session pay pages)
    pages/
      LandingPage.tsx
      TermsPage.tsx
      PrivacyPage.tsx
      auth/
        AuthPage.tsx          ← Sign in / sign up (tabs)
        ForgotPasswordPage.tsx
        ResetPasswordPage.tsx ← 6-digit OTP entry
      dashboard/
        OverviewPage.tsx      ← Session list + FinalizeModal (payout)
        ChopFoodPage.tsx      ← Create/edit food session
        ChopInPage.tsx        ← Create/edit chop-in session
        ChopBillPage.tsx      ← Create/edit bill session
        ShareLinkPage.tsx     ← Share link + QR code + WhatsApp preview
        WalletPage.tsx        ← Chop-in withdrawals + payout history
        NotificationsPage.tsx
        SettingsPage.tsx      ← Profile photo, name, change password
      session/
        SessionPayPage.tsx    ← Public payment page at /s/:slug
        PaymentSuccessPage.tsx
        ReceiptPage.tsx       ← Printable receipt at /r/:paymentRef
```

---

## Routing

| Pattern | Auth | Component |
|---|---|---|
| `/` | Public | `LandingPage` |
| `/login`, `/signup` | Redirect if authed | `AuthPage` |
| `/forgot-password` | Public | `ForgotPasswordPage` |
| `/reset-password` | Public | `ResetPasswordPage` |
| `/dashboard/*` | **Protected** | `DashboardLayout` |
| `/s/:slug` | Public | `SessionPayPage` |
| `/payment-success` | Public | `PaymentSuccessPage` |
| `/r/:paymentRef` | Public (bare page) | `ReceiptPage` |

---

## Key patterns

### Convex API import
The generated API lives outside the `frontend/` workspace. Import paths depend on file depth:
```ts
// from src/pages/dashboard/ or src/pages/session/
import { api } from '../../../../convex/_generated/api'

// from src/contexts/ or src/pages/ (top level)
import { api } from '../../../convex/_generated/api'
```

### Auth
Always use `useAuth()` from `@/contexts/AuthContext` — never `useConvexAuth()` directly. Skip queries when unauthenticated:
```ts
useQuery(api.sessions.getOrganizerSessions, isAuthenticated ? {} : 'skip')
```

### Money
All values from Convex are in **kobo**. Display with:
```ts
`₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
```

### SEO
Wrap every page with `<Seo>` from `@/hooks/useSeo`:
```tsx
<Seo title="Page Title" path="/dashboard/page" />
// Add noIndex for authenticated/private pages
<Seo title="Wallet" path="/dashboard/wallet" noIndex />
```

### Brand colours
```
#FF6900  — primary orange (Chop Food, buttons, brand)
#00C950  — green (Chop In, success states)
#FB2C36  — red (Chop Bill)
```

---

## Chop In — payment success handoff
For chop-in payments, the participant ID is only resolved server-side inside the `initiateCheckout` Convex action. The action returns it and the frontend stores it in `sessionStorage` under `chops_pending_participant` before redirecting to Bachs. `PaymentSuccessPage` reads it on arrival and clears it immediately.

---

## SEO & OG tags
`frontend/api/og.ts` is a Vercel serverless function. When a crawler requests `/s/:slug`, `vercel.json` routes it to this function, which fetches the session from Convex and returns an HTML page with proper Open Graph meta tags. Real users are served `index.html` via the SPA fallback.

---

## Environment variables

Create `frontend/.env.local`:

```env
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

For production, set `VITE_CONVEX_URL` in your Vercel project settings (Environment Variables) pointing at the **prod** Convex deployment URL.

---

## Deployment

The frontend deploys to Vercel. `vercel.json` handles:
1. Routing `/s/:slug` to the `api/og.ts` serverless function for crawler OG injection
2. SPA fallback — all other paths serve `index.html` so React Router handles them client-side

Push to your connected Git branch or run `vercel --prod` to deploy.
