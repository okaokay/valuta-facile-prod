import { Router } from 'express'
import type { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { requireUser, AuthRequest } from '../auth-middleware.ts'
import { auth } from '../auth.ts'
import { fromNodeHeaders } from 'better-auth/node'
import { addSubscriber, unsubscribeFromList } from '../services/listmonk.ts'
import { getLeadsByUserId, getPurchasesByUserId, getPurchaseByIdAndUser, unlinkLeadsByUserId } from '../db.js'

const router = Router()
router.use(requireUser)

// GET /api/profile/me — dati utente + ultime valutazioni
router.get('/me', async (req: AuthRequest, res: Response) => {
  const user = req.user!
  const valuations = getLeadsByUserId(user.id)
  res.json({ user, valuations })
})

// GET /api/profile/reports — lista report acquistati/sbloccati
router.get('/reports', async (req: AuthRequest, res: Response) => {
  const user = req.user!
  const reports = getPurchasesByUserId(user.id)
  res.json({ reports })
})

// GET /api/profile/reports/:id/download — scarica PDF
router.get('/reports/:id/download', async (req: AuthRequest & Request, res: Response) => {
  const user = req.user!
  const purchase = getPurchaseByIdAndUser(Number((req as any).params.id), user.id)
  if (!purchase) return res.status(403).json({ error: 'Report non trovato o accesso negato.' })

  const absolutePath = path.join(process.cwd(), (purchase as any).report_path.replace(/^\//, ''))
  if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'File non trovato.' })

  res.download(absolutePath, `report-valutazione-${purchase.id}.pdf`)
})

// PATCH /api/profile/update-name — aggiorna nome
router.patch('/update-name', async (req: AuthRequest, res: Response) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome non valido.' })
  try {
    await auth.api.updateUser({
      body: { name: name.trim() },
      headers: fromNodeHeaders(req.headers)
    })
    res.json({ success: true })
  } catch (err) {
    console.error('[profile] update-name error:', err)
    res.status(500).json({ error: 'Errore aggiornamento nome.' })
  }
})

// PATCH /api/profile/update-password — cambia password
router.patch('/update-password', async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Parametri mancanti.' })
  }
  try {
    const result = await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: false },
      headers: fromNodeHeaders(req.headers)
    })
    if (!result) return res.status(400).json({ error: 'Password attuale non corretta.' })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[profile] update-password error:', err)
    res.status(400).json({ error: err?.message || 'Password attuale non corretta.' })
  }
})

// PATCH /api/profile/email-preferences — iscrizione/disiscrizione newsletter
router.patch('/email-preferences', async (req: AuthRequest, res: Response) => {
  const { newsletter } = req.body
  const user = req.user!
  try {
    if (newsletter) {
      await addSubscriber(user.email, user.name, [Number(process.env.LISTMONK_LIST_NEWSLETTER)])
    } else {
      await unsubscribeFromList(user.email, Number(process.env.LISTMONK_LIST_NEWSLETTER))
    }
  } catch (err) {
    console.error('[profile] email-preferences listmonk error:', err)
    // Non fallire — listmonk potrebbe non essere configurato
  }
  res.json({ success: true })
})

// DELETE /api/profile/delete — elimina account
router.delete('/delete', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    unlinkLeadsByUserId(user.id)
    await auth.api.deleteUser({
      body: { password: req.body?.password || '' },
      headers: fromNodeHeaders(req.headers)
    })
    res.json({ success: true })
  } catch (err: any) {
    console.error('[profile] delete error:', err)
    res.status(500).json({ error: err?.message || 'Errore eliminazione account.' })
  }
})

export default router
