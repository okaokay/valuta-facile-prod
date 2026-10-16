#!/usr/bin/env node
/**
 * seed-demo-affiliati-pescara.mjs
 *
 * Inserisce 3 affiliati pubblicitari DEMO a Pescara (CAP 65126/65121),
 * con relative campagne attive e geolocalizzate (2 banner + 1 video), per
 * testare il sistema di pubblicità affiliati end-to-end (Fasi 1-4) sul sito
 * live, incluso il video dell'affiliato nel gate pre-valutazione.
 *
 * Dati reali di aziende trovate online tramite ricerca pubblica (nome,
 * email generica, indirizzo) — usati qui SOLO a scopo di test interno/demo
 * per verificare il funzionamento del matching geografico. Le campagne
 * restano visibili sul sito (stato attiva + media approvato) perché
 * l'obiettivo è testare la visualizzazione reale; se non le vuoi online,
 * esegui poi: node scripts/seed-demo-affiliati-pescara.mjs --pausa
 * per metterle tutte in pausa, oppure cancellale dal pannello admin.
 *
 * Uso (dal container backend su Hostinger):
 *   node scripts/seed-demo-affiliati-pescara.mjs
 *
 * È idempotente sulle email: se un affiliato con la stessa email esiste
 * già, non lo ricrea (evita duplicati se lo rilanci per errore).
 */

import {
  createAffiliate,
  listAffiliates,
  createCampaign,
  listCampaignsByAffiliate,
  setCampaignMedia
} from '../server/db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PAUSA = process.argv.includes('--pausa')

// Coordinate indicative nella zona di Pescara (CAP 65126 / 65121), sufficienti
// per testare il matching per raggio (vedi haversineKm in server/index.js).
const DEMO = [
  {
    ragioneSociale: 'Idrica S.n.c.',
    referente: 'Amministrazione',
    email: 'demo.idrica@valutafacile-test.it',
    telefono: '085 000 0001',
    note: 'Affiliato DEMO per test sistema pubblicita (impianti idraulici, zona Pescara)',
    campagna: {
      nome: 'Banner demo - Impianti Idrica',
      capTarget: '65126',
      indirizzoTarget: 'Via Tiburtina, Pescara',
      targetLat: 42.4729,
      targetLon: 14.2159,
      raggioKm: 12,
      colore1: '#1d4ed8',
      colore2: '#1e3a8a',
      titolo: 'Idrica S.n.c.',
      sottotitolo: 'Impianti idraulici e riscaldamento a Pescara'
    }
  },
  {
    ragioneSociale: 'Abitarbene S.r.l.',
    referente: 'Ufficio commerciale',
    email: 'demo.abitarbene@valutafacile-test.it',
    telefono: '085 000 0002',
    note: 'Affiliato DEMO per test sistema pubblicita (ristrutturazioni, zona Pescara)',
    campagna: {
      nome: 'Video demo - Ristrutturazioni Abitarbene',
      tipo: 'video',
      videoAsset: 'demo-abitarbene.mp4',
      capTarget: '65126',
      indirizzoTarget: 'Pescara centro',
      targetLat: 42.4618,
      targetLon: 14.2161,
      raggioKm: 15,
      colore1: '#b45309',
      colore2: '#78350f',
      titolo: 'Abitarbene S.r.l.',
      sottotitolo: 'Ristrutturazioni edili chiavi in mano'
    }
  },
  {
    ragioneSociale: 'Negozio Arredamento Corso Vittorio Emanuele',
    referente: 'Direzione vendite',
    email: 'demo.arredamento@valutafacile-test.it',
    telefono: '085 421 1651',
    note: 'Affiliato DEMO per test sistema pubblicita (arredamento, Corso Vittorio Emanuele 17, Pescara)',
    campagna: {
      nome: 'Banner demo - Arredamento Pescara',
      capTarget: '65121',
      indirizzoTarget: 'Corso Vittorio Emanuele 17, Pescara',
      targetLat: 42.4651,
      targetLon: 14.2133,
      raggioKm: 10,
      colore1: '#15803d',
      colore2: '#14532d',
      titolo: 'Arredamento & Design',
      sottotitolo: 'Mobili e complementi d\'arredo - Corso Vittorio Emanuele, Pescara'
    }
  }
]

// Genera un semplice banner SVG (nessuna dipendenza da librerie immagine):
// un <img src="...svg"> funziona esattamente come un PNG/JPEG nel browser.
function buildBannerSvg({ colore1, colore2, titolo, sottotitolo }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colore1}"/>
      <stop offset="100%" stop-color="${colore2}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="300" fill="url(#g)"/>
  <text x="60" y="140" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="bold" fill="#ffffff">${titolo}</text>
  <text x="60" y="190" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#ffffffcc">${sottotitolo}</text>
  <text x="60" y="250" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#ffffff99">Banner demo - Valuta Facile</text>
</svg>`
}

const uploadsAffiliatiDir = path.resolve(__dirname, '..', 'uploads', 'affiliati')
fs.mkdirSync(uploadsAffiliatiDir, { recursive: true })

const existing = listAffiliates()
const existingByEmail = new Map(existing.map((a) => [a.email, a]))

for (const d of DEMO) {
  let affiliate = existingByEmail.get(d.email.toLowerCase())
  if (!affiliate) {
    affiliate = createAffiliate({
      ragioneSociale: d.ragioneSociale,
      referente: d.referente,
      email: d.email,
      telefono: d.telefono,
      note: d.note
    })
    console.log(`Creato affiliato: ${affiliate.ragione_sociale} (id ${affiliate.id})`)
  } else {
    console.log(`Affiliato gia esistente, riuso: ${affiliate.ragione_sociale} (id ${affiliate.id})`)
  }

  const c = d.campagna
  const isVideo = c.tipo === 'video' && c.videoAsset

  // Idempotente anche sulle campagne (non solo sugli affiliati): se esiste
  // già una campagna con lo stesso nome per questo affiliato (es. rilanci lo
  // script dopo un aggiornamento), la riusiamo invece di crearne una
  // duplicata — evita di accumulare più campagne demo per lo stesso scopo.
  const existingCampaigns = listCampaignsByAffiliate(affiliate.id)
  let campaign = existingCampaigns.find((camp) => camp.nome === c.nome)
  if (campaign) {
    console.log(`Campagna gia esistente, riuso: ${campaign.nome} (id ${campaign.id})`)
  } else {
    campaign = createCampaign({
      affiliateId: affiliate.id,
      nome: c.nome,
      tipo: isVideo ? 'video' : 'banner',
      linkDestinazione: null,
      capTarget: c.capTarget,
      indirizzoTarget: c.indirizzoTarget,
      targetLat: c.targetLat,
      targetLon: c.targetLon,
      raggioKm: c.raggioKm,
      dataInizio: null,
      dataFine: null,
      tettoImpressioni: null,
      tariffaTipo: 'flat',
      tariffaValore: 0
    })
  }

  let filename
  if (isVideo) {
    // Video demo breve (pochi KB) incluso nel repo in scripts/assets/: viene
    // semplicemente copiato nella cartella pubblica uploads/affiliati/, cosi
    // da poter testare subito il video dell'affiliato nel gate pre-valutazione
    // (vedi ValuationAdGateModal.jsx) senza dover generare video al volo.
    const sourceAsset = path.resolve(__dirname, 'assets', c.videoAsset)
    const ext = path.extname(c.videoAsset) || '.mp4'
    filename = `demo-${affiliate.id}-${campaign.id}${ext}`
    fs.copyFileSync(sourceAsset, path.join(uploadsAffiliatiDir, filename))
  } else {
    filename = `demo-${affiliate.id}-${campaign.id}.svg`
    fs.writeFileSync(path.join(uploadsAffiliatiDir, filename), buildBannerSvg({
      colore1: c.colore1,
      colore2: c.colore2,
      titolo: c.titolo,
      sottotitolo: c.sottotitolo
    }))
  }

  setCampaignMedia(campaign.id, `/api/uploads/affiliati/${filename}`)

  if (PAUSA) {
    // Import dinamico solo se serve, per non appesantire l'uso normale.
    const { updateCampaign } = await import('../server/db.js')
    updateCampaign(campaign.id, { stato: 'pausa' })
    console.log(`Campagna creata e messa IN PAUSA: ${campaign.nome} (id ${campaign.id})`)
  } else {
    console.log(`Campagna creata e ATTIVA: ${campaign.nome} (id ${campaign.id}) - raggio ${c.raggioKm}km da ${c.indirizzoTarget}`)
  }
}

console.log('\nFatto. Vai su /admin -> tab "Affiliati pubblicita" per vedere/gestire i 3 affiliati demo creati.')
if (!PAUSA) {
  console.log('Le campagne sono ATTIVE e verranno mostrate ai visitatori reali in zona Pescara.')
  console.log('Per metterle in pausa in qualsiasi momento: node scripts/seed-demo-affiliati-pescara.mjs --pausa')
}
