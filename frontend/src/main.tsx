import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexAuthProvider>
    </HelmetProvider>
  </StrictMode>,
)
