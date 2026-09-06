import { auth } from './auth.ts'
import { fromNodeHeaders } from 'better-auth/node'
import type { Request, Response, NextFunction } from 'express'

export interface AuthRequest extends Request {
  user?: { id: string; email: string; name: string }
}

export async function requireUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    })
    if (!session?.user) {
      return res.status(401).json({ error: 'Autenticazione richiesta' })
    }
    req.user = session.user as { id: string; email: string; name: string }
    next()
  } catch {
    res.status(401).json({ error: 'Autenticazione richiesta' })
  }
}
