import { createAuthClient } from 'better-auth/react'
import { magicLinkClient } from 'better-auth/client/plugins'

// Strip /api suffix — Better Auth aggiunge /api/auth automaticamente
const origin = (import.meta.env.VITE_API_BASE_URL as string || '')
  .replace(/\/api\/?$/, '').replace(/\/+$/, '') || 'http://localhost:4001'

export const authClient = createAuthClient({
  baseURL: origin,
  plugins: [magicLinkClient()]
})

export const { signIn, signUp, signOut, useSession } = authClient
