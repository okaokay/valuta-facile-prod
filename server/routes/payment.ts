import { Router } from 'express'
import type { Request, Response } from 'express'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import Stripe from 'stripe'
import { createCheckoutSession, verifyWebhookEvent, retrieveCheckoutSession } from '../services/stripe.ts'
import { generateValuationReport } from '../services/pdfGenerator.ts'
import { auth, findOrCreateUserByEmail, getUserById } from '../auth.ts'
import { fromNodeHeaders } from 'better-auth/node'
import { getLeadById, getLeadsByUserId, createPurchase, addReportCredits, consumeReportCredit, getReportCredits, markStripeEventProcessed, getScuoleForComune, getPopolazioneTrendForComune } from '../db.js'
import { sendTransactionalEmail, addSubscriber } from '../services/listmonk.ts'
import { requireUser } from '../auth-middleware.ts'
import type { AuthRequest } from '../auth-middleware.ts'
import { getMarketData, filterRecentValuationsByRadius } from '../services/realAdvisorMarketData.js'
import { getNearbyPoi } from '../services/poiData.js'
import { getValuationEngine } from '../services/valuationEngineRegistry.js'
import { OmiOfficialRepository } from '../services/OmiOfficialRepository.js'

const router = Router()
const uploadsDir = path.join(process.cwd(), 'uploads')

// Solo per il confronto "prezzo di zona vs media provinciale" nel report:
// completamente indipendente dal motore di valutazione, un eventuale
// problema qui non può mai influenzare il prezzo calcolato.
let omiRepoForReport: OmiOfficialRepository | null = null
try {
  omiRepoForReport = new OmiOfficialRepository()
} catch (e) {
  console.error('[payment] Errore inizializzazione OmiOfficialRepository (confronto provinciale disabilitato):', e)
}

// Helper: estrae i dati strutturati da un lead grezzo per passarli al PDF.
// Recupera anche i dati di mercato "via specifica" (RealAdvisor); se lo
// scraping fallisce il report viene comunque generato, senza quella sezione.
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
        console.error('[payment] Errore ricalcolo valutazione di emergenza:', err)
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
      // Vedi filterRecentValuationsByRadius in realAdvisorMarketData.js:
      // tiene solo le valutazioni entro 500 m reali dall'immobile.
      marketData = {
        ...marketData,
        recentValuations: await filterRecentValuationsByRadius(marketData.recentValuations, {
          lat: propertyLat,
          lng: propertyLng
        })
      }
    }
  } catch (err) {
    console.error('[payment] Errore recupero dati di mercato (RealAdvisor):', err)
  }

  let nearbyPoi = null
  try {
    const lat = propertyLat
    const lng = propertyLng
    if (typeof lat === 'number' && typeof lng === 'number') {
      nearbyPoi = await getNearbyPoi({ lat, lng })
    }
  } catch (err) {
    console.error('[payment] Errore recupero punti di interesse (Overpass):', err)
  }

  let scuole = null
  try {
    const comuneScuole = addressData?.city || lead?.citta || null
    if (comuneScuole) {
      scuole = getScuoleForComune(comuneScuole)
    }
  } catch (err) {
    console.error('[payment] Errore lettura scuole per comune:', err)
  }

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
    console.error('[payment] Errore calcolo confronto provinciale OMI:', err)
  }

  let andamentoDemografico = null
  try {
    const comuneDemografia = addressData?.city || lead?.citta || null
    if (comuneDemografia) {
      andamentoDemografico = getPopolazioneTrendForComune(comuneDemografia)
    }
  } catch (err) {
    console.error('[payment] Errore lettura andamento demografico:', err)
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

// POST /api/payment/create-session
router.post('/create-session', async (req: Request, res: Response) => {
  try {
    const { leadId, redirectTo } = req.body
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
      return res.status(503).json({ error: 'Pagamento non configurato.' })
    }

    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    const frontendUrl = (process.env.APP_FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')
    // redirectTo (es. "/profilo") viene usato quando l'utente ha già fatto login/registrazione
    // prima del pagamento (nuovo flusso "3 report a 5€"), così torna direttamente al suo profilo.
    const successPath = typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : ''

    const checkoutSession = await createCheckoutSession({
      email: session?.user?.email ? session.user.email.trim().toLowerCase() : undefined,
      priceId: process.env.STRIPE_PRICE_ID,
      successUrl: `${frontendUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: frontendUrl,
      metadata: {
        leadId: leadId ? String(leadId) : '',
        userId: session?.user?.id || ''
      }
    })

    res.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('[payment] create-session error:', err)
    res.status(500).json({ error: 'Errore creazione sessione pagamento.' })
  }
})

// Elabora una checkout session Stripe completata e pagata: accredita i 3 report,
// sblocca subito quello legato al lead (se presente) e invia le email del caso.
// Condivisa da webhook e dal fallback /confirm-session, così il comportamento è
// identico indipendentemente da quale via l'ha "scoperta" per prima.
// Idempotente su stripeSession.id: se sia il webhook che /confirm-session (o Stripe
// che rimanda lo stesso evento) arrivano per la stessa sessione, la elaboriamo una
// sola volta.
async function finalizeCheckoutSession(stripeSession: Stripe.Checkout.Session, logPrefix: string) {
  if (stripeSession.payment_status !== 'paid') {
    console.warn(`${logPrefix} Sessione ${stripeSession.id} non ancora pagata (payment_status=${stripeSession.payment_status}), skip.`)
    return { ok: false, reason: 'not_paid' as const }
  }

  if (!markStripeEventProcessed(stripeSession.id)) {
    console.log(`${logPrefix} Sessione ${stripeSession.id} già elaborata in precedenza, skip.`)
    return { ok: true, alreadyProcessed: true as const }
  }

  const rawEmail = stripeSession.customer_email || stripeSession.customer_details?.email
  const { leadId, userId: metaUserId } = stripeSession.metadata || {}

  if (!rawEmail && !metaUserId) {
    console.warn(`${logPrefix} Nessuna email né userId nella sessione Stripe:`, stripeSession.id)
    return { ok: false, reason: 'no_identity' as const }
  }
  // Normalizzata in minuscolo per evitare account duplicati se la stessa persona
  // digita l'email con maiuscole diverse rispetto a un login precedente.
  const email = rawEmail ? rawEmail.trim().toLowerCase() : ''

  // 1. Trova l'utente da accreditare. Priorità a metaUserId: è l'id dell'utente
  // GIA' LOGGATO che ha avviato il pagamento (salvato in metadata da /create-session),
  // quindi è la fonte di verità corretta. L'email restituita da Stripe Checkout può
  // differire da quella dell'account loggato (autocompletamento browser, Stripe Link,
  // refuso) e usarla come chiave rischia di accreditare un account "fantasma" diverso
  // da quello che l'utente vede su /profilo.
  let user: { id: string; name: string; email: string; isNew?: boolean } | null = null
  if (metaUserId) {
    user = await getUserById(metaUserId)
    if (!user) {
      console.warn(`${logPrefix} userId ${metaUserId} in metadata non trovato nel DB, fallback su email.`)
    }
  }
  if (!user) {
    if (!email) {
      console.error(`${logPrefix} Impossibile identificare l'utente da accreditare (né userId né email validi):`, stripeSession.id)
      return { ok: false, reason: 'no_identity' as const }
    }
    user = await findOrCreateUserByEmail(email)
  }
  const userEmail = user.email || email

  // 2. Il pagamento di 5€ dà sempre 3 crediti report generici
  addReportCredits(user.id, 3)

  // 3. Un pagamento deve SEMPRE produrre subito un report, non solo aggiungere
  //    crediti "in astratto". Se il pagamento è partito da una valutazione specifica
  //    usiamo quel leadId; altrimenti (es. acquisto crediti dalla pagina profilo,
  //    senza una valutazione in corso) usiamo come fallback l'ultima valutazione
  //    salvata da questo utente, così l'acquirente vede subito un report pronto
  //    invece di dover tornare su una valutazione per "spendere" un credito.
  let effectiveLeadId = leadId ? Number(leadId) : null
  if (!effectiveLeadId) {
    const recentLeads = getLeadsByUserId(user.id)
    effectiveLeadId = recentLeads?.[0]?.id || null
    if (effectiveLeadId) {
      console.log(`${logPrefix} Nessun leadId nel pagamento, uso l'ultima valutazione dell'utente (lead ${effectiveLeadId}) come fallback.`)
    }
  }

  if (effectiveLeadId) {
    const consumed = consumeReportCredit(user.id)
    if (consumed) {
      const leadRecord = getLeadById(effectiveLeadId)
      const rawLead = leadRecord?.lead || null
      const pdfData = await buildPdfData(rawLead, userEmail, leadRecord?.media || [])
      const pdfBuffer = await generateValuationReport(pdfData)
      const reportFilename = `${crypto.randomUUID()}.pdf`
      await fs.promises.writeFile(
        path.join(uploadsDir, 'reports', reportFilename),
        pdfBuffer
      )
      createPurchase({
        userId: user.id,
        stripeSessionId: stripeSession.id,
        leadId: effectiveLeadId,
        reportPath: `/uploads/reports/${reportFilename}`,
        status: 'completed'
      })
      console.log(`${logPrefix} Purchase completato per ${userEmail}, report: ${reportFilename}, crediti rimanenti: ${getReportCredits(user.id)}`)
    }
  } else {
    console.log(`${logPrefix} Ricarica crediti per ${userEmail} (nessuna valutazione da collegare), saldo: ${getReportCredits(user.id)}`)
  }

  try {
    const frontendUrl = (process.env.APP_FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')
    const userName = (user as any).name || userEmail.split('@')[0]
    // Il subscriber deve esistere su listmonk PRIMA di inviargli una email
    // transazionale via /api/tx, altrimenti listmonk risponde "Subscriber not found".
    await addSubscriber(userEmail, userName, [Number(process.env.LISTMONK_LIST_CLIENTI_PAGANTI)])

    if ((user as any).isNew) {
      // Account appena creato con password casuale sconosciuta all'utente:
      // gli mandiamo un link per impostarne una lui stesso e accedere al profilo.
      await auth.api.requestPasswordReset({
        body: { email: userEmail, redirectTo: `${frontendUrl}/crea-password` }
      })
    } else {
      // Utente già esistente (aveva già un account/password): basta avvisarlo
      // che il report è pronto, può accedere normalmente dal login.
      await sendTransactionalEmail(userEmail, 'report-pronto-pagamento', {
        nome: userName,
        report_url: `${frontendUrl}/profilo`
      })
    }
  } catch (listmonkErr) {
    console.error(`${logPrefix} Errore invio email listmonk:`, listmonkErr)
  }

  return { ok: true, userId: user.id, alreadyProcessed: false as const }
}

// POST /api/payment/webhook
// Nota: questo endpoint riceve il body raw (Buffer) — il raw parser è montato in index.js
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  if (!sig) return res.status(400).json({ error: 'Firma mancante' })

  let event: Stripe.Event
  try {
    event = verifyWebhookEvent(req.body as Buffer, sig)
  } catch (err: any) {
    console.error('[webhook] Firma non valida:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  // Rispondi subito a Stripe, poi elabora in background
  res.json({ received: true })

  if (event.type !== 'checkout.session.completed') return

  const stripeSession = event.data.object as Stripe.Checkout.Session
  try {
    await finalizeCheckoutSession(stripeSession, '[webhook]')
  } catch (err) {
    console.error('[webhook] Errore elaborazione pagamento:', err)
  }
})

// GET /api/payment/confirm-session?session_id=cs_xxx
// Fallback usato dal frontend quando torna da Stripe su /profilo?session_id=...
// Serve perché in sviluppo locale (o in caso di ritardo/perdita del webhook) Stripe
// potrebbe non riuscire a recapitare l'evento a POST /webhook — qui verifichiamo lo
// stato pagamento direttamente con l'API di Stripe, così l'utente vede subito i
// crediti/il report anche se il webhook non arriva mai. Protetto da login e con
// verifica che la sessione appartenga effettivamente all'utente che la richiede.
router.get('/confirm-session', requireUser, async (req: AuthRequest, res: Response) => {
  const sessionId = String(req.query.session_id || '')
  console.log(`[confirm-session] Richiesta ricevuta da utente ${req.user!.id} (${req.user!.email}) per session_id=${sessionId}`)
  try {
    if (!sessionId) {
      console.warn('[confirm-session] session_id mancante nella richiesta')
      return res.status(400).json({ error: 'session_id mancante' })
    }

    const stripeSession = await retrieveCheckoutSession(sessionId)
    console.log(`[confirm-session] Sessione Stripe recuperata: payment_status=${stripeSession.payment_status}, metadata=`, stripeSession.metadata)

    const metaUserId = stripeSession.metadata?.userId
    if (metaUserId && metaUserId !== req.user!.id) {
      console.warn(`[confirm-session] Mismatch utente: sessione appartiene a userId=${metaUserId}, richiesta da userId=${req.user!.id}`)
      return res.status(403).json({ error: 'Sessione non associata a questo utente' })
    }

    const result = await finalizeCheckoutSession(stripeSession, '[confirm-session]')
    console.log('[confirm-session] Risultato:', result)
    res.json({ ...result, balance: getReportCredits(req.user!.id) })
  } catch (err) {
    console.error('[payment] confirm-session error:', err)
    res.status(500).json({ error: 'Errore verifica pagamento.' })
  }
})

export default router
