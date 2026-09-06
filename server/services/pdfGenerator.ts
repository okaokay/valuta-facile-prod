import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Percorso del logo Valuta Facile (stesso file usato nell'header del sito),
// risolto in modo indipendente dalla working directory: server/services/ ->
// (su) server/ -> (su) root progetto -> public/assets/Risorsa 2.png.
const __dirnameEsm = path.dirname(fileURLToPath(import.meta.url))
const LOGO_PATH = path.join(__dirnameEsm, '..', '..', 'public', 'assets', 'Risorsa 2.png')
const LOGO_EXISTS = fs.existsSync(LOGO_PATH)
// Rapporto larghezza/altezza reale del file (557x96 px) per non deformarlo.
const LOGO_ASPECT = 557 / 96

export interface ValuationReportData {
  lead: {
    nome: string
    cognome: string
    email: string
    indirizzo: string
    createdAt: string
  }
  property: {
    type: string
    livingArea: number
    rooms?: number
    bathrooms?: number
    floor?: number | string
    condition?: string
    yearBuilt?: string
    energyClass?: string
    hasElevator?: boolean
    hasBalconyOrTerrace?: boolean
    terraceArea?: number
    hasGarden?: boolean
    gardenArea?: number
    hasCantina?: boolean
    cantinaArea?: number
    hasPiscina?: boolean
    hasGarage?: boolean
    garageArea?: number
    heating?: string
    zonaDiPregio?: boolean
  }
  // Foto e planimetrie caricate dall'utente nel wizard (percorsi assoluti sul
  // filesystem del server, risolti a partire da lead_media.file_url). Solo
  // immagini (jpg/png/webp) sono incluse: pdfkit non può incorporare PDF.
  media?: {
    photos?: string[]
    floorplans?: string[]
  }
  valuation: {
    prezzoMedio: number
    prezzoMinimo: number
    prezzoMassimo: number
    prezzoAlMq: number
  }
  omi: {
    zona: string
    comune: string
    semestre: string
    minMq: number
    maxMq: number
    metodologia?: string
    // Superficie realmente usata nel calcolo del prezzo (superficie abitabile
    // + quota di terrazzo/giardino/cantina, quando presenti). Senza questo
    // dato "Dettaglio prezzo" mostrava solo property.livingArea, che non
    // coincide con prezzoAlMq × superficie mostrata = valore stimato appena
    // ci sono maggiorazioni — incongruenza segnalata da un utente che aveva
    // rifatto i conti a mano.
    superficieCalcolo?: number
    // Dettaglio analitico di ciascun bonus/malus applicato al prezzo finale,
    // usato per costruire l'elenco puntuale "Dettaglio bonus e malus
    // applicati" nel report (oltre alla frase narrativa riassuntiva già
    // presente in "metodologia"). Tutti opzionali: se un valore non è
    // applicabile alla tipologia/caratteristiche dell'immobile, il relativo
    // bonus/malus viene semplicemente omesso dall'elenco.
    condizione?: string
    statoOmiUsato?: string | null
    statoOmiFallback?: boolean
    piano?: number | null
    hasElevator?: boolean
    floorBonus?: number
    floorNoElevatorPenalty?: number
    terraceAreaBonus?: number
    gardenAreaBonus?: number
    cantinaAreaBonus?: number
    hasPiscina?: boolean
    piscinaBonusMultiplier?: number
    isVillaCategory?: boolean
    villaCategoryBonusMultiplier?: number
    bathrooms?: number
    bathroomBonusMultiplier?: number
    energyClass?: string | null
    hasEnergyClassBonus?: boolean
    energyClassBonusMultiplier?: number
    mansardaLowCeilingPercent?: number
    loftCeilingHeight?: number
    loftCeilingHeightBonusMultiplier?: number
    annoCostruzione?: number | null
    constructionYearMultiplier?: number
    // Zona di pregio (es. centro storico): annulla tutti i malus (età, stato
    // scadente, no ascensore, mansarda) e limita il bonus complessivo
    // risultante a zonaDiPregioMaxBonusMultiplier — vedi disclaimer dedicato
    // nel report.
    zonaDiPregio?: boolean
    priceMultiplierCappedByZonaDiPregio?: boolean
    zonaDiPregioMaxBonusMultiplier?: number
  }
  garage?: {
    disponibile: boolean
    superficie?: number
    prezzoAlMetroQuadro?: number
    prezzoStimato?: number
    motivo?: string
  } | null
  marketData?: {
    scope: 'via' | 'cap' | 'comune'
    addressLabel: string
    referencePeriod: string
    pricePerSqm: number
    priceRange: { min: number; max: number } | null
    trend: {
      case: { oneYearPct: number | null; fourYearPct: number | null }
      appartamenti: { oneYearPct: number | null; fourYearPct: number | null }
    }
    salePrices: {
      case: { medianPrice: number; rangeMin: number; rangeMax: number; pricePerSqm: number } | null
      appartamenti: { medianPrice: number; rangeMin: number; rangeMax: number; pricePerSqm: number } | null
    }
    rentPrices: {
      case: { medianRent: number; rangeMin: number; rangeMax: number; pricePerSqmYear: number } | null
      appartamenti: { medianRent: number; rangeMin: number; rangeMax: number; pricePerSqmYear: number } | null
    }
    recentValuations?: Array<{
      dataValutazione: string
      tipo: string
      stanze: number | null
      indirizzo: string
      cap: string
      comune: string
      prezzoAlMq: number
    }>
  } | null
  nearbyPoi?: {
    categories: Array<{
      key: string
      label: string
      items: Array<{ name: string; distanceMeters: number }>
    }>
    radiusMeters: number
    totalCategoriesSearched?: number
  } | null
  scuole?: {
    comune: string
    provincia: string | null
    infanzia: number
    primaria: number
    secondaria1Grado: number
    secondaria2Grado: number
    totale: number
  } | null
  confrontoProvinciale?: {
    zonaEurMq: number
    provinciaEurMq: number
    provincia: string | null
    scostamentoPct: number
    comuniCountUsed: number
  } | null
  andamentoDemografico?: {
    serie: Array<{ anno: number; popolazione: number }>
    annoInizio: number
    annoFine: number
    popolazioneInizio: number
    popolazioneFine: number
    variazionePct: number | null
  } | null
  ai: {
    puntiForza?: string[]
    puntiDebolezza?: string[]
    affidabilita?: number
    raccomandazioni?: string
    summary?: string
  }
}

// --- Design tokens -----------------------------------------------------
// Palette allineata allo stile dei report immobiliari professionali di
// settore (fascia blu navy in testa a ogni pagina + card bianca arrotondata
// per il contenuto): vedi riferimento fornito dall'utente.

const INK = '#0f172a'
const NAVY = '#123a63'
const NAVY_DARK = '#0d2c4c'
const ACCENT = NAVY
const ACCENT_LIGHT = '#e3e9f2'
const SECONDARY_BAR = '#b7c4da'
const SLATE = '#64748b'
const SLATE_LIGHT = '#f1f5f9'
const CARD_GRAY = '#f2f4f7'
const LINE = '#e2e8f0'
const GREEN = '#15803d'
const RED = '#b91c1c'
const WHITE = '#ffffff'

const MARGIN = 46
const CARD_INSET = 26
const HEADER_HEIGHT = 92
const FOOTER_RESERVED = 40

// --- Formattazione -------------------------------------------------------

function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0)
}

function formatSignedPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

const VILLA_FLOOR_LABELS: Record<string, string> = {
  unico: 'Villa su un livello',
  due_livelli: 'Villa su due livelli',
  tre_livelli: 'Villa su tre livelli o più'
}

const STABILE_FLOOR_LABELS: Record<string, string> = {
  due_piani: 'Stabile di 2 piani',
  tre_piani: 'Stabile di 3 piani',
  quattro_piani: 'Stabile di 4 piani',
  cinque_piani_o_piu: 'Stabile di 5 piani o più'
}

function formatFloor(floor: number | string | undefined | null): string {
  if (floor === undefined || floor === null || floor === ('' as any)) return '—'
  if (typeof floor === 'string' && VILLA_FLOOR_LABELS[floor]) return VILLA_FLOOR_LABELS[floor]
  if (typeof floor === 'string' && STABILE_FLOOR_LABELS[floor]) return STABILE_FLOOR_LABELS[floor]
  const n = Number(floor)
  if (Number.isNaN(n)) return '—'
  if (n === 0) return 'Piano Terra'
  if (n === 6) return 'Attico'
  return `${n}° piano`
}

// L'utente può dichiarare di non conoscere la classe energetica (valore
// "NON_SO" dal wizard): non va mostrata come sigla grezza nel report, ma
// esplicitata come classe con scarsa efficienza energetica (nessun bonus).
function formatEnergyClass(value: string | undefined | null): string {
  if (!value) return '—'
  if (value.toUpperCase() === 'NON_SO') return 'Non specificata (scarsa efficienza energetica)'
  return value.toUpperCase()
}

// --- Testo narrativo generato dai dati strutturati ------------------------

function describePropertyNarrative(p: ValuationReportData['property']): string {
  const sentences: string[] = []
  sentences.push(
    `L'immobile oggetto di questa valutazione è classificato come "${p.type || 'Appartamento'}" ed ha una superficie di ${p.livingArea || 0} mq.`
  )

  const details: string[] = []
  if (p.rooms) details.push(`${p.rooms} locali`)
  if (p.bathrooms) details.push(`${p.bathrooms} bagni`)
  const floorLabel = formatFloor(p.floor)
  if (floorLabel !== '—') details.push(`posizione: ${floorLabel.toLowerCase()}`)
  if (typeof p.hasElevator === 'boolean') {
    details.push(p.hasElevator ? 'presenza di ascensore' : 'assenza di ascensore')
  }
  if (details.length) {
    sentences.push(`Caratteristiche principali: ${details.join(', ')}.`)
  }

  sentences.push(
    `Lo stato di conservazione dichiarato è "${p.condition || 'Buono'}"${p.yearBuilt ? `, con anno di costruzione ${p.yearBuilt}` : ''}.`
  )

  const extras: string[] = []
  if (p.hasBalconyOrTerrace) extras.push(`terrazzo/balcone${p.terraceArea ? ` (circa ${p.terraceArea} mq)` : ''}`)
  if (p.hasGarden) extras.push(`giardino${p.gardenArea ? ` (circa ${p.gardenArea} mq)` : ''}`)
  if (p.hasCantina) extras.push(`cantina${p.cantinaArea ? ` (circa ${p.cantinaArea} mq)` : ''}`)
  if (p.hasPiscina) extras.push('piscina')
  if (p.hasGarage) extras.push('garage/posto auto')
  sentences.push(
    extras.length
      ? `L'immobile dispone inoltre di: ${extras.join(', ')}.`
      : `Non sono state dichiarate pertinenze aggiuntive (terrazzo, giardino, cantina, box).`
  )

  return sentences.join(' ')
}

function describeMethodologyNarrative(omi: ValuationReportData['omi']): string {
  const base = omi?.metodologia
    ? `La stima si basa su: ${omi.metodologia.charAt(0).toLowerCase()}${omi.metodologia.slice(1)}.`
    : `La stima si basa sui valori dell'Osservatorio del Mercato Immobiliare (OMI) dell'Agenzia delle Entrate per il comune di riferimento, incrociati con le caratteristiche specifiche dell'immobile.`
  const range =
    omi?.minMq && omi?.maxMq
      ? ` Il range di riferimento OMI per la zona è ${formatEuro(omi.minMq)} — ${formatEuro(omi.maxMq)} al mq${omi.semestre ? ` (semestre ${omi.semestre})` : ''}.`
      : ''
  return base + range
}

// Elenco puntuale di ciascun bonus/malus applicato al prezzo finale, in
// aggiunta alla frase narrativa di describeMethodologyNarrative. Ogni riga
// riporta la percentuale/valore esatto usato nel calcolo, cosa che la sola
// frase discorsiva non rende leggibile a colpo d'occhio. Vengono mostrate
// solo le voci effettivamente applicabili all'immobile (nessuna riga a 0%).
function buildBonusMalusRows(omi: ValuationReportData['omi']): [string, string][] {
  const rows: [string, string][] = []

  if (omi.condizione) {
    const statoLabel =
      omi.statoOmiFallback
        ? `${omi.condizione} (stima da valore Normale, dato OMI non disponibile per questo stato)`
        : omi.statoOmiUsato
          ? `${omi.condizione} (valore OMI ufficiale stato "${omi.statoOmiUsato}")`
          : omi.condizione
    rows.push(['Stato immobile', statoLabel])
  }

  if (typeof omi.piano === 'number' && omi.piano !== null) {
    const pianoLabel = omi.piano === 6 ? 'Attico' : omi.piano === 0 ? 'Piano Terra' : `${omi.piano}° Piano`
    if (omi.floorBonus) {
      rows.push([`Piano (${pianoLabel})`, `+${Math.round(omi.floorBonus * 100)}%`])
    }
    if (omi.floorNoElevatorPenalty) {
      rows.push(['Assenza ascensore', `-${Math.round(omi.floorNoElevatorPenalty * 100)}%`])
    }
  }

  const superficieExtra = Math.round(
    ((omi.terraceAreaBonus || 0) + (omi.gardenAreaBonus || 0) + (omi.cantinaAreaBonus || 0)) * 10
  ) / 10
  if (omi.terraceAreaBonus) rows.push(['Terrazzo/balcone (30% dei mq)', `+${Math.round(omi.terraceAreaBonus * 10) / 10} mq`])
  if (omi.gardenAreaBonus) rows.push(['Giardino (quota mq secondo tipologia)', `+${Math.round(omi.gardenAreaBonus * 10) / 10} mq`])
  if (omi.cantinaAreaBonus) rows.push(['Cantina (25% dei mq)', `+${Math.round(omi.cantinaAreaBonus * 10) / 10} mq`])
  if (superficieExtra > 0) {
    rows.push(['Totale superficie aggiuntiva considerata', `+${superficieExtra} mq`])
  }

  if (omi.hasPiscina && omi.piscinaBonusMultiplier) {
    rows.push(['Piscina', `+${Math.round(omi.piscinaBonusMultiplier * 100)}%`])
  }

  if (omi.isVillaCategory && omi.villaCategoryBonusMultiplier) {
    rows.push(['Categoria Villa', `+${Math.round(omi.villaCategoryBonusMultiplier * 100)}%`])
  }

  if (omi.bathroomBonusMultiplier) {
    rows.push([`Bagni/lavanderia (${omi.bathrooms ?? ''})`.trim(), `+${Math.round(omi.bathroomBonusMultiplier * 100)}%`])
  }

  if (omi.hasEnergyClassBonus && omi.energyClassBonusMultiplier) {
    rows.push([`Classe energetica ${omi.energyClass || ''}`.trim(), `+${Math.round(omi.energyClassBonusMultiplier * 100)}%`])
  } else if (omi.energyClass && omi.energyClass.toUpperCase() === 'NON_SO') {
    // Classe non dichiarata dal proprietario: nessun bonus (0%), ma va
    // comunque citata nel report come classe con scarsa efficienza
    // energetica, non semplicemente omessa dall'elenco.
    rows.push(['Classe energetica', 'Non specificata — scarsa efficienza energetica (0%)'])
  }

  if (omi.mansardaLowCeilingPercent) {
    rows.push([
      'Superficie mansarda con soffitto <1,5m',
      omi.zonaDiPregio
        ? `${omi.mansardaLowCeilingPercent}% della superficie, malus annullato (zona di pregio)`
        : `${omi.mansardaLowCeilingPercent}% della superficie, conteggiata al 20%`
    ])
  }

  if (omi.loftCeilingHeightBonusMultiplier) {
    rows.push([
      `Altezza soffitti loft (${omi.loftCeilingHeight || ''}m)`,
      `+${Math.round(omi.loftCeilingHeightBonusMultiplier * 100)}%`
    ])
  }

  if (omi.constructionYearMultiplier) {
    const sign = omi.constructionYearMultiplier > 0 ? '+' : '-'
    rows.push([
      `Anno di costruzione (${omi.annoCostruzione ?? '—'})`,
      `${sign}${Math.round(Math.abs(omi.constructionYearMultiplier) * 100)}%`
    ])
  }

  if (omi.zonaDiPregio) {
    rows.push([
      'Zona di pregio',
      omi.priceMultiplierCappedByZonaDiPregio
        ? `Tutti i malus annullati, bonus complessivo limitato a +${Math.round((omi.zonaDiPregioMaxBonusMultiplier ?? 0.25) * 100)}%`
        : 'Tutti i malus annullati'
    ])
  }

  return rows
}

// Disclaimer mostrato solo quando l'immobile è stato marcato come "zona di
// pregio" nel wizard: spiega al cliente cosa significa in pratica questa
// dicitura e perché alcuni fattori normalmente penalizzanti non sono stati
// applicati in questo report.
function describeZonaDiPregioDisclaimer(omi: ValuationReportData['omi']): string {
  const capNote = omi.priceMultiplierCappedByZonaDiPregio
    ? ` Il bonus complessivo derivante da tutte le caratteristiche premium dell'immobile è stato comunque limitato a un tetto massimo di +${Math.round((omi.zonaDiPregioMaxBonusMultiplier ?? 0.25) * 100)}% sul prezzo di mercato di zona, per evitare stime irrealisticamente elevate.`
    : ''
  return (
    'Nota su "zona di pregio": questo immobile è stato segnalato come situato in una zona di particolare pregio ' +
    '(secondo la prassi di stima e la definizione dell\'Osservatorio del Mercato Immobiliare - OMI - dell\'Agenzia delle Entrate, una zona è considerata "di pregio" quando il suo valore medio di mercato supera del 70% la media dell\'intero comune, come tipicamente avviene nei centri storici delle grandi città). ' +
    'In queste aree la posizione e il carattere architettonico/storico dell\'immobile prevalgono sui fattori che altrove riducono il valore: per questo motivo, in questo report, i malus legati all\'età dell\'edificio, allo stato di conservazione originario, all\'assenza di ascensore e alla mansarda con soffitti bassi non sono stati applicati.' +
    capNote
  )
}

function describeMarketContextNarrative(md: ValuationReportData['marketData']): string {
  if (!md) {
    return "Non sono disponibili, al momento della generazione di questo report, dati di mercato aggiuntivi per questa via o zona specifica: la valutazione principale resta comunque basata sui dati OMI ufficiali."
  }
  const scopeLabel = md.scope === 'via' ? 'della via' : md.scope === 'cap' ? 'della zona' : 'del comune'
  const t1Apt = md.trend?.appartamenti?.oneYearPct
  const t1Case = md.trend?.case?.oneYearPct
  const direction = (v: number) => (v > 1 ? 'in crescita' : v < -1 ? 'in calo' : 'sostanzialmente stabile')

  let sentence = `Negli ultimi 12 mesi il mercato immobiliare ${scopeLabel} ha mostrato un andamento `
  if (typeof t1Apt === 'number' && typeof t1Case === 'number') {
    sentence += `${direction(t1Apt)} per gli appartamenti (${formatSignedPercent(t1Apt)}) e ${direction(t1Case)} per le case (${formatSignedPercent(t1Case)}).`
  } else if (typeof t1Apt === 'number') {
    sentence += `${direction(t1Apt)} per gli appartamenti (${formatSignedPercent(t1Apt)}).`
  } else {
    sentence += 'sostanzialmente in linea con la media provinciale.'
  }

  const priceSentence = md.pricePerSqm
    ? ` Il prezzo medio rilevato ${scopeLabel} è di ${formatEuro(md.pricePerSqm)}/mq${md.priceRange ? ` (range ${formatEuro(md.priceRange.min)} — ${formatEuro(md.priceRange.max)}/mq)` : ''}, aggiornato a ${md.referencePeriod}.`
    : ''

  return sentence + priceSentence
}

function describeFutureOutlookNarrative(md: ValuationReportData['marketData']): string {
  if (!md) {
    return "In assenza di dati di mercato aggiuntivi per questa via, si raccomanda di monitorare gli annunci comparabili in zona e di confrontarsi con un professionista locale prima di fissare un prezzo di vendita definitivo."
  }
  const t1 = md.trend?.appartamenti?.oneYearPct ?? md.trend?.case?.oneYearPct
  const t4 = md.trend?.appartamenti?.fourYearPct ?? md.trend?.case?.fourYearPct

  let outlook: string
  if (typeof t1 === 'number' && t1 > 3) {
    outlook =
      'un momento relativamente favorevole per una vendita: la domanda in zona appare sostenuta dal trend di crescita dei prezzi degli ultimi mesi'
  } else if (typeof t1 === 'number' && t1 < -3) {
    outlook =
      'un mercato in fase di raffreddamento: una tempistica di vendita più ravvicinata, con un posizionamento di prezzo realistico fin dall\'inizio, può aiutare a evitare una lunga permanenza sul mercato'
  } else {
    outlook =
      'un mercato sostanzialmente stabile, in cui il posizionamento iniziale del prezzo incide più del semplice tempismo della vendita'
  }

  const trendText =
    typeof t1 === 'number'
      ? `${formatSignedPercent(t1)} nell'ultimo anno${typeof t4 === 'number' ? `, ${formatSignedPercent(t4)} negli ultimi 4 anni` : ''}`
      : 'non disponibile in modo puntuale'

  return `Sulla base dell'andamento dei prezzi rilevato (${trendText}), il contesto attuale suggerisce ${outlook}. Il prezzo di vendita finale dipenderà comunque dallo stato effettivo dell'immobile, dalle condizioni di trattativa e dalle tempistiche personali del venditore: questo report fornisce un punto di partenza basato sui dati disponibili, non una previsione garantita.`
}

function describePriceSynthesisNarrative(sources: { label: string; value: number }[], valuation: ValuationReportData['valuation']): string {
  if (sources.length < 2) {
    return `Il prezzo al mq applicato (${formatEuro(valuation.prezzoAlMq)}/mq) è stato determinato sulla base dei dati ufficiali disponibili per questo immobile.`
  }
  const values = sources.map((s) => s.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const sourceLabels = sources.map((s) => s.label.toLowerCase()).join(', ')
  return `Il grafico confronta ${sources.length} stime indipendenti del prezzo al mq per la zona (${sourceLabels}), che vanno da ${formatEuro(min)}/mq a ${formatEuro(max)}/mq. Il nostro prezzo proposto di ${formatEuro(valuation.prezzoAlMq)}/mq tiene conto di queste fonti e le combina con le caratteristiche specifiche dell'immobile (stato, piano, dotazioni), per arrivare a una stima calibrata e non a una semplice media di mercato.`
}

// Punteggio sintetico 0-100 calcolato SOLO dai dati POI già disponibili
// (nessuna fonte esterna nuova): combina varietà (quante categorie su quelle
// cercate sono state trovate, max 70 punti) e vicinanza media dei servizi
// trovati (max 30 punti, più vicino = più punti). Puramente indicativo — non
// è uno standard esterno riconosciuto, va presentato come tale nel report.
function computeComfortScore(nearbyPoi: ValuationReportData['nearbyPoi']): number | null {
  if (!nearbyPoi || !nearbyPoi.categories?.length) return null
  const total = nearbyPoi.totalCategoriesSearched || nearbyPoi.categories.length
  const radius = nearbyPoi.radiusMeters || 500

  const varietyScore = Math.min(1, nearbyPoi.categories.length / total) * 70

  const proximityFactors = nearbyPoi.categories.map((cat) => {
    const minDist = Math.min(...cat.items.map((i) => i.distanceMeters))
    return Math.max(0, 1 - minDist / radius)
  })
  const avgProximity =
    proximityFactors.reduce((a, b) => a + b, 0) / proximityFactors.length
  const proximityScore = avgProximity * 30

  return Math.round(Math.min(100, varietyScore + proximityScore))
}

function comfortScoreLabel(score: number): string {
  if (score >= 80) return 'Eccellente'
  if (score >= 60) return 'Buona'
  if (score >= 40) return 'Media'
  return 'Limitata'
}

function describeComfortScoreNarrative(score: number, nearbyPoi: ValuationReportData['nearbyPoi']): string {
  const label = comfortScoreLabel(score).toLowerCase()
  const count = nearbyPoi?.categories?.length || 0
  const total = nearbyPoi?.totalCategoriesSearched || count
  return `Il punteggio è calcolato in base a quanti servizi (su ${total} categorie cercate: farmacie, scuole, trasporti, negozi, ecc.) sono presenti entro ${nearbyPoi?.radiusMeters || 500} metri e a quanto sono vicini in media. Con ${count} categorie di servizi trovate nelle vicinanze, la comodità della zona risulta ${label}. È un indicatore puramente orientativo basato su dati di mappatura OpenStreetMap, non una certificazione ufficiale.`
}

// Testo introduttivo (non dipende dai dati specifici trovati): spiega perché
// la sezione POI è rilevante per chi legge il report, prima di mostrare
// l'elenco effettivo. Va SEMPRE mostrato quando la sezione compare.
function describePoiVantaggioNarrative(): string {
  return `La vicinanza a servizi essenziali — farmacie, scuole, mezzi pubblici, supermercati, ospedali, parchi — è uno dei fattori che gli acquirenti valutano con più attenzione nella scelta di una casa. Un immobile ben servito riduce la dipendenza dall'auto per gli spostamenti quotidiani, amplia il bacino di potenziali acquirenti (famiglie con figli, anziani, chi lavora fuori casa) e tende a mantenere il proprio valore più stabilmente nel tempo rispetto a zone isolate con gli stessi metri quadri.`
}

// Idem per le scuole: spiega perché il dato è rilevante prima di mostrare i
// numeri specifici del comune.
function describeScuoleVantaggioNarrative(): string {
  return `La presenza e la varietà di scuole nel comune (dall'infanzia alle superiori) è un elemento che le famiglie con figli considerano con attenzione nella scelta dell'abitazione. Un comune con un'offerta scolastica completa risulta generalmente più attrattivo per questo tipo di acquirenti, ampliando il pubblico potenzialmente interessato all'immobile e, di conseguenza, sostenendone l'appetibilità sul mercato.`
}

function describeConfrontoProvincialeNarrative(c: NonNullable<ValuationReportData['confrontoProvinciale']>): string {
  const direzione = c.scostamentoPct > 0 ? 'superiore' : c.scostamentoPct < 0 ? 'inferiore' : 'in linea con'
  const abs = Math.abs(c.scostamentoPct)
  const provinciaLabel = c.provincia ? `della provincia di ${c.provincia}` : 'provinciale'
  if (abs < 2) {
    return `Il prezzo al mq di questa zona (${formatEuro(c.zonaEurMq)}/mq) è sostanzialmente in linea con la media ${provinciaLabel} (${formatEuro(c.provinciaEurMq)}/mq).`
  }
  return `Il prezzo al mq di questa zona (${formatEuro(c.zonaEurMq)}/mq) risulta ${direzione} del ${abs}% rispetto alla media ${provinciaLabel} (${formatEuro(c.provinciaEurMq)}/mq, calcolata su ${c.comuniCountUsed} comuni).`
}

// Testo introduttivo, generico: spiega perché il trend demografico è
// rilevante per chi legge il report, prima di mostrare i numeri specifici.
function describeDemograficoVantaggioNarrative(): string {
  return `L'andamento della popolazione di un comune è un indicatore indiretto ma utile della "salute" della domanda immobiliare di lungo periodo: un comune che attrae o mantiene residenti tende a sostenere la domanda di case, mentre uno spopolamento prolungato può tradursi in un mercato più debole e tempi di vendita più lunghi, a parità di altre condizioni.`
}

function describeAndamentoDemograficoNarrative(d: NonNullable<ValuationReportData['andamentoDemografico']>): string {
  const numAnni = d.annoFine - d.annoInizio
  const formattaAbitanti = (n: number) => n.toLocaleString('it-IT')
  if (d.variazionePct === null) {
    return `Dato disponibile solo per l'anno ${d.annoFine}: popolazione residente ${formattaAbitanti(d.popolazioneFine)} abitanti. Fonte: bilancio demografico ISTAT.`
  }
  const direzione = d.variazionePct > 0 ? 'in crescita' : d.variazionePct < 0 ? 'in calo' : 'stabile'
  const abs = Math.abs(d.variazionePct)
  const commento =
    d.variazionePct > 0.1
      ? 'un segnale generalmente positivo per la domanda immobiliare di zona.'
      : d.variazionePct < -0.1
        ? 'un segnale da monitorare: un calo prolungato può indicare una domanda più debole, a parità di altre condizioni.'
        : 'un mercato locale con una base di domanda relativamente stabile.'
  return `Tra il ${d.annoInizio} e il ${d.annoFine} (${numAnni} anni) la popolazione residente nel comune è passata da ${formattaAbitanti(d.popolazioneInizio)} a ${formattaAbitanti(d.popolazioneFine)} abitanti: un andamento ${direzione}${abs > 0.1 ? ` del ${abs}%` : ''}, ${commento} Fonte: bilancio demografico ISTAT.`
}

// Colloca un valore in una fascia (bassa/medio-bassa/media/medio-alta/alta)
// all'interno di un intervallo min-max, per descrivere a parole dove si
// posiziona il prezzo proposto rispetto al mercato di riferimento.
function positionLabel(value: number, min: number, max: number): string {
  if (max <= min) return 'media'
  const pct = (value - min) / (max - min)
  if (pct < 0.2) return 'bassa'
  if (pct < 0.4) return 'medio-bassa'
  if (pct < 0.6) return 'media'
  if (pct < 0.8) return 'medio-alta'
  return 'alta'
}

const ENERGY_CLASS_COMMENT: Record<string, string> = {
  A4: 'una prestazione energetica eccellente, tra gli elementi più apprezzati dal mercato attuale',
  A3: 'una prestazione energetica eccellente, tra gli elementi più apprezzati dal mercato attuale',
  A2: 'una prestazione energetica eccellente, tra gli elementi più apprezzati dal mercato attuale',
  A1: 'una prestazione energetica eccellente, tra gli elementi più apprezzati dal mercato attuale',
  A: 'una prestazione energetica eccellente, tra gli elementi più apprezzati dal mercato attuale',
  B: 'una buona prestazione energetica, con costi di gestione contenuti',
  C: 'una prestazione energetica nella media',
  D: 'una prestazione energetica nella media, con margini di miglioramento sul fronte dei consumi',
  E: 'una prestazione energetica non efficiente, che comporta potenziali maggiori costi di gestione',
  F: 'una prestazione energetica non efficiente, che comporta potenziali maggiori costi di gestione',
  G: 'una prestazione energetica scarsa, con costi di riscaldamento/climatizzazione elevati e possibili interventi di efficientamento da valutare'
}

// Relazione di valutazione finale: testo narrativo denso di informazioni
// concrete, tratte esclusivamente dai dati reali già raccolti per questa
// valutazione (nessun dato inventato). Struttura ripresa dalle relazioni di
// valutazione professionali di settore: presentazione immobile, condizioni
// interne, contesto di zona, confronto con il mercato, posizionamento del
// prezzo, sintesi conclusiva.
function describeRelazioneValutazione(data: ValuationReportData): string[] {
  const p = data.property
  const paragrafi: string[] = []
  const indirizzo = data.lead.indirizzo || 'zona non specificata'
  const tipoLower = (p.type || 'immobile').toLowerCase()

  // --- 1. Presentazione immobile e contesto di zona ---
  const compo: string[] = []
  if (p.rooms) compo.push(`${p.rooms} ${p.rooms === 1 ? 'locale' : 'locali'}`)
  if (p.bathrooms) compo.push(`${p.bathrooms} ${p.bathrooms === 1 ? 'bagno' : 'bagni'}`)
  const floorLabel = formatFloor(p.floor)
  let apertura = `L'immobile situato in ${indirizzo} si presenta come un'unità di tipo "${tipoLower}" di circa ${p.livingArea || 0} mq${compo.length ? `, composta da ${compo.join(' e ')}` : ''}.`
  if (floorLabel !== '—') {
    apertura += ` È collocato al ${floorLabel.toLowerCase()}${typeof p.hasElevator === 'boolean' ? `, ${p.hasElevator ? 'con ascensore' : 'senza ascensore'}` : ''}.`
  }
  const comfortScore = computeComfortScore(data.nearbyPoi)
  if (comfortScore !== null) {
    if (comfortScore >= 70) {
      apertura += ' La zona risulta ben servita, con una buona concentrazione di servizi essenziali (farmacie, scuole, trasporti, negozi) nelle immediate vicinanze, un fattore che tende ad ampliare il bacino di potenziali acquirenti.'
    } else if (comfortScore >= 40) {
      apertura += ' La zona presenta una dotazione di servizi nella media, con alcuni servizi essenziali comodamente raggiungibili e altri a distanza maggiore.'
    } else {
      apertura += ' La zona presenta una dotazione di servizi più limitata nel raggio considerato, un aspetto da tenere in conto nel confronto con immobili più centrali.'
    }
  }
  if (data.marketData?.scope === 'via') {
    apertura += ` L'analisi di mercato è stata condotta specificamente su questa via, il che rende il confronto di prezzo particolarmente puntuale.`
  }
  paragrafi.push(apertura)

  // --- 2. Condizioni interne e dotazioni ---
  let condizioni = `Le condizioni interne dichiarate sono "${p.condition || 'Buono'}"${p.yearBuilt ? `, con anno di costruzione ${p.yearBuilt}` : ''}.`
  if (p.energyClass) {
    const classeNorm = p.energyClass.toUpperCase()
    const commentoClasse = ENERGY_CLASS_COMMENT[classeNorm] || 'una prestazione energetica non specificata in dettaglio'
    condizioni += ` L'immobile è in classe energetica ${classeNorm}, indice di ${commentoClasse}.`
  }
  const extras: string[] = []
  if (p.hasBalconyOrTerrace) extras.push(`terrazzo/balcone${p.terraceArea ? ` (circa ${p.terraceArea} mq)` : ''}`)
  if (p.hasGarden) extras.push(`giardino${p.gardenArea ? ` (circa ${p.gardenArea} mq)` : ''}`)
  if (p.hasCantina) extras.push(`cantina${p.cantinaArea ? ` (circa ${p.cantinaArea} mq)` : ''}`)
  if (p.hasPiscina) extras.push('piscina')
  if (p.hasGarage) extras.push('garage/posto auto')
  condizioni += extras.length
    ? ` Sono inoltre presenti: ${extras.join(', ')}.`
    : ' Non risultano dichiarati spazi esterni pertinenziali (balcone, terrazzo, giardino) né pertinenze accessorie come cantina o box.'
  paragrafi.push(condizioni)

  // --- 3. Contesto di zona: demografia, confronto provinciale, eventuali criticità dichiarate ---
  const contestoParti: string[] = []
  if (data.andamentoDemografico && data.andamentoDemografico.variazionePct !== null) {
    const d = data.andamentoDemografico
    const direzione = d.variazionePct > 0.1 ? 'in crescita' : d.variazionePct < -0.1 ? 'in calo' : 'stabile'
    contestoParti.push(
      `Dal punto di vista demografico, il comune ha registrato una popolazione ${direzione} tra il ${d.annoInizio} e il ${d.annoFine} (${formatSignedPercent(d.variazionePct)}), un indicatore indiretto della tenuta della domanda immobiliare locale nel lungo periodo.`
    )
  }
  if (data.confrontoProvinciale) {
    contestoParti.push(describeConfrontoProvincialeNarrative(data.confrontoProvinciale))
  }
  if (p.condition === 'Da ristrutturare') {
    contestoParti.push(
      "Si segnala che l'immobile necessita di lavori di ristrutturazione: nel fissare il prezzo di vendita è opportuno tenere conto di un budget indicativo per gli interventi necessari, oppure comunicarlo chiaramente in trattativa per giustificare un eventuale margine di negoziazione."
    )
  } else if (p.condition === 'Ottimo' || p.condition === 'Nuovo') {
    contestoParti.push(
      "Lo stato di conservazione ottimo rappresenta un punto di forza concreto: l'immobile è pronto per essere abitato senza interventi, un elemento che il mercato tende a valorizzare rispetto a soluzioni da ristrutturare nella stessa zona."
    )
  }
  if (contestoParti.length) {
    paragrafi.push(contestoParti.join(' '))
  }

  // --- 4. Confronto con il mercato: range comparabili/compravenduti reali ---
  const rangeCandidates: number[] = []
  if (data.omi.minMq) rangeCandidates.push(data.omi.minMq)
  if (data.omi.maxMq) rangeCandidates.push(data.omi.maxMq)
  if (data.marketData?.priceRange) {
    rangeCandidates.push(data.marketData.priceRange.min, data.marketData.priceRange.max)
  }
  const recentVals = data.marketData?.recentValuations?.map((v) => v.prezzoAlMq).filter((v) => v > 0) || []
  if (recentVals.length) rangeCandidates.push(...recentVals)

  if (rangeCandidates.length >= 2) {
    const rangeMin = Math.min(...rangeCandidates)
    const rangeMax = Math.max(...rangeCandidates)
    const scopeLabel = data.marketData?.scope === 'via' ? 'della via' : data.marketData?.scope === 'cap' ? 'della zona' : 'del comune'
    let mercatoTxt = `Analizzando il mercato immobiliare ${scopeLabel}, si riscontrano valori compresi generalmente tra circa ${formatEuro(rangeMin)}/mq e ${formatEuro(rangeMax)}/mq${data.marketData?.referencePeriod ? `, con dati aggiornati a ${data.marketData.referencePeriod}` : ''}.`
    if (recentVals.length >= 2) {
      mercatoTxt += ` A conferma di questo, risultano ${recentVals.length} valutazioni recenti effettuate su immobili nelle vicinanze, con prezzi al mq che vanno da ${formatEuro(Math.min(...recentVals))} a ${formatEuro(Math.max(...recentVals))} €/mq.`
    }
    paragrafi.push(mercatoTxt)
  }

  // --- 5. Posizionamento del prezzo proposto ---
  const posizRange: number[] = [...rangeCandidates]
  if (data.confrontoProvinciale) posizRange.push(data.confrontoProvinciale.provinciaEurMq)
  let posizionamento: string
  if (posizRange.length >= 2) {
    const pMin = Math.min(...posizRange)
    const pMax = Math.max(...posizRange)
    const label = positionLabel(data.valuation.prezzoAlMq, pMin, pMax)
    const motivazione =
      p.condition === 'Da ristrutturare'
        ? "coerente con lo stato attuale dell'unità, che richiede lavori di ristrutturazione"
        : p.condition === 'Ottimo' || p.condition === 'Nuovo'
          ? "coerente con l'ottimo stato di conservazione dell'immobile"
          : 'coerente con le caratteristiche generali rilevate e con il contesto di mercato della zona'
    posizionamento = `Alla luce di quanto sopra, il prezzo proposto di ${formatEuro(data.valuation.prezzoAlMq)}/mq si colloca nella fascia ${label} del mercato di riferimento, risultando ${motivazione}.`
  } else {
    posizionamento = `Il prezzo proposto di ${formatEuro(data.valuation.prezzoAlMq)}/mq è stato determinato sulla base dei dati OMI ufficiali disponibili per questo immobile e per la relativa zona.`
  }
  paragrafi.push(posizionamento)

  // --- 6. Sintesi conclusiva ---
  const targetParti: string[] = []
  if (p.rooms && p.rooms <= 2) targetParti.push('single, coppie o piccoli investitori orientati alla locazione')
  else if (p.rooms && p.rooms >= 4) targetParti.push('famiglie in cerca di maggiori spazi')
  else targetParti.push('un pubblico ampio di acquirenti')
  const sintesi = `In sintesi, l'immobile può rappresentare una soluzione adatta a ${targetParti[0]}, con un prezzo che riflette lo stato attuale dell'unità e il contesto di mercato della zona. Si raccomanda comunque un sopralluogo diretto con un professionista del settore per una valutazione completa, che tenga conto di elementi non desumibili dai soli dati disponibili (rifiniture, luminosità reale, rumorosità, stato effettivo dell'edificio condominiale).`
  paragrafi.push(sintesi)

  return paragrafi
}

function generateFallbackStrengthsWeaknesses(
  property: ValuationReportData['property']
): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = []
  const weaknesses: string[] = []
  const floorNum = typeof property.floor === 'number' ? property.floor : null

  if (floorNum !== null && floorNum >= 2 && property.hasElevator) {
    strengths.push('Piano alto servito da ascensore: più luce, vista e minore rumore stradale.')
  }
  if (floorNum !== null && floorNum >= 2 && property.hasElevator === false) {
    weaknesses.push('Piano alto senza ascensore: può limitare l\'interesse di alcuni acquirenti (famiglie con bambini, anziani).')
  }
  if (property.hasBalconyOrTerrace) {
    strengths.push('Presenza di terrazzo/balcone, elemento sempre apprezzato dal mercato.')
  }
  if (property.hasGarden) {
    strengths.push('Giardino privato: caratteristica rara nelle zone centrali e molto richiesta dalle famiglie.')
  }
  if (property.hasGarage) {
    strengths.push('Posto auto/garage incluso: riduce un pensiero comune agli acquirenti in città.')
  }
  if (property.hasPiscina) {
    strengths.push('Piscina privata: caratteristica distintiva per immobili di questa fascia.')
  }
  if (property.condition === 'Da ristrutturare') {
    weaknesses.push('Immobile da ristrutturare: il prezzo di vendita dovrà tenere conto dei lavori necessari.')
  }
  if (property.condition === 'Ottimo' || property.condition === 'Nuovo') {
    strengths.push('Stato di conservazione ottimo: pronto per essere abitato senza interventi.')
  }

  if (!strengths.length) {
    strengths.push('Immobile con caratteristiche in linea con lo standard di zona.')
  }
  if (!weaknesses.length) {
    weaknesses.push(
      'Nessuna criticità particolare rilevata dai dati disponibili; si raccomanda comunque un sopralluogo per una valutazione completa.'
    )
  }
  return { strengths, weaknesses }
}

// --- Componenti grafici vettoriali (pdfkit puro, nessuna dipendenza extra) --

function drawRangeBar(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  min: number,
  avg: number,
  max: number
) {
  const barHeight = 12
  doc.fillColor(SLATE).fontSize(9).font('Helvetica-Bold')
     .text(`Media: ${formatEuro(avg)}/mq`, x, y, { width, align: 'center' })

  const trackY = y + 16
  doc.roundedRect(x, trackY, width, barHeight, 6).fill(SLATE_LIGHT)

  if (max > min) {
    const markerX = x + Math.min(1, Math.max(0, (avg - min) / (max - min))) * width
    doc.roundedRect(x, trackY, Math.min(width, markerX - x), barHeight, 6).fill(ACCENT_LIGHT)
    doc.circle(markerX, trackY + barHeight / 2, 6).fill(ACCENT)
  }

  doc.fillColor(SLATE).fontSize(8).font('Helvetica')
     .text(formatEuro(min), x, trackY + barHeight + 6)
  doc.text(formatEuro(max), x, trackY + barHeight + 6, { width, align: 'right' })
}

// Barra di avanzamento semplice usata per il "punteggio comodità zona":
// stessa estetica di drawRangeBar ma senza marker min/max, solo riempimento
// proporzionale al punteggio 0-100.
function drawScoreGauge(doc: PDFKit.PDFDocument, x: number, y: number, width: number, score: number, label: string) {
  const barHeight = 14
  doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text(`Punteggio comodità zona: ${score}/100 (${label})`, x, y, { width })

  const trackY = y + 18
  doc.roundedRect(x, trackY, width, barHeight, 7).fill(SLATE_LIGHT)
  const fillWidth = Math.max(barHeight, (Math.min(100, Math.max(0, score)) / 100) * width)
  doc.roundedRect(x, trackY, fillWidth, barHeight, 7).fill(ACCENT)
}

function drawTrendChart(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  bars: { label: string; value: number | null }[]
) {
  const chartHeight = 110
  const zeroY = y + chartHeight / 2
  const maxAbs = Math.max(1, ...bars.map((b) => Math.abs(b.value || 0)))
  const gap = width / bars.length
  const barWidth = Math.min(48, gap - 24)

  doc.moveTo(x, zeroY).lineTo(x + width, zeroY).strokeColor(LINE).lineWidth(1).stroke()

  bars.forEach((b, i) => {
    const val = b.value || 0
    const barPixelHeight = (Math.abs(val) / maxAbs) * (chartHeight / 2 - 16)
    const barX = x + i * gap + (gap - barWidth) / 2
    const color = val >= 0 ? GREEN : RED

    if (val >= 0) {
      doc.rect(barX, zeroY - barPixelHeight, barWidth, barPixelHeight).fill(color)
    } else {
      doc.rect(barX, zeroY, barWidth, barPixelHeight).fill(color)
    }

    doc.fillColor(INK).fontSize(8).font('Helvetica-Bold').text(
      formatSignedPercent(b.value),
      barX - 16,
      val >= 0 ? zeroY - barPixelHeight - 13 : zeroY + barPixelHeight + 4,
      { width: barWidth + 32, align: 'center' }
    )
    doc.fillColor(SLATE).fontSize(7.5).font('Helvetica').text(
      b.label,
      barX - 20,
      zeroY + chartHeight / 2 - 12,
      { width: barWidth + 40, align: 'center' }
    )
  })

  return y + chartHeight + 14
}

// Grafico a barre per confrontare più stime di prezzo/mq indipendenti (OMI, comparabili, compravenduti).
function drawComparisonBarChart(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  bars: { label: string; value: number; highlight?: boolean }[]
): number {
  const chartHeight = 120
  const maxVal = Math.max(1, ...bars.map((b) => b.value || 0))
  const gap = width / bars.length
  const barWidth = Math.min(80, gap - 30)
  const baseY = y + chartHeight

  doc.moveTo(x, baseY).lineTo(x + width, baseY).strokeColor(LINE).lineWidth(1).stroke()

  bars.forEach((b, i) => {
    const val = b.value || 0
    const barPixelHeight = maxVal > 0 ? (val / maxVal) * (chartHeight - 30) : 0
    const barX = x + i * gap + (gap - barWidth) / 2
    const color = b.highlight ? ACCENT : SECONDARY_BAR

    doc.rect(barX, baseY - barPixelHeight, barWidth, barPixelHeight).fill(color)
    doc.fillColor(INK).fontSize(9).font('Helvetica-Bold').text(
      `${formatEuro(val)}/mq`,
      barX - 15,
      baseY - barPixelHeight - 14,
      { width: barWidth + 30, align: 'center' }
    )
    doc.fillColor(SLATE).fontSize(8).font('Helvetica').text(
      b.label,
      barX - 25,
      baseY + 6,
      { width: barWidth + 50, align: 'center' }
    )
  })

  return baseY + 26
}

// Griglia a 2 colonne per foto/planimetrie caricate dall'utente nel wizard.
// Ogni cella ha una dimensione fissa e usa "fit" per non deformare l'immagine
// (mantiene le proporzioni originali, centrata nella cella). I file non più
// presenti su disco o non validi vengono saltati silenziosamente: un'unica
// foto mancante non deve mai far fallire la generazione dell'intero report.
function drawImageGrid(doc: PDFKit.PDFDocument, y: number, sectionLabel: string, imagePaths: string[]): number {
  const contentWidth = doc.page.width - MARGIN * 2
  const gap = 14
  const cellWidth = (contentWidth - gap) / 2
  const cellHeight = 150
  let col = 0
  let rowY = y

  const validPaths = imagePaths.filter((p) => {
    try {
      return !!p && fs.existsSync(p)
    } catch {
      return false
    }
  })

  validPaths.forEach((imgPath) => {
    if (col === 0) {
      rowY = ensureSpace(doc, rowY, sectionLabel, cellHeight + 30)
    }
    const x = col === 0 ? MARGIN : MARGIN + cellWidth + gap
    doc.roundedRect(x, rowY, cellWidth, cellHeight, 8).fillAndStroke(SLATE_LIGHT, LINE)
    try {
      doc.image(imgPath, x + 4, rowY + 4, { fit: [cellWidth - 8, cellHeight - 8], align: 'center', valign: 'center' })
    } catch {
      // Immagine non valida/corrotta: la cella resta come placeholder vuoto.
    }
    col++
    if (col === 2) {
      col = 0
      rowY += cellHeight + gap
    }
  })
  if (col === 1) rowY += cellHeight + gap

  return rowY
}

// --- Layout: header/footer di pagina --------------------------------------
// Ogni pagina di contenuto riprende lo schema del report di riferimento:
// fascia blu navy in testa con il titolo della sezione, e sotto una grande
// card bianca arrotondata (che si sovrappone leggermente alla fascia) dentro
// cui scorre il contenuto. Il footer riporta un filo sottile + il nome dello
// studio/agenzia (se disponibile) o "Valuta Facile", come nei report di
// settore con marchio dell'agenzia in calce a ogni pagina.

function drawPageFrame(doc: PDFKit.PDFDocument, title: string, agencyLabel?: string): number {
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height

  // Fascia navy in testa alla pagina, a tutta larghezza.
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT).fill(NAVY)
  doc.fillColor(WHITE).fontSize(20).font('Helvetica-Bold').text(title, MARGIN, 34, { width: pageWidth - MARGIN * 2 })

  // Card bianca che occupa il resto della pagina, sovrapposta alla fascia blu.
  const cardY = HEADER_HEIGHT - 26
  const cardBottom = pageHeight - FOOTER_RESERVED - 8
  doc.roundedRect(CARD_INSET, cardY, pageWidth - CARD_INSET * 2, cardBottom - cardY, 14)
     .fillAndStroke(WHITE, LINE)

  drawPageFooter(doc, agencyLabel)

  doc.fillColor(INK)
  return cardY + 34
}

function drawPageFooter(doc: PDFKit.PDFDocument, agencyLabel?: string) {
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const lineY = pageHeight - FOOTER_RESERVED
  doc.moveTo(CARD_INSET, lineY).lineTo(pageWidth - CARD_INSET, lineY).strokeColor(LINE).lineWidth(1).stroke()

  // Piccolo logo Valuta Facile a sinistra del footer (come il marchio
  // dell'agenzia nei report di settore usati come riferimento).
  if (LOGO_EXISTS) {
    const logoHeight = 13
    const logoWidth = logoHeight * LOGO_ASPECT
    doc.image(LOGO_PATH, CARD_INSET, lineY + 11, { width: logoWidth, height: logoHeight })
  }

  doc.fillColor(SLATE).fontSize(8).font('Helvetica-Bold')
     .text(agencyLabel || 'Valuta Facile', pageWidth - CARD_INSET - 200, lineY + 10, { width: 200, align: 'right' })
}

// Se non c'è più spazio utile in fondo alla pagina, apre una nuova pagina con lo stesso frame (stessa sezione).
function ensureSpace(doc: PDFKit.PDFDocument, y: number, sectionLabel: string, minSpace: number): number {
  if (y > doc.page.height - minSpace) {
    doc.addPage()
    return drawPageFrame(doc, sectionLabel)
  }
  return y
}

function sectionTitle(doc: PDFKit.PDFDocument, y: number, title: string): number {
  doc.fillColor(INK).fontSize(14).font('Helvetica-Bold').text(title, MARGIN, y)
  doc.moveTo(MARGIN, y + 19).lineTo(doc.page.width - MARGIN, y + 19).strokeColor(ACCENT_LIGHT).lineWidth(1.5).stroke()
  return y + 30
}

function paragraph(doc: PDFKit.PDFDocument, y: number, text: string, opts: { size?: number; color?: string } = {}): number {
  const width = doc.page.width - MARGIN * 2
  doc.fillColor(opts.color || SLATE).fontSize(opts.size || 9.5).font('Helvetica').text(text, MARGIN, y, { width, align: 'left', lineGap: 2 })
  return y + doc.heightOfString(text, { width, lineGap: 2 }) + 12
}

// Didascalia breve sotto un grafico, per spiegare come leggerlo (in corsivo, più piccola del testo normale).
function chartCaption(doc: PDFKit.PDFDocument, y: number, text: string): number {
  const width = doc.page.width - MARGIN * 2
  doc.fillColor(SLATE).fontSize(8).font('Helvetica-Oblique').text(text, MARGIN, y, { width, align: 'left', lineGap: 1 })
  return y + doc.heightOfString(text, { width, lineGap: 1 }) + 10
}

// --- Generazione PDF -------------------------------------------------------

export async function generateValuationReport(data: ValuationReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      // Margini a 0: la paginazione è gestita interamente a mano (ensureSpace),
      // usando coordinate assolute per ogni testo/grafico. Con un margine >0
      // pdfkit inserisce pagine aggiuntive "invisibili" in automatico ogni
      // volta che un blocco di testo si avvicina al fondo pagina (comportamento
      // di default per il flow di testo), che qui è indesiderato e produceva
      // decine di pagine bianche in più.
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      info: { Title: 'Report Valutazione Immobiliare — Valuta Facile' }
    })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const contentWidth = doc.page.width - MARGIN * 2

    // ============================= PAGINA 1: COPERTINA =============================
    // Copertina chiara, in stile "report di mercato" di settore: wordmark in
    // alto, titolo centrato, indirizzo come sottotitolo, e una fascia navy in
    // fondo pagina con il riepilogo della stima e i dati del destinatario.
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(WHITE)
    if (LOGO_EXISTS) {
      const coverLogoHeight = 34
      const coverLogoWidth = coverLogoHeight * LOGO_ASPECT
      doc.image(LOGO_PATH, (doc.page.width - coverLogoWidth) / 2, 80, { width: coverLogoWidth, height: coverLogoHeight })
    } else {
      doc.fillColor(NAVY).fontSize(20).font('Helvetica-Bold').text('Valuta Facile', 0, 90, { width: doc.page.width, align: 'center' })
    }

    doc.fillColor(SLATE).fontSize(11).font('Helvetica')
       .text(`Realizzato per ${`${data.lead.nome} ${data.lead.cognome}`.trim() || 'il cliente'}`, 0, 200, { width: doc.page.width, align: 'center' })
    doc.fillColor(INK).fontSize(34).font('Helvetica-Bold')
       .text('Report di Valutazione', 0, 230, { width: doc.page.width, align: 'center' })
    doc.fillColor(SLATE).fontSize(15).font('Helvetica')
       .text(data.lead.indirizzo || 'Indirizzo non specificato', MARGIN, 280, { width: contentWidth, align: 'center' })

    const footBandHeight = 190
    const footBandY = doc.page.height - footBandHeight
    doc.rect(0, footBandY, doc.page.width, footBandHeight).fill(NAVY)

    doc.fillColor('#a5b4fc').fontSize(9).font('Helvetica').text('STIMA VALORE DI MERCATO', MARGIN, footBandY + 26)
    doc.fillColor(WHITE).fontSize(30).font('Helvetica-Bold').text(formatEuro(data.valuation.prezzoMedio), MARGIN, footBandY + 42)
    doc.fillColor('#c7d2fe').fontSize(10).font('Helvetica')
       .text(`${formatEuro(data.valuation.prezzoAlMq)}/mq · ${data.property.type || ''} di ${data.property.livingArea || 0} mq${data.property.rooms ? ` · ${data.property.rooms} locali` : ''}`, MARGIN, footBandY + 78)

    doc.moveTo(MARGIN, footBandY + 108).lineTo(doc.page.width - MARGIN, footBandY + 108).strokeColor('#3a5578').lineWidth(1).stroke()

    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
       .text(`Generato il ${data.lead.createdAt}`, MARGIN, footBandY + 120)

    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
       .text(
         'Questo report ha carattere informativo e non sostituisce una perizia professionale. Le pagine seguenti dettagliano caratteristiche, metodologia e contesto di mercato alla base di questa stima.',
         MARGIN, footBandY + 138, { width: contentWidth }
       )

    // ================== PAGINA 2: CARATTERISTICHE E VALUTAZIONE ==================
    doc.addPage()
    let y = drawPageFrame(doc, 'Caratteristiche e valutazione')

    y = sectionTitle(doc, y, 'Caratteristiche immobile')
    // Regola: qualsiasi caratteristica aggiuntiva inserita dall'utente nel
    // wizard (giardino, terrazzo, cantina, piscina, garage, classe
    // energetica, riscaldamento...) deve essere visibile qui, non solo
    // citata di sfuggita nel testo narrativo sotto. Le righe sono
    // aggiunte solo quando il dato è stato effettivamente dichiarato, per non
    // riempire la griglia di "—" per le tipologie che non le prevedono.
    const p = data.property
    const props: [string, string][] = [
      ['Tipologia', p.type || '—'],
      ['Superficie', `${p.livingArea || 0} mq`],
      ['Locali', p.rooms ? String(p.rooms) : '—'],
      ['Bagni', p.bathrooms ? String(p.bathrooms) : '—'],
      ['Piano', formatFloor(p.floor)],
      ['Ascensore', typeof p.hasElevator === 'boolean' ? (p.hasElevator ? 'Sì' : 'No') : '—'],
      ['Stato', p.condition || '—'],
      ['Anno costruzione', p.yearBuilt || '—']
    ]
    if (p.energyClass) props.push(['Classe energetica', formatEnergyClass(p.energyClass)])
    if (p.heating) props.push(['Riscaldamento', p.heating])
    if (p.hasBalconyOrTerrace) props.push(['Terrazzo/Balcone', p.terraceArea ? `Sì (${p.terraceArea} mq)` : 'Sì'])
    if (p.hasGarden) props.push(['Giardino', p.gardenArea ? `Sì (${p.gardenArea} mq)` : 'Sì'])
    if (p.hasCantina) props.push(['Cantina', p.cantinaArea ? `Sì (${p.cantinaArea} mq)` : 'Sì'])
    if (p.hasPiscina) props.push(['Piscina', 'Sì'])
    if (p.hasGarage) props.push(['Garage/posto auto', p.garageArea ? `Sì (${p.garageArea} mq)` : 'Sì'])
    if (p.zonaDiPregio) props.push(['Zona di pregio', 'Sì'])
    let col = 0
    let rowY = y
    props.forEach(([label, value]) => {
      const x = col === 0 ? MARGIN : MARGIN + contentWidth / 2
      doc.fillColor(SLATE).fontSize(8).font('Helvetica').text(label.toUpperCase(), x, rowY)
      doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text(value, x, rowY + 11)
      col++
      if (col === 2) { col = 0; rowY += 34 }
    })
    if (col === 1) rowY += 34
    y = rowY + 10

    y = paragraph(doc, y, describePropertyNarrative(data.property))

    y = sectionTitle(doc, y, 'Come è stata calcolata la stima')
    y = paragraph(doc, y, describeMethodologyNarrative(data.omi))
    if (data.confrontoProvinciale) {
      y = paragraph(doc, y, describeConfrontoProvincialeNarrative(data.confrontoProvinciale))
    }

    // Elenco puntuale di ogni bonus/malus applicato: la frase narrativa sopra
    // riassume la metodologia in linguaggio discorsivo, ma su richiesta
    // dell'utente qui riportiamo anche il dettaglio analitico riga per riga
    // (percentuale/mq esatti), così chi legge il report può verificare da
    // dove viene ciascuna variazione rispetto al valore OMI base.
    const bonusMalusRows = buildBonusMalusRows(data.omi)
    if (bonusMalusRows.length) {
      y = ensureSpace(doc, y, 'Come è stata calcolata la stima', bonusMalusRows.length * 18 + 40)
      doc.fillColor(SLATE).fontSize(8).font('Helvetica')
         .text('Dettaglio bonus e malus applicati', MARGIN, y)
      y += 14
      bonusMalusRows.forEach(([label, value]) => {
        y = ensureSpace(doc, y, 'Come è stata calcolata la stima', 24)
        doc.fillColor(SLATE).fontSize(9).font('Helvetica').text(label, MARGIN, y, { width: contentWidth - 150 })
        doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text(value, MARGIN + contentWidth - 150, y, { width: 150, align: 'right' })
        y += 18
      })
      y += 6
    }

    if (data.omi.zonaDiPregio) {
      y = ensureSpace(doc, y, 'Come è stata calcolata la stima', 90)
      y = paragraph(doc, y, describeZonaDiPregioDisclaimer(data.omi), { size: 8.5, color: SLATE })
      y += 6
    }

    doc.fillColor(SLATE).fontSize(8).font('Helvetica')
       .text('Dettaglio prezzo', MARGIN, y)
    y += 14
    // Superficie effettivamente moltiplicata per il prezzo al mq: se sono
    // presenti maggiorazioni (terrazzo/giardino/cantina), è maggiore della
    // sola superficie abitabile dichiarata — mostrarla per intero evita che i
    // conti "a mano" (superficie abitabile × prezzo al mq) non coincidano con
    // il valore stimato finale.
    const superficieAbitabile = data.property.livingArea || 0
    const superficieRiferimento = data.omi.superficieCalcolo && data.omi.superficieCalcolo > 0
      ? data.omi.superficieCalcolo
      : superficieAbitabile
    const maggiorazioneMq = Math.max(0, Math.round((superficieRiferimento - superficieAbitabile) * 10) / 10)

    const priceRows: [string, string][] = [
      ['Prezzo al mq applicato', `${formatEuro(data.valuation.prezzoAlMq)}/mq`],
      ['Superficie abitabile dichiarata', `${superficieAbitabile} mq`],
      ...(maggiorazioneMq > 0
        ? ([
            ['Maggiorazione (terrazzo/giardino/cantina)', `+${maggiorazioneMq} mq`],
            ['Superficie di riferimento per il calcolo', `${Math.round(superficieRiferimento * 10) / 10} mq`]
          ] as [string, string][])
        : []),
      ['Valore stimato', formatEuro(data.valuation.prezzoMedio)]
    ]
    priceRows.forEach(([label, value]) => {
      doc.fillColor(SLATE).fontSize(9).font('Helvetica').text(label, MARGIN, y, { width: contentWidth - 150 })
      doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text(value, MARGIN + contentWidth - 150, y, { width: 150, align: 'right' })
      y += 18
    })

    // ============== PAGINA: FOTO E PLANIMETRIA IMMOBILE (solo se presenti) ==============
    // Regola: tutto ciò che l'utente carica nel wizard deve poter apparire nel
    // report. Se non sono stati caricati file, questa pagina viene saltata
    // interamente (nessun placeholder vuoto/fittizio).
    const userPhotos = data.media?.photos || []
    const userFloorplans = data.media?.floorplans || []
    if (userPhotos.length || userFloorplans.length) {
      doc.addPage()
      y = drawPageFrame(doc, 'Foto e planimetria immobile')
      if (userPhotos.length) {
        y = sectionTitle(doc, y, 'Foto dell\'immobile')
        y = drawImageGrid(doc, y, 'Foto e planimetria immobile', userPhotos)
        y += 10
      }
      if (userFloorplans.length) {
        y = ensureSpace(doc, y, 'Foto e planimetria immobile', 200)
        y = sectionTitle(doc, y, 'Planimetria')
        y = drawImageGrid(doc, y, 'Foto e planimetria immobile', userFloorplans)
      }
    }

    // ================== PAGINA 3: MERCATO OMI + REALADVISOR (con grafici) ==================
    doc.addPage()
    y = drawPageFrame(doc, 'Analisi di mercato')

    if (data.nearbyPoi?.categories?.length) {
      // Stima dell'altezza del blocco PRIMA di iniziare a disegnarlo: con più
      // categorie (ora fino a 11, non più solo 7) il blocco può diventare
      // alto abbastanza da sforare il fondo pagina. Meglio spostare tutto il
      // blocco su una pagina nuova che tagliarlo a metà.
      const maxItemsInAnyCategory = Math.max(1, ...data.nearbyPoi.categories.map((c) => c.items.length))
      const estimatedPoiRows = Math.ceil(data.nearbyPoi.categories.length / 2)
      const estimatedPoiHeight = estimatedPoiRows * (13 + maxItemsInAnyCategory * 12 + 8) + 130
      y = ensureSpace(doc, y, 'Analisi di mercato', estimatedPoiHeight)
      y = sectionTitle(doc, y, 'Punti di interesse nelle vicinanze')
      y = paragraph(doc, y, describePoiVantaggioNarrative(), { size: 9 })
      const colWidth = contentWidth / 2 - 10
      let poiCol = 0
      let poiRowY = y
      let colMaxY = y
      data.nearbyPoi.categories.forEach((cat) => {
        const x = poiCol === 0 ? MARGIN : MARGIN + contentWidth / 2 + 10
        doc.fillColor(INK).fontSize(9).font('Helvetica-Bold').text(cat.label, x, poiRowY, { width: colWidth })
        let itemY = poiRowY + 13
        cat.items.forEach((item) => {
          doc.fillColor(SLATE).fontSize(8.5).font('Helvetica').text(`${item.distanceMeters} m — ${item.name}`, x, itemY, { width: colWidth })
          itemY += 12
        })
        colMaxY = Math.max(colMaxY, itemY)
        poiCol++
        if (poiCol === 2) {
          poiCol = 0
          poiRowY = colMaxY + 8
          colMaxY = poiRowY
        }
      })
      y = (poiCol === 0 ? poiRowY : colMaxY) + 4
      y = chartCaption(doc, y, `Dati di posizione da OpenStreetMap, entro ${data.nearbyPoi.radiusMeters} metri dall'immobile. La copertura può variare da zona a zona: categorie non elencate significano solo che non risulta nulla mappato nel raggio indicato.`)

      const comfortScore = computeComfortScore(data.nearbyPoi)
      if (comfortScore !== null) {
        y = ensureSpace(doc, y, 'Analisi di mercato', 100)
        y += 6
        drawScoreGauge(doc, MARGIN, y, contentWidth, comfortScore, comfortScoreLabel(comfortScore))
        y += 38
        y = chartCaption(doc, y, describeComfortScoreNarrative(comfortScore, data.nearbyPoi))
      }
      y = ensureSpace(doc, y, 'Analisi di mercato', 220)
    }

    if (data.scuole && data.scuole.totale > 0) {
      y = ensureSpace(doc, y, 'Analisi di mercato', 190)
      y = sectionTitle(doc, y, 'Scuole nel comune')
      y = paragraph(doc, y, describeScuoleVantaggioNarrative(), { size: 9 })
      const s = data.scuole
      const scuoleRows: Array<[string, number]> = [
        ['Scuole dell\'infanzia', s.infanzia],
        ['Scuole primarie', s.primaria],
        ['Scuole secondarie di I grado', s.secondaria1Grado],
        ['Scuole secondarie di II grado', s.secondaria2Grado]
      ].filter(([, n]) => n > 0) as Array<[string, number]>
      scuoleRows.forEach(([label, n]) => {
        doc.fillColor(SLATE).fontSize(9).font('Helvetica').text(label, MARGIN, y, { width: contentWidth - 60 })
        doc.fillColor(INK).fontSize(9).font('Helvetica-Bold').text(String(n), MARGIN + contentWidth - 60, y, { width: 60, align: 'right' })
        y += 15
      })
      y += 3
      y = chartCaption(doc, y, `${s.totale} istituti scolastici censiti nel comune di ${s.comune}${s.provincia ? ` (${s.provincia})` : ''} — fonte: Ministero dell'Istruzione, portale Scuola in Chiaro.`)
      y = ensureSpace(doc, y, 'Analisi di mercato', 220)
    }

    if (data.andamentoDemografico && data.andamentoDemografico.serie.length) {
      y = ensureSpace(doc, y, 'Analisi di mercato', 220)
      y = sectionTitle(doc, y, 'Andamento demografico')
      y = paragraph(doc, y, describeDemograficoVantaggioNarrative(), { size: 9 })
      const d = data.andamentoDemografico
      d.serie.forEach((punto) => {
        y = ensureSpace(doc, y, 'Analisi di mercato', 40)
        doc.fillColor(SLATE).fontSize(9).font('Helvetica').text(String(punto.anno), MARGIN, y, { width: contentWidth - 120 })
        doc.fillColor(INK).fontSize(9).font('Helvetica-Bold').text(`${punto.popolazione.toLocaleString('it-IT')} ab.`, MARGIN + contentWidth - 120, y, { width: 120, align: 'right' })
        y += 14
      })
      y += 3
      y = chartCaption(doc, y, describeAndamentoDemograficoNarrative(d))
      y = ensureSpace(doc, y, 'Analisi di mercato', 220)
    }

    if (data.omi.comune) {
      y = sectionTitle(doc, y, 'Dati OMI di riferimento')
      const omiRows: [string, string][] = [
        ['Comune', data.omi.comune || '—'],
        ['Semestre', data.omi.semestre || '—'],
        ['Range OMI', data.omi.minMq && data.omi.maxMq ? `${formatEuro(data.omi.minMq)} — ${formatEuro(data.omi.maxMq)}/mq` : '—']
      ]
      omiRows.forEach(([label, value]) => {
        doc.fillColor(SLATE).fontSize(8).font('Helvetica').text(label.toUpperCase(), MARGIN, y)
        doc.fillColor(INK).fontSize(10).font('Helvetica').text(value, MARGIN + 200, y)
        y += 18
      })
      if (data.omi.minMq && data.omi.maxMq) {
        y += 10
        drawRangeBar(doc, MARGIN, y, contentWidth, data.omi.minMq, (data.omi.minMq + data.omi.maxMq) / 2, data.omi.maxMq)
        y += 55
        y = chartCaption(
          doc, y,
          `Il grafico mostra il range di valore al mq rilevato dall'OMI per questa zona nel semestre ${data.omi.semestre || 'di riferimento'}: il pallino indica il valore medio (${formatEuro((data.omi.minMq + data.omi.maxMq) / 2)}/mq), agli estremi il valore minimo e massimo osservati.`
        )
      }
      y += 8
    }

    if (data.marketData) {
      const md = data.marketData
      const scopeLabel = md.scope === 'via' ? 'della via' : md.scope === 'cap' ? 'della zona' : 'del comune'
      y = ensureSpace(doc, y, 'Analisi di mercato', 220)
      y = sectionTitle(doc, y, `Analisi di mercato ${scopeLabel}`)

      doc.fillColor(SLATE).fontSize(9).font('Helvetica')
         .text(`${md.addressLabel} — aggiornato a ${md.referencePeriod}`, MARGIN, y, { width: contentWidth })
      y += 18

      doc.fillColor(SLATE).fontSize(8).font('Helvetica').text('PREZZO MEDIO AL MQ', MARGIN, y)
      doc.fillColor(ACCENT).fontSize(13).font('Helvetica-Bold').text(`${formatEuro(md.pricePerSqm)}/mq`, MARGIN + 200, y - 2)
      y += 20

      const trendBars = [
        { label: 'Appart. 1 anno', value: md.trend?.appartamenti?.oneYearPct ?? null },
        { label: 'Appart. 4 anni', value: md.trend?.appartamenti?.fourYearPct ?? null },
        { label: 'Case 1 anno', value: md.trend?.case?.oneYearPct ?? null },
        { label: 'Case 4 anni', value: md.trend?.case?.fourYearPct ?? null }
      ]
      y = ensureSpace(doc, y, 'Analisi di mercato', 180)
      doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Andamento dei prezzi', MARGIN, y)
      y += 16
      y = drawTrendChart(doc, MARGIN, y, contentWidth, trendBars)
      y = chartCaption(
        doc, y,
        'Il grafico mostra la variazione percentuale del prezzo medio al mq rispetto a 1 e 4 anni fa, separatamente per appartamenti e case. Barre verdi = prezzi in aumento, barre rosse = prezzi in calo nel periodo indicato.'
      )

      y = ensureSpace(doc, y, 'Analisi di mercato', 100)
      const saleAppt = md.salePrices?.appartamenti
      const saleCase = md.salePrices?.case
      if (saleAppt || saleCase) {
        doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Prezzi mediani di vendita in zona', MARGIN, y)
        y += 14
        if (saleAppt) {
          doc.fillColor(SLATE).fontSize(9).font('Helvetica')
             .text(`Appartamenti: ${formatEuro(saleAppt.medianPrice)} (range ${formatEuro(saleAppt.rangeMin)} — ${formatEuro(saleAppt.rangeMax)})`, MARGIN, y)
          y += 14
        }
        if (saleCase) {
          doc.fillColor(SLATE).fontSize(9).font('Helvetica')
             .text(`Case: ${formatEuro(saleCase.medianPrice)} (range ${formatEuro(saleCase.rangeMin)} — ${formatEuro(saleCase.rangeMax)})`, MARGIN, y)
          y += 14
        }
        y = chartCaption(doc, y, "A differenza del prezzo medio al mq (basato sugli annunci in vendita), questi valori derivano da immobili effettivamente venduti in zona: danno un'indicazione più concreta di quanto il mercato sia disposto a pagare realmente.")
      }

      y = ensureSpace(doc, y, 'Analisi di mercato', 90)
      const rentAppt = md.rentPrices?.appartamenti
      const rentCase = md.rentPrices?.case
      const yields: string[] = []
      if (rentAppt && saleAppt && saleAppt.medianPrice > 0) {
        yields.push(`Appartamenti ~${((rentAppt.medianRent * 12 * 100) / saleAppt.medianPrice).toFixed(1)}%`)
      }
      if (rentCase && saleCase && saleCase.medianPrice > 0) {
        yields.push(`Case ~${((rentCase.medianRent * 12 * 100) / saleCase.medianPrice).toFixed(1)}%`)
      }
      if (yields.length) {
        y += 4
        doc.fillColor(SLATE).fontSize(8).font('Helvetica').text('RENDITA LOCATIVA LORDA STIMATA', MARGIN, y)
        doc.fillColor(INK).fontSize(10).font('Helvetica').text(yields.join(' · '), MARGIN + 200, y)
        y += 20
        y = chartCaption(doc, y, 'La rendita lorda stima quanto potrebbe rendere l\'immobile se affittato, rapportando il canone medio annuo al prezzo medio di vendita in zona: è un indicatore utile per chi valuta un acquisto come investimento.')
      }

      if (md.recentValuations && md.recentValuations.length) {
        y = ensureSpace(doc, y, 'Analisi di mercato', 160)
        doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Valutazioni recenti in zona', MARGIN, y)
        y += 16
        md.recentValuations.forEach((v) => {
          y = ensureSpace(doc, y, 'Analisi di mercato', 40)
          const stanzeLabel = v.stanze ? `${v.stanze} ${v.stanze === 1 ? 'locale' : 'locali'}` : ''
          const riga = `${v.tipo}${stanzeLabel ? ` — ${stanzeLabel}` : ''} — ${v.indirizzo}, ${v.cap} ${v.comune}`
          doc.fillColor(INK).fontSize(9).font('Helvetica').text(riga, MARGIN, y, { width: contentWidth - 130, continued: false })
          doc.fillColor(ACCENT).fontSize(9).font('Helvetica-Bold').text(`${formatEuro(v.prezzoAlMq)}/mq`, MARGIN + contentWidth - 120, y, { width: 120, align: 'right' })
          y += 13
          const articolo = /^(8|11)\b/.test(v.dataValutazione) ? "l'" : 'il '
          doc.fillColor(SLATE).fontSize(7.5).font('Helvetica').text(`Valutato ${articolo}${v.dataValutazione}`, MARGIN, y)
          y += 16
        })
        y = chartCaption(doc, y, "Queste sono valutazioni recenti effettuate dagli utenti su immobili vicini al tuo (non foto reali dell'immobile, ma la posizione e le caratteristiche dichiarate): un ulteriore confronto diretto, oltre alle medie di zona riportate sopra.")
      }

      y = ensureSpace(doc, y, 'Analisi di mercato', 80)
      y = paragraph(doc, y, describeMarketContextNarrative(md), { size: 9 })
    } else {
      y = sectionTitle(doc, y, 'Analisi di mercato della zona')
      y = paragraph(doc, y, describeMarketContextNarrative(null))
    }

    if (data.garage) {
      if (y > doc.page.height - 140) { doc.addPage(); y = drawPageFrame(doc, 'Analisi di mercato') }
      y = sectionTitle(doc, y, 'Valutazione garage/posto auto')
      if (data.garage.disponibile) {
        doc.fillColor(SLATE).fontSize(8).font('Helvetica').text('SUPERFICIE', MARGIN, y)
        doc.fillColor(INK).fontSize(10).font('Helvetica').text(`${data.garage.superficie || 0} mq`, MARGIN + 200, y)
        y += 16
        doc.fillColor(SLATE).fontSize(8).font('Helvetica').text('VALORE STIMATO GARAGE', MARGIN, y)
        doc.fillColor(ACCENT).fontSize(11).font('Helvetica-Bold').text(formatEuro(data.garage.prezzoStimato || 0), MARGIN + 200, y - 1)
        y += 22
        doc.fillColor(SLATE).fontSize(8).font('Helvetica')
           .text('Valore basato sui dati OMI ufficiali per la tipologia "Box", non incluso nella stima dell\'abitazione.', MARGIN, y, { width: contentWidth })
        y += doc.heightOfString('Valore basato sui dati OMI ufficiali per la tipologia "Box", non incluso nella stima dell\'abitazione.', { width: contentWidth }) + 10
      } else {
        doc.fillColor(SLATE).fontSize(9).font('Helvetica')
           .text(data.garage.motivo || 'Valutazione del garage non disponibile per questo comune.', MARGIN, y)
        y += 20
      }
    }

    // --- Sintesi dei prezzi: confronto OMI / comparabili / compravenduti ---
    const omiAvgMq = data.omi.minMq && data.omi.maxMq ? (data.omi.minMq + data.omi.maxMq) / 2 : null
    const comparabiliMq = data.marketData?.pricePerSqm || null
    const isCasaLike = /villa|casa|indipendente/i.test(data.property.type || '')
    const compravendutiSrc = isCasaLike ? data.marketData?.salePrices?.case : data.marketData?.salePrices?.appartamenti
    const compravendutiMq = compravendutiSrc?.pricePerSqm || null

    const synthesisSources: { label: string; value: number }[] = []
    if (omiAvgMq) synthesisSources.push({ label: 'Zona OMI', value: omiAvgMq })
    if (comparabiliMq) synthesisSources.push({ label: 'Comparabili (in vendita)', value: comparabiliMq })
    if (compravendutiMq) synthesisSources.push({ label: 'Compravenduti (venduto)', value: compravendutiMq })

    if (synthesisSources.length >= 2) {
      y = ensureSpace(doc, y, 'Analisi di mercato', 280)
      y = sectionTitle(doc, y, 'Sintesi dei prezzi di zona')
      y = drawComparisonBarChart(
        doc, MARGIN, y, contentWidth,
        synthesisSources.map((s) => ({ ...s, highlight: false }))
      )
      y = chartCaption(doc, y, describePriceSynthesisNarrative(synthesisSources, data.valuation))

      y = ensureSpace(doc, y, 'Analisi di mercato', 90)
      // Box Prezzo minimo / proposto / massimo, in linea con il range di stima calcolato.
      const boxWidth = (contentWidth - 20) / 3
      const priceBoxes: [string, number][] = [
        ['Prezzo min', data.valuation.prezzoMinimo],
        ['Prezzo proposto', data.valuation.prezzoMedio],
        ['Prezzo max', data.valuation.prezzoMassimo]
      ]
      priceBoxes.forEach(([label, value], i) => {
        const bx = MARGIN + i * (boxWidth + 10)
        doc.roundedRect(bx, y, boxWidth, 60, 6).fill(i === 1 ? ACCENT_LIGHT : SLATE_LIGHT)
        doc.fillColor(SLATE).fontSize(8).font('Helvetica').text(label.toUpperCase(), bx + 10, y + 10)
        doc.fillColor(i === 1 ? ACCENT : INK).fontSize(13).font('Helvetica-Bold').text(formatEuro(value), bx + 10, y + 24)
        const mqValue = data.property.livingArea ? Math.round(value / data.property.livingArea) : 0
        doc.fillColor(SLATE).fontSize(7.5).font('Helvetica').text(`${formatEuro(mqValue)}/mq`, bx + 10, y + 42)
      })
      y += 74
    }

    // ============== PAGINA 4: PUNTI DI FORZA/DEBOLEZZA + PROSPETTIVE ==============
    doc.addPage()
    y = drawPageFrame(doc, 'Analisi e prospettive')

    const hasAiText = !!(data.ai?.puntiForza?.length || data.ai?.puntiDebolezza?.length || data.ai?.summary)
    const fallback = hasAiText ? null : generateFallbackStrengthsWeaknesses(data.property)
    const puntiForza = data.ai?.puntiForza?.length ? data.ai.puntiForza : fallback?.strengths || []
    const puntiDebolezza = data.ai?.puntiDebolezza?.length ? data.ai.puntiDebolezza : fallback?.weaknesses || []

    y = sectionTitle(doc, y, 'Punti di forza e di attenzione')

    if (data.ai?.summary) {
      y = paragraph(doc, y, data.ai.summary)
    }

    if (puntiForza.length) {
      doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Punti di forza', MARGIN, y)
      y += 14
      puntiForza.forEach((p) => {
        doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold').text('+', MARGIN + 4, y, { continued: false, width: 12 })
        doc.fillColor(GREEN).fontSize(9).font('Helvetica').text(`${p}`, MARGIN + 18, y, { width: contentWidth - 22 })
        y += doc.heightOfString(`${p}`, { width: contentWidth - 22 }) + 6
      })
      y += 6
    }

    if (puntiDebolezza.length) {
      doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Punti di attenzione', MARGIN, y)
      y += 14
      puntiDebolezza.forEach((p) => {
        doc.fillColor(RED).fontSize(9).font('Helvetica-Bold').text('!', MARGIN + 6, y, { continued: false, width: 8 })
        doc.fillColor(RED).fontSize(9).font('Helvetica').text(`${p}`, MARGIN + 18, y, { width: contentWidth - 22 })
        y += doc.heightOfString(`${p}`, { width: contentWidth - 22 }) + 6
      })
      y += 10
    }

    if (y > doc.page.height - 200) { doc.addPage(); y = drawPageFrame(doc, 'Analisi e prospettive') }

    y = sectionTitle(doc, y, 'Prospettive di vendita future')
    y = paragraph(doc, y, describeFutureOutlookNarrative(data.marketData))

    if (data.ai?.raccomandazioni) {
      doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Raccomandazione', MARGIN, y)
      y += 14
      y = paragraph(doc, y, data.ai.raccomandazioni)
    }

    // ========================= RELAZIONE DI VALUTAZIONE =========================
    // Testo narrativo finale, denso di informazioni concrete tratte dai dati
    // reali della valutazione (non generico): riprende la struttura tipica
    // delle relazioni di valutazione professionali (descrizione immobile,
    // condizioni, contesto di zona, confronto di mercato, posizionamento
    // prezzo, sintesi conclusiva).
    doc.addPage()
    y = drawPageFrame(doc, 'Relazione di valutazione')
    describeRelazioneValutazione(data).forEach((paragrafo) => {
      y = ensureSpace(doc, y, 'Relazione di valutazione', 110)
      y = paragraph(doc, y, paragrafo, { color: INK, size: 9.8 })
    })

    // ========================= PAGINA FINALE: RIEPILOGO =========================
    doc.addPage()
    y = drawPageFrame(doc, 'Riepilogo')

    y = sectionTitle(doc, y, 'Riepilogo della valutazione')
    doc.roundedRect(MARGIN, y, contentWidth, 80, 8).fill(SLATE_LIGHT)
    doc.fillColor(SLATE).fontSize(9).font('Helvetica').text('VALORE STIMATO', MARGIN + 20, y + 16)
    doc.fillColor(ACCENT).fontSize(24).font('Helvetica-Bold').text(formatEuro(data.valuation.prezzoMedio), MARGIN + 20, y + 30)
    doc.fillColor(SLATE).fontSize(9).font('Helvetica')
       .text(`${formatEuro(data.valuation.prezzoAlMq)}/mq su ${data.property.livingArea || 0} mq`, MARGIN + 20, y + 60)
    y += 100

    doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Indirizzo', MARGIN, y)
    doc.fillColor(SLATE).fontSize(9).font('Helvetica').text(data.lead.indirizzo || '—', MARGIN + 200, y - 1, { width: contentWidth - 200 })
    y += 20

    const fonti = ['Banca dati OMI (Osservatorio del Mercato Immobiliare) — Agenzia delle Entrate']
    if (data.marketData) fonti.push('Dati di mercato aggregati da fonti pubbliche del settore immobiliare')
    doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Fonti utilizzate', MARGIN, y)
    y += 14
    fonti.forEach((f) => {
      doc.fillColor(SLATE).fontSize(9).font('Helvetica').text(`•  ${f}`, MARGIN, y, { width: contentWidth })
      y += doc.heightOfString(`•  ${f}`, { width: contentWidth }) + 6
    })
    y += 10

    doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text('Prossimi passi', MARGIN, y)
    y += 14
    y = paragraph(
      doc, y,
      "Questo report è un valido punto di partenza per fissare un prezzo di vendita o di trattativa. Per una stima ancora più precisa, ti consigliamo un sopralluogo con un professionista del settore, che può valutare elementi non desumibili dai soli dati (rifiniture, luminosità reale, rumorosità, stato dell'edificio condominiale)."
    )

    // Disclaimer legale, ripetuto in fondo all'ultima pagina. Resta dentro la
    // card e sopra la fascia del footer (linea + nome studio), per non
    // sovrapporsi visivamente al frame di pagina.
    const disclaimerText =
      'Questo report ha carattere puramente informativo. La valutazione è basata su dati OMI (Osservatorio del Mercato Immobiliare) ' +
      'e algoritmi di stima, integrati laddove disponibile con dati di mercato pubblici aggiuntivi; non sostituisce una perizia ' +
      'professionale. Valuta Facile non si assume responsabilità per decisioni prese sulla base di questo documento.'
    const disclaimerWidth = contentWidth - 20
    const disclaimerTextHeight = doc.heightOfString(disclaimerText, { width: disclaimerWidth, align: 'center' })
    const disclaimerBoxHeight = disclaimerTextHeight + 20
    const footerLineY = doc.page.height - FOOTER_RESERVED
    const disclaimerBoxY = footerLineY - disclaimerBoxHeight - 14
    y = ensureSpace(doc, y, 'Riepilogo', disclaimerBoxHeight + 40)
    doc.roundedRect(MARGIN - 4, disclaimerBoxY, contentWidth + 8, disclaimerBoxHeight, 8).fill(SLATE_LIGHT)
    doc.fillColor(SLATE).fontSize(7).font('Helvetica').text(
      disclaimerText,
      MARGIN + 6, disclaimerBoxY + 10, { width: disclaimerWidth, align: 'center' }
    )

    // --- Numerazione pagine (richiede bufferPages: true) ---
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      if (i === range.start) continue // copertina senza numero pagina
      doc.fillColor(SLATE).fontSize(8).font('Helvetica').text(
        `Pagina ${i - range.start + 1} di ${range.count}`,
        MARGIN, doc.page.height - FOOTER_RESERVED + 10,
        { width: contentWidth - 210, align: 'left' }
      )
    }

    doc.end()
  })
}
