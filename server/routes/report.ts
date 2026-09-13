import { Router } from 'express'
import type { Request, Response } from 'express'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { auth, findOrCreateUserByEmail } from '../auth.ts'
import { requireUser, AuthRequest } from '../auth-middleware.ts'
import { isDisposableEmail } from '../utils/emailUtils.js'
import { generateValuationReport } from '../services/pdfGenerator.ts'
import { getLeadById, createPurchase, getReportCredits, consumeReportCredit, claimLeadForUser, getScuoleForComune, getPopolazioneTrendForComune, getInviteSession, insertInviteFeedback } from '../db.js'
import { sendTransactionalEmail, addSubscriber } from '../services/listmonk.ts'
import { getMarketData, filterRecentValuationsByRadius } from '../services/realAdvisorMarketData.js'
import { getNearbyPoi } from '../services/poiData.js'
import { getValuationEngine } from '../services/valuationEngineRegistry.js'
import { OmiOfficialRepository } from '../services/OmiOfficialRepository.js'

const router = Router()
const uploadsDir = path.join(process.cwd(), 'uploads')

// Solo per il confronto "prezzo di zona vs media provinciale" nel report:
// completamente indipendente dal motore di valutazione (registrato altrove
// via valuationEngineRegistry), quindi un eventuale problema qui non può
// mai influenzare il prezzo calcolato.
let omiRepoForReport: OmiOfficialRepository | null = null
try {
  omiRepoForReport = new OmiOfficialRepository()
} catch (e) {
  console.error('[report] Errore inizializzazione OmiOfficialRepository (confronto provinciale disabilitato):', e)
}

// Helper condiviso con payment.ts per costruire i dati PDF dal lead grezzo.
// Recupera anche i dati di mercato "via specifica" (RealAdvisor) per
// arricchire il report — se lo scraping fallisce per qualsiasi motivo (sito
// cambiato, via non trovata, timeout) il report viene comunque generato,
// semplicemente senza quella sezione.
async function buildPdfData(lead: any, email: string, media: any[] = []) {
  const stepData = lead?.step_data ? JSON.parse(lead.step_data) : {}
  const valuationData = lead?.valuation_data ? JSON.parse(lead.valuation_data) : {}
  const addressData = lead?.address_json ? JSON.parse(lead.address_json) : {}
  // stepData.property esiste solo se il lead è stato salvato con la
  // valutazione immobiliare completa (non per i lead newsletter/contatto).
  const propertyData = stepData?.property || {}

  let prezzoMedio = valuationData?.valutazione?.prezzoMedio || valuationData?.prezzoMedio || 0
  let prezzoMinimo = valuationData?.valutazione?.prezzoMinimo || valuationData?.prezzoMinimo || 0
  let prezzoMassimo = valuationData?.valutazione?.prezzoMassimo || valuationData?.prezzoMassimo || 0
  let prezzoAlMq =
    valuationData?.valutazione?.prezzoAlMetroQuadro ||
    valuationData?.prezzoAlMetroQuadro ||
    valuationData?.valutazione?.prezzoAlMq ||
    valuationData?.prezzoAlMq ||
    0
  // NB: l'oggetto omiData salvato usa le chiavi "min"/"max" (non "minMq"/
  // "maxMq") e non valorizza mai "zona" (aggregazione a livello di comune,
  // non di singola zona OMI) — leggerle con i nomi sbagliati faceva sparire
  // silenziosamente questa sezione dal report.
  let omiInfo = {
    zona: valuationData?.omiData?.zona || '',
    comune: valuationData?.omiData?.comune || '',
    semestre: valuationData?.omiData?.semestre || '',
    minMq: valuationData?.omiData?.min || 0,
    maxMq: valuationData?.omiData?.max || 0,
    metodologia: valuationData?.metadati?.metodologia || '',
    // Superficie realmente usata nel calcolo (superficie abitabile + quota
    // di terrazzo/giardino/cantina): senza questo dato il PDF mostrava solo
    // property.livingArea in "Superficie di riferimento", che non coincide
    // con prezzoAlMq × superficie mostrata = valore stimato quando ci sono
    // maggiorazioni — un'incongruenza notata dall'utente confrontando i conti.
    superficieCalcolo: valuationData?.omiData?.superficieCalcolo || 0,
    // Dettaglio analitico di ogni bonus/malus, per l'elenco puntuale "Dettaglio
    // bonus e malus applicati" nel report (vedi buildBonusMalusRows in
    // pdfGenerator.ts).
    condizione: valuationData?.omiData?.condizione || undefined,
    statoOmiUsato: valuationData?.omiData?.statoOmiUsato ?? undefined,
    statoOmiFallback: valuationData?.omiData?.statoOmiFallback ?? undefined,
    piano: valuationData?.omiData?.piano ?? undefined,
    hasElevator: valuationData?.omiData?.hasElevator ?? undefined,
    floorBonus: valuationData?.omiData?.floorBonus ?? undefined,
    floorNoElevatorPenalty: valuationData?.omiData?.floorNoElevatorPenalty ?? undefined,
    terraceAreaBonus: valuationData?.omiData?.terraceAreaBonus ?? undefined,
    gardenAreaBonus: valuationData?.omiData?.gardenAreaBonus ?? undefined,
    cantinaAreaBonus: valuationData?.omiData?.cantinaAreaBonus ?? undefined,
    hasPiscina: valuationData?.omiData?.hasPiscina ?? undefined,
    piscinaBonusMultiplier: valuationData?.omiData?.piscinaBonusMultiplier ?? undefined,
    isVillaCategory: valuationData?.omiData?.isVillaCategory ?? undefined,
    villaCategoryBonusMultiplier: valuationData?.omiData?.villaCategoryBonusMultiplier ?? undefined,
    bathrooms: valuationData?.omiData?.bathrooms ?? undefined,
    bathroomBonusMultiplier: valuationData?.omiData?.bathroomBonusMultiplier ?? undefined,
    energyClass: valuationData?.omiData?.energyClass ?? undefined,
    hasEnergyClassBonus: valuationData?.omiData?.hasEnergyClassBonus ?? undefined,
    energyClassBonusMultiplier: valuationData?.omiData?.energyClassBonusMultiplier ?? undefined,
    mansardaLowCeilingPercent: valuationData?.omiData?.mansardaLowCeilingPercent ?? undefined,
    loftCeilingHeight: valuationData?.omiData?.loftCeilingHeight ?? undefined,
    loftCeilingHeightBonusMultiplier: valuationData?.omiData?.loftCeilingHeightBonusMultiplier ?? undefined,
    annoCostruzione: valuationData?.omiData?.annoCostruzione ?? undefined,
    constructionYearMultiplier: valuationData?.omiData?.constructionYearMultiplier ?? undefined,
    zonaDiPregio: valuationData?.omiData?.zonaDiPregio ?? undefined,
    priceMultiplierCappedByZonaDiPregio: valuationData?.omiData?.priceMultiplierCappedByZonaDiPregio ?? undefined,
    zonaDiPregioMaxBonusMultiplier: valuationData?.omiData?.zonaDiPregioMaxBonusMultiplier ?? undefined
  }
  let garageInfo = valuationData?.valutazioneGarage || null

  // Se il prezzo salvato è mancante o a zero (lead con valutazione non
  // completata correttamente al momento del salvataggio), la ricalcoliamo al
  // volo con lo stesso motore usato per la stima istantanea, usando
  // l'indirizzo e le caratteristiche disponibili. Il report non deve mai
  // mostrare "0 €" se c'è anche solo un indirizzo valido da cui ripartire.
  if (!prezzoMedio) {
    const cap = addressData?.postcode || addressData?.cap || lead?.cap || null
    const comune = addressData?.city || lead?.citta || null
    if (cap || comune) {
      try {
        const buildCapBasedValuation = getValuationEngine()
        if (buildCapBasedValuation) {
          const recomputed = await buildCapBasedValuation(
            {
              postcode: cap,
              city: comune,
              province: addressData?.state || null
            },
            {
              propertyType:
                propertyData?.propertyType || stepData?.propertyType || 'APPARTAMENTO',
              livingArea: propertyData?.livingArea || stepData?.features?.livingArea || 80,
              floor: propertyData?.floor,
              hasElevator: propertyData?.hasElevator,
              condition: propertyData?.condition || 'Buono',
              hasBalconyOrTerrace: propertyData?.hasBalconyOrTerrace,
              terraceArea: propertyData?.terraceArea,
              hasGarden: propertyData?.hasGarden,
              gardenArea: propertyData?.gardenArea,
              hasCantina: propertyData?.hasCantina,
              cantinaArea: propertyData?.cantinaArea,
              hasPiscina: propertyData?.hasPiscina,
              mansardaLowCeilingPercent: propertyData?.mansardaLowCeilingPercent,
              loftCeilingHeight: propertyData?.loftCeilingHeight,
              hasGarage: propertyData?.hasGarage,
              garageArea: propertyData?.garageArea,
              garageAddress: propertyData?.garageAddress,
              energyClass: propertyData?.energyClass,
              yearBuilt: propertyData?.yearBuilt,
              zonaDiPregio: propertyData?.zonaDiPregio
            },
            {}
          )
          if (recomputed?.valutazione?.prezzoMedio) {
            prezzoMedio = recomputed.valutazione.prezzoMedio
            prezzoMinimo = recomputed.valutazione.prezzoMinimo
            prezzoMassimo = recomputed.valutazione.prezzoMassimo
            prezzoAlMq = recomputed.valutazione.prezzoAlMetroQuadro
            omiInfo = {
              zona: recomputed.omiData?.zona || '',
              comune: recomputed.omiData?.comune || '',
              semestre: recomputed.omiData?.semestre || '',
              minMq: recomputed.omiData?.min || 0,
              maxMq: recomputed.omiData?.max || 0,
              metodologia: recomputed.metadati?.metodologia || '',
              superficieCalcolo: recomputed.omiData?.superficieCalcolo || 0,
              condizione: recomputed.omiData?.condizione || undefined,
              statoOmiUsato: recomputed.omiData?.statoOmiUsato ?? undefined,
              statoOmiFallback: recomputed.omiData?.statoOmiFallback ?? undefined,
              piano: recomputed.omiData?.piano ?? undefined,
              hasElevator: recomputed.omiData?.hasElevator ?? undefined,
              floorBonus: recomputed.omiData?.floorBonus ?? undefined,
              floorNoElevatorPenalty: recomputed.omiData?.floorNoElevatorPenalty ?? undefined,
              terraceAreaBonus: recomputed.omiData?.terraceAreaBonus ?? undefined,
              gardenAreaBonus: recomputed.omiData?.gardenAreaBonus ?? undefined,
              cantinaAreaBonus: recomputed.omiData?.cantinaAreaBonus ?? undefined,
              hasPiscina: recomputed.omiData?.hasPiscina ?? undefined,
              piscinaBonusMultiplier: recomputed.omiData?.piscinaBonusMultiplier ?? undefined,
              isVillaCategory: recomputed.omiData?.isVillaCategory ?? undefined,
              villaCategoryBonusMultiplier: recomputed.omiData?.villaCategoryBonusMultiplier ?? undefined,
              bathrooms: recomputed.omiData?.bathrooms ?? undefined,
              bathroomBonusMultiplier: recomputed.omiData?.bathroomBonusMultiplier ?? undefined,
              energyClass: recomputed.omiData?.energyClass ?? undefined,
              hasEnergyClassBonus: recomputed.omiData?.hasEnergyClassBonus ?? undefined,
              energyClassBonusMultiplier: recomputed.omiData?.energyClassBonusMultiplier ?? undefined,
              mansardaLowCeilingPercent: recomputed.omiData?.mansardaLowCeilingPercent ?? undefined,
              loftCeilingHeight: recomputed.omiData?.loftCeilingHeight ?? undefined,
              loftCeilingHeightBonusMultiplier: recomputed.omiData?.loftCeilingHeightBonusMultiplier ?? undefined,
              annoCostruzione: recomputed.omiData?.annoCostruzione ?? undefined,
              constructionYearMultiplier: recomputed.omiData?.constructionYearMultiplier ?? undefined,
              zonaDiPregio: recomputed.omiData?.zonaDiPregio ?? undefined,
              priceMultiplierCappedByZonaDiPregio: recomputed.omiData?.priceMultiplierCappedByZonaDiPregio ?? undefined,
              zonaDiPregioMaxBonusMultiplier: recomputed.omiData?.zonaDiPregioMaxBonusMultiplier ?? undefined
            }
            garageInfo = recomputed.valutazioneGarage || garageInfo
          }
        }
      } catch (err) {
        console.error('[report] Errore ricalcolo valutazione di emergenza:', err)
      }
    }
  }

  const propertyLat = typeof lead?.lat === 'number' ? lead.lat : addressData?.lat
  const propertyLng = typeof lead?.lng === 'number' ? lead.lng : (addressData?.lon ?? addressData?.lng)

  let marketData = null
  try {
    marketData = await getMarketData({
      cap: addressData?.postcode || addressData?.cap || lead?.cap || null,
      comune: addressData?.city || lead?.citta || null,
      provincia: addressData?.state || null,
      via: addressData?.street || addressData?.via || null
    })
    if (marketData?.recentValuations?.length) {
      // Vedi filterRecentValuationsByRadius: RealAdvisor raggruppa per
      // via/zona ma non garantisce un raggio preciso — qui teniamo solo le
      // valutazioni entro 500 m reali dall'immobile. Se nessuna rientra, il
      // campo resta vuoto e la sezione non viene mostrata (vedi
      // pdfGenerator.ts, `if (md.recentValuations && md.recentValuations.length)`).
      marketData = {
        ...marketData,
        recentValuations: await filterRecentValuationsByRadius(marketData.recentValuations, {
          lat: propertyLat,
          lng: propertyLng
        })
      }
    }
  } catch (err) {
    console.error('[report] Errore recupero dati di mercato (RealAdvisor):', err)
  }

  let nearbyPoi = null
  try {
    const lat = propertyLat
    const lng = propertyLng
    if (typeof lat === 'number' && typeof lng === 'number') {
      nearbyPoi = await getNearbyPoi({ lat, lng })
    }
  } catch (err) {
    console.error('[report] Errore recupero punti di interesse (Overpass):', err)
  }

  // Scuole per comune: dato statico importato una tantum (vedi
  // server/scripts/import-scuole.js). Ritorna null se lo script non è mai
  // stato lanciato o se il comune non è presente nella tabella.
  let scuole = null
  try {
    const comuneScuole = addressData?.city || lead?.citta || null
    if (comuneScuole) {
      scuole = getScuoleForComune(comuneScuole)
    }
  } catch (err) {
    console.error('[report] Errore lettura scuole per comune:', err)
  }

  // Confronto prezzo/mq di zona vs media provinciale OMI: puro contesto
  // narrativo, non tocca il calcolo del prezzo (fatto altrove). Se manca
  // anche uno solo tra cap/tipologia/prezzoAlMq il confronto viene omesso.
  let confrontoProvinciale = null
  try {
    const capProvincia = addressData?.postcode || addressData?.cap || lead?.cap || null
    const comuneProvincia = addressData?.city || lead?.citta || null
    const uiTypology = propertyData?.propertyType || stepData?.propertyType || 'APPARTAMENTO'
    if (omiRepoForReport && capProvincia && prezzoAlMq) {
      const provinciaCtx = omiRepoForReport.getProvinciaContextForReport({
        cap: capProvincia,
        comuneName: comuneProvincia,
        uiTypology
      })
      if (provinciaCtx && provinciaCtx.avgProvinciaEurMq > 0) {
        const scostamentoPct = Math.round(
          ((prezzoAlMq - provinciaCtx.avgProvinciaEurMq) / provinciaCtx.avgProvinciaEurMq) * 100
        )
        confrontoProvinciale = {
          zonaEurMq: prezzoAlMq,
          provinciaEurMq: provinciaCtx.avgProvinciaEurMq,
          provincia: provinciaCtx.provincia,
          scostamentoPct,
          comuniCountUsed: provinciaCtx.comuniCountUsed
        }
      }
    }
  } catch (err) {
    console.error('[report] Errore calcolo confronto provinciale OMI:', err)
  }

  // Andamento demografico: dato statico importato una tantum (vedi
  // server/scripts/import-demografia.js). null se lo script non è mai stato
  // lanciato o il comune non è presente.
  let andamentoDemografico = null
  try {
    const comuneDemografia = addressData?.city || lead?.citta || null
    if (comuneDemografia) {
      andamentoDemografico = getPopolazioneTrendForComune(comuneDemografia)
    }
  } catch (err) {
    console.error('[report] Errore lettura andamento demografico:', err)
  }

  // Foto/planimetrie caricate dall'utente: risolte in percorsi assoluti sul
  // filesystem del server (lead_media.file_url è relativo, es.
  // "/uploads/xxx.jpg"). Solo i file di tipo immagine sono inclusi: pdfkit
  // non può incorporare direttamente un PDF come planimetria.
  const mediaRows = Array.isArray(media) ? media : []
  const isImageMime = (mime: unknown) => typeof mime === 'string' && mime.startsWith('image/')
  const resolveMediaPath = (fileUrl: string) => path.join(uploadsDir, path.basename(fileUrl || ''))
  const photoPaths = mediaRows
    .filter((m: any) => m?.type === 'foto' && isImageMime(m?.mime))
    .map((m: any) => resolveMediaPath(m.file_url))
  const floorplanPaths = mediaRows
    .filter((m: any) => m?.type === 'planimetria' && isImageMime(m?.mime))
    .map((m: any) => resolveMediaPath(m.file_url))

  return {
    lead: {
      nome: lead?.nome || email.split('@')[0],
      cognome: lead?.cognome || '',
      email,
      indirizzo: lead?.indirizzo || '',
      createdAt: new Date().toISOString().split('T')[0]
    },
    property: {
      type: propertyData?.propertyType || stepData?.propertyType || 'APPARTAMENTO',
      livingArea: propertyData?.livingArea || stepData?.features?.livingArea || 80,
      rooms: propertyData?.rooms || stepData?.features?.rooms,
      bathrooms: propertyData?.bathrooms || stepData?.features?.bathrooms,
      floor: propertyData?.floor,
      condition: propertyData?.condition || stepData?.features?.condition || 'Buono',
      yearBuilt: propertyData?.yearBuilt || stepData?.features?.yearBuilt,
      energyClass: propertyData?.energyClass || stepData?.features?.energyClass,
      hasElevator: propertyData?.hasElevator,
      hasBalconyOrTerrace: propertyData?.hasBalconyOrTerrace,
      terraceArea: propertyData?.terraceArea,
      hasGarden: propertyData?.hasGarden,
      gardenArea: propertyData?.gardenArea,
      hasCantina: propertyData?.hasCantina,
      cantinaArea: propertyData?.cantinaArea,
      hasPiscina: propertyData?.hasPiscina,
      hasGarage: propertyData?.hasGarage,
      garageArea: propertyData?.garageArea,
      heating: propertyData?.heating || stepData?.features?.heating,
      zonaDiPregio: propertyData?.zonaDiPregio
    },
    media: {
      photos: photoPaths,
      floorplans: floorplanPaths
    },
    valuation: {
      prezzoMedio,
      prezzoMinimo,
      prezzoMassimo,
      prezzoAlMq
    },
    omi: omiInfo,
    garage: garageInfo,
    marketData,
    nearbyPoi,
    scuole,
    confrontoProvinciale,
    andamentoDemografico,
    ai: {
      puntiForza: valuationData?.analisiAI?.puntiForza,
      puntiDebolezza: valuationData?.analisiAI?.puntiDebolezza,
      affidabilita: valuationData?.analisiAI?.affidabilita,
      raccomandazioni: valuationData?.analisiAI?.raccomandazioni,
      summary: valuationData?.analisiAI?.summary
    }
  }
}

// POST /api/report/free-unlock
router.post('/free-unlock', async (req: Request, res: Response) => {
  const { email, leadId } = req.body

  // 1. Valida email
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'invalid_email', message: 'Email non valida.' })
  }
  if (isDisposableEmail(email.trim())) {
    return res.status(422).json({ error: 'disposable_email', message: 'Usa un indirizzo email reale.' })
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    // 2. Trova o crea utente Better Auth
    const user = await findOrCreateUserByEmail(cleanEmail)
    const userId = user.id

    // 3. Recupera dati lead
    const leadRecord = leadId ? getLeadById(Number(leadId)) : null
    const rawLead = leadRecord?.lead || null

    // 4. Genera PDF
    const pdfData = await buildPdfData(rawLead, cleanEmail, leadRecord?.media || [])
    const pdfBuffer = await generateValuationReport(pdfData)

    // 5. Salva PDF su disco
    const reportFilename = `${crypto.randomUUID()}.pdf`
    await fs.promises.writeFile(
      path.join(uploadsDir, 'reports', reportFilename),
      pdfBuffer
    )

    // 6. Salva purchase in DB (stripeSessionId null = sblocco gratuito via video)
    createPurchase({
      userId,
      stripeSessionId: null,
      leadId: leadId ? Number(leadId) : null,
      reportPath: `/uploads/reports/${reportFilename}`,
      status: 'completed'
    })

    console.log(`[report] Free unlock per ${cleanEmail}, report: ${reportFilename}`)

    try {
      // sendMagicLink è aggiunto dal plugin magicLink — tipizzato via cast
      await (auth.api as any).sendMagicLink({ body: { email: cleanEmail, callbackURL: '/profilo' } })
    } catch (magicErr) {
      console.error('[report] Errore invio magic link:', magicErr)
    }

    try {
      const frontendUrl = (process.env.APP_FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')
      await sendTransactionalEmail(cleanEmail, 'magic-link-video', {
        nome: user.name || cleanEmail.split('@')[0],
        report_url: `${frontendUrl}/profilo`
      })
      await addSubscriber(cleanEmail, user.name || cleanEmail.split('@')[0], [Number(process.env.LISTMONK_LIST_UTENTI_FREE)])
    } catch (listmonkErr) {
      console.error('[report] Errore invio email listmonk:', listmonkErr)
    }

    res.json({ success: true, message: 'Controlla la tua email per accedere al report.' })
  } catch (err) {
    console.error('[report] free-unlock error:', err)
    res.status(500).json({ error: 'server_error', message: 'Errore interno. Riprova.' })
  }
})

// Helper condiviso: genera il PDF per un lead, lo salva su disco e registra la purchase
async function generateAndSaveReport(userId: string, leadId: number | null, email: string) {
  const leadRecord = leadId ? getLeadById(Number(leadId)) : null
  const rawLead = leadRecord?.lead || null

  const pdfData = await buildPdfData(rawLead, email, leadRecord?.media || [])
  const pdfBuffer = await generateValuationReport(pdfData)

  const reportFilename = `${crypto.randomUUID()}.pdf`
  await fs.promises.writeFile(
    path.join(uploadsDir, 'reports', reportFilename),
    pdfBuffer
  )

  const reportPath = `/uploads/reports/${reportFilename}`
  createPurchase({
    userId,
    stripeSessionId: null,
    leadId: leadId ? Number(leadId) : null,
    reportPath,
    status: 'completed'
  })

  return reportPath
}

// GET /api/report/credits — saldo crediti report dell'utente autenticato
router.get('/credits', requireUser, async (req: AuthRequest, res: Response) => {
  const user = req.user!
  const balance = getReportCredits(user.id)
  res.json({ balance })
})

// POST /api/report/claim-lead — collega al proprio account un lead creato in anonimo
// PRIMA del login (es. valutazione fatta da visitatore, poi login/registrazione avviata
// solo al momento di acquistare il report). Senza questo passaggio il lead resterebbe
// "orfano" (user_id NULL) e non verrebbe mai considerato come "ultima valutazione
// dell'utente" per i pagamenti futuri che non specificano un leadId esplicito.
router.post('/claim-lead', requireUser, async (req: AuthRequest, res: Response) => {
  const user = req.user!
  const { leadId } = req.body || {}
  if (!leadId) return res.status(400).json({ error: 'leadId mancante' })
  try {
    const claimed = claimLeadForUser(Number(leadId), user.id)
    res.json({ claimed })
  } catch (err) {
    console.error('[report] claim-lead error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// POST /api/report/unlock-free — sblocco gratuito "guarda il video" per utente già autenticato
// (usato dalla nuova modale di vendita del report: l'utente si registra/logga prima di questa chiamata)
router.post('/unlock-free', requireUser, async (req: AuthRequest, res: Response) => {
  const user = req.user!
  const { leadId } = req.body || {}
  try {
    await generateAndSaveReport(user.id, leadId ? Number(leadId) : null, user.email)
    console.log(`[report] Sblocco gratuito via video per ${user.email} (lead ${leadId || 'n/d'})`)
    res.json({ success: true })
  } catch (err) {
    console.error('[report] unlock-free error:', err)
    res.status(500).json({ error: 'server_error', message: 'Errore nella generazione del report. Riprova.' })
  }
})

// POST /api/report/unlock-with-feedback — fase pre-lancio (vedi InviteGate.jsx):
// chi è entrato con un codice invito valido, invece di pagare o guardare un
// video, lascia un feedback obbligatorio sulla valutazione appena vista e
// riceve subito il PDF completo in risposta diretta (non un link via email,
// come free-unlock: qui il download deve partire immediatamente). Pubblica
// (nessun requireUser), ma protetta dal richiedere un inviteToken valido —
// senza un token di sessione invito reale la richiesta viene rifiutata.
router.post('/unlock-with-feedback', async (req: Request, res: Response) => {
  const { leadId, feedback, inviteToken } = req.body || {}

  const cleanFeedback = String(feedback || '').trim()
  if (!cleanFeedback) {
    return res.status(400).json({ error: 'empty_feedback', message: 'Il feedback è obbligatorio.' })
  }

  const inviteSession = inviteToken ? getInviteSession(String(inviteToken)) : null
  if (!inviteSession) {
    return res.status(401).json({ error: 'invalid_invite_token', message: 'Accesso non valido per questo test.' })
  }

  try {
    const leadRecord = leadId ? getLeadById(Number(leadId)) : null
    const rawLead = leadRecord?.lead || null
    const email = rawLead?.email
    if (!email) {
      return res.status(400).json({ error: 'missing_email', message: 'Email della valutazione non trovata.' })
    }
    const cleanEmail = String(email).trim().toLowerCase()

    insertInviteFeedback({
      token: String(inviteToken),
      code: inviteSession.code || null,
      message: cleanFeedback.slice(0, 5000)
    })

    const user = await findOrCreateUserByEmail(cleanEmail)
    const pdfData = await buildPdfData(rawLead, cleanEmail, leadRecord?.media || [])
    const pdfBuffer = await generateValuationReport(pdfData)

    const reportFilename = `${crypto.randomUUID()}.pdf`
    await fs.promises.writeFile(
      path.join(uploadsDir, 'reports', reportFilename),
      pdfBuffer
    )
    createPurchase({
      userId: user.id,
      stripeSessionId: null,
      leadId: leadId ? Number(leadId) : null,
      reportPath: `/uploads/reports/${reportFilename}`,
      status: 'completed'
    })

    console.log(`[report] Sblocco via feedback pre-lancio per ${cleanEmail} (lead ${leadId || 'n/d'})`)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="valutazione-immobile.pdf"')
    return res.send(pdfBuffer)
  } catch (err) {
    console.error('[report] unlock-with-feedback error:', err)
    return res.status(500).json({ error: 'server_error', message: 'Errore nella generazione del report. Riprova.' })
  }
})

// POST /api/report/consume-credit — usa uno dei crediti report già acquistati per sbloccare un nuovo lead
router.post('/consume-credit', requireUser, async (req: AuthRequest, res: Response) => {
  const user = req.user!
  const { leadId } = req.body || {}
  const ok = consumeReportCredit(user.id)
  if (!ok) {
    return res.status(402).json({ error: 'no_credits', message: 'Nessun credito report disponibile.' })
  }
  try {
    await generateAndSaveReport(user.id, leadId ? Number(leadId) : null, user.email)
    const remaining = getReportCredits(user.id)
    console.log(`[report] Credito consumato per ${user.email} (lead ${leadId || 'n/d'}), rimanenti: ${remaining}`)
    res.json({ success: true, remaining })
  } catch (err) {
    console.error('[report] consume-credit error:', err)
    res.status(500).json({ error: 'server_error', message: 'Errore nella generazione del report. Riprova.' })
  }
})

export default router
