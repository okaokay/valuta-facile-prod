import { Router } from 'express'
import type { Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { requireUser, AuthRequest } from '../auth-middleware.ts'
import {
  getAffiliateByUserId,
  listCampaignsByAffiliate,
  getCampaignById,
  getCampaignStats,
  getAffiliateOverviewStats,
  computeCampaignAmountDue,
  setCampaignPendingMedia
} from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Stessa cartella usata dall'upload admin (server/index.js): un solo posto
// fisico per i media degli affiliati, che siano caricati da noi o da loro.
const affiliateMediaDir = path.join(__dirname, '..', '..', 'uploads', 'affiliati')
if (!fs.existsSync(affiliateMediaDir)) {
  fs.mkdirSync(affiliateMediaDir, { recursive: true })
}
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, affiliateMediaDir)
  },
  filename(_req, file, cb) {
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${unique}_${safeName}`)
  }
})
const uploadMedia = multer({ storage, limits: { fileSize: 150 * 1024 * 1024 } })

export interface AffiliateAuthRequest extends AuthRequest {
  affiliate?: any
}

const router = Router()
router.use(requireUser)

// Solo gli utenti il cui account è collegato a un'anagrafica affiliato
// (vedi POST /api/admin/affiliates/:id/invite) possono usare questo portale
// — un cliente normale che ha fatto login non ci entra.
async function requireAffiliate(req: AffiliateAuthRequest, res: Response, next: NextFunction) {
  const affiliate = getAffiliateByUserId(req.user!.id)
  if (!affiliate) {
    return res.status(403).json({ error: 'not_an_affiliate' })
  }
  if (affiliate.stato !== 'attivo') {
    return res.status(403).json({ error: 'affiliate_suspended' })
  }
  req.affiliate = affiliate
  next()
}
router.use(requireAffiliate)

function campaignWithBilling(campaign: any, range: any) {
  const stats = getCampaignStats(campaign.id, range)
  return {
    ...campaign,
    stats,
    importoMaturato: computeCampaignAmountDue(campaign, stats)
  }
}

// GET /api/affiliate/me — anagrafica + tutte le campagne con statistiche e
// importo maturato in base alla tariffa scelta per ciascuna.
router.get('/me', (req: AffiliateAuthRequest, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string }
  const campaigns = listCampaignsByAffiliate(req.affiliate.id).map((c) =>
    campaignWithBilling(c, { from, to })
  )
  res.json({ affiliate: req.affiliate, campaigns })
})

// GET /api/affiliate/overview — statistiche aggregate su tutte le campagne,
// per il riepilogo in cima alla dashboard.
router.get('/overview', (req: AffiliateAuthRequest, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string }
  const overview = getAffiliateOverviewStats(req.affiliate.id, { from, to })
  res.json({ overview })
})

// GET /api/affiliate/campaigns/:id/stats — dettaglio di una singola
// campagna (andamento giorno per giorno, CAP dove è comparsa), con verifica
// che la campagna appartenga davvero all'affiliato loggato.
router.get('/campaigns/:id/stats', (req: AffiliateAuthRequest, res: Response) => {
  const campaign = getCampaignById(Number(req.params.id))
  if (!campaign || campaign.affiliate_id !== req.affiliate.id) {
    return res.status(404).json({ error: 'not_found' })
  }
  const { from, to } = req.query as { from?: string; to?: string }
  const stats = getCampaignStats(campaign.id, { from, to })
  res.json({
    campaign,
    stats,
    importoMaturato: computeCampaignAmountDue(campaign, stats)
  })
})

// POST /api/affiliate/campaigns/:id/media — upload self-service: il file
// NON va live subito, resta "in attesa" finché l'admin non lo approva (vedi
// setCampaignPendingMedia e la coda di approvazione nel pannello admin).
router.post(
  '/campaigns/:id/media',
  uploadMedia.single('media'),
  (req: AffiliateAuthRequest, res: Response) => {
    const campaign = getCampaignById(Number(req.params.id))
    if (!campaign || campaign.affiliate_id !== req.affiliate.id) {
      return res.status(404).json({ error: 'not_found' })
    }
    if (!req.file) return res.status(400).json({ error: 'missing_file' })
    try {
      const mediaUrl = `/api/uploads/affiliati/${req.file.filename}`
      const updated = setCampaignPendingMedia(campaign.id, mediaUrl)
      res.json({ campaign: updated })
    } catch (e) {
      console.error('[affiliate/campaigns/media] Errore upload:', e)
      res.status(500).json({ error: 'upload_failed' })
    }
  }
)

export default router
