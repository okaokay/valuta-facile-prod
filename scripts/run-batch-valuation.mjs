import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { getRealOmiValues } from '../src/services/realOmiService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_PATH = path.join(__dirname, '..', 'valutazioni-batch-italia.md')

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const STREET_NAMES = [
  'Via Garibaldi',
  'Via Roma',
  'Corso Italia',
  'Via Dante Alighieri',
  'Via Verdi',
  'Via Manzoni',
  'Via Mazzini',
  'Via Cavour',
  'Via Vittorio Veneto',
  'Via delle Rose',
  'Via dei Tigli',
  'Via Nazionale',
  'Via Torino',
  'Via Firenze',
  'Via Milano',
  'Via Napoli',
  'Via Trieste',
  'Via Venezia',
  'Via Pirandello',
  'Via Leopardi'
]

const PROPERTY_TYPES = ['Appartamento', 'Attico', 'Villetta a schiera', 'Villa']
const CONDITIONS = ['Nuovo', 'Buono', 'Da ristrutturare']

function loadCapComuneUniverse() {
  const dbPath = path.join(__dirname, '..', 'data', 'omi_official.sqlite')
  const db = new Database(dbPath, { readonly: true })
  const rows = db
    .prepare(`
      SELECT
        cp.cap as cap,
        c.denominazione_comune as comune,
        p.sigla_provincia as sigla_provincia,
        p.denominazione_provincia as provincia,
        r.denominazione_regione as regione
      FROM cap cp
      JOIN cap_comune cc ON cc.cap_id = cp.id
      JOIN comuni c ON c.id = cc.comune_id
      JOIN province p ON p.id = c.id_provincia
      JOIN regioni r ON r.id = p.id_regione
    `)
    .all()
  db.close()
  return rows
}

function pickRandomCapWithInfo(pool) {
  const index = randomInt(0, pool.length - 1)
  const row = pool[index]
  return {
    cap: row.cap,
    comune: row.comune,
    provincia: row.provincia,
    regione: row.regione
  }
}

async function run() {
  const total = 2000
  const results = []
  const capUniverse = loadCapComuneUniverse()

  for (let i = 0; i < total; i += 1) {
    const { cap, comune, provincia, regione } = pickRandomCapWithInfo(
      capUniverse
    )
    const omi = await getRealOmiValues(cap)

    const superficie = randomInt(40, 180)
    const piano = randomInt(0, 7)
    const rooms = randomInt(1, 6)
    const bathrooms = randomInt(1, 3)
    const condition =
      CONDITIONS[randomInt(0, CONDITIONS.length - 1)]
    const hasElevator = piano > 3 ? Math.random() < 0.7 : Math.random() < 0.3
    const yearBuilt = randomInt(1960, 2023)
    const propertyType =
      PROPERTY_TYPES[randomInt(0, PROPERTY_TYPES.length - 1)]

    const street =
      STREET_NAMES[randomInt(0, STREET_NAMES.length - 1)]
    const houseNumber = randomInt(1, 220)

    const displayAddress = `${street} ${houseNumber}, ${cap} ${comune} (${provincia}), ${regione}`

    const prezzoAlMetroQuadro = Math.round(omi.avg)
    const prezzoMedio = Math.round(prezzoAlMetroQuadro * superficie)
    const prezzoMinimo = Math.round(prezzoMedio * 0.85)
    const prezzoMassimo = Math.round(prezzoMedio * 1.15)

    results.push({
      index: i + 1,
      cap,
      comune,
      provincia,
      regione,
      street,
      houseNumber,
      fullAddress: displayAddress,
      superficie,
      propertyType,
      condition,
      piano,
      hasElevator,
      rooms,
      bathrooms,
      yearBuilt,
      prezzoAlMetroQuadro,
      prezzoMinimo,
      prezzoMedio,
      prezzoMassimo,
      reliability: omi.reliability || 'UNKNOWN'
    })
  }

  let md = ''
  md += '# Batch test valutazioni Italia\n\n'
  md += `Totale valutazioni generate: ${results.length}\n\n`
  md +=
    '| # | Indirizzo completo | Via | Civico | CAP | Comune | Provincia | Regione | Tipo immobile | Condizione | Piano | Ascensore | Locali | Bagni | Anno costruzione | Mq | €/mq | Prezzo min | Prezzo medio | Prezzo max | Affidabilità OMI |\n'
  md +=
    '|---|-------------------|-----|--------|-----|--------|-----------|---------|---------------|------------|-------|-----------|--------|-------|------------------|----|------|-----------|-------------|-----------|------------------|\n'

  for (const r of results) {
    md += `| ${r.index} | ${r.fullAddress} | ${r.street} | ${r.houseNumber} | ${r.cap} | ${r.comune} | ${r.provincia} | ${r.regione} | ${r.propertyType} | ${r.condition} | ${r.piano} | ${r.hasElevator ? 'Sì' : 'No'} | ${r.rooms} | ${r.bathrooms} | ${r.yearBuilt} | ${r.superficie} | ${r.prezzoAlMetroQuadro} | ${r.prezzoMinimo} | ${r.prezzoMedio} | ${r.prezzoMassimo} | ${r.reliability} |\n`
  }

  fs.writeFileSync(OUTPUT_PATH, md, 'utf8')
  console.log(
    `Creato file markdown con ${results.length} valutazioni in ${OUTPUT_PATH}`
  )
}

run().catch((err) => {
  console.error('Errore durante il batch test delle valutazioni:', err)
  process.exit(1)
})
