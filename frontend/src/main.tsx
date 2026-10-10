import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { HelmetProvider } from 'react-helmet-async'
import { WatchupProvider } from '@watchupltd/react'
import App from './App.tsx'
import './index.css'
import 'remixicon/fonts/remixicon.css'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <WatchupProvider apiKey={import.meta.env.VITE_WATCHUP_API_KEY as string}>
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ConvexAuthProvider>
      </WatchupProvider>
    </HelmetProvider>
  </StrictMode>,
)
