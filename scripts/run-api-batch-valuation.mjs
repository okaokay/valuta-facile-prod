import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import axios from 'axios'
import Database from 'better-sqlite3'
import { getRealOmiValues } from '../src/services/realOmiService.js'
import { mapUiCategoryToOmi } from '../server/services/omiCategoryMapping.js'
import {
  insertLead,
  insertMediaRecords,
  insertAiAnalysis
} from '../server/db.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'valutazioni-batch-api-italia.md'
)

const CSV_OUTPUT_STRICT = path.join(
  __dirname,
  '..',
  'valutazioni-batch-api-italia-strict.csv'
)
const CSV_OUTPUT_FALLBACK = path.join(
  __dirname,
  '..',
  'valutazioni-batch-api-italia-fallback.csv'
)
const CSV_OUTPUT_FULL = path.join(
  __dirname,
  '..',
  'valutazioni-batch-api-italia-full-data.csv'
)

const API_BASE_URL = (
  process.env.BATCH_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  'http://localhost:4001/api'
).replace(/\/+$/, '')

const CREATE_TEST_LEAD =
  process.env.BATCH_CREATE_TEST_LEAD === '1' ||
  process.env.BATCH_CREATE_TEST_LEAD === 'true'

console.log('API_BASE_URL batch:', API_BASE_URL)

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

const FULL_DATA_CASES = [
  {
    label: 'Bilocale centro storico',
    cap: '00184',
    comune: 'Roma',
    provincia: 'Roma',
    sigla_provincia: 'RM',
    regione: 'Lazio',
    street: 'Via Cavour',
    houseNumber: 15,
    lat: 41.8948,
    lon: 12.4942,
    propertyType: 'Appartamento',
    superficie: 55,
    piano: 3,
    rooms: 2,
    bathrooms: 1,
    condition: 'Buono',
    hasElevator: true,
    yearBuilt: 1975
  },
  {
    label: 'Trilocale semicentrale',
    cap: '20131',
    comune: 'Milano',
    provincia: 'Milano',
    sigla_provincia: 'MI',
    regione: 'Lombardia',
    street: 'Via Pacini',
    houseNumber: 40,
    lat: 45.4854,
    lon: 9.2269,
    propertyType: 'Appartamento',
    superficie: 80,
    piano: 4,
    rooms: 3,
    bathrooms: 2,
    condition: 'Nuovo',
    hasElevator: true,
    yearBuilt: 2015
  },
  {
    label: 'Quadrilocale periferia',
    cap: '80147',
    comune: 'Napoli',
    provincia: 'Napoli',
    sigla_provincia: 'NA',
    regione: 'Campania',
    street: 'Via Argine',
    houseNumber: 310,
    lat: 40.8575,
    lon: 14.2937,
    propertyType: 'Appartamento',
    superficie: 100,
    piano: 2,
    rooms: 4,
    bathrooms: 2,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1985
  },
  {
    label: 'Villetta indipendente',
    cap: '07026',
    comune: 'Olbia',
    provincia: 'Sassari',
    sigla_provincia: 'SS',
    regione: 'Sardegna',
    street: 'Via Vittorio Veneto',
    houseNumber: 120,
    lat: 40.9239,
    lon: 9.4995,
    propertyType: 'Villa',
    superficie: 160,
    piano: 1,
    rooms: 5,
    bathrooms: 3,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 2000
  },
  {
    label: 'Attico vista mare',
    cap: '16165',
    comune: 'Genova',
    provincia: 'Genova',
    sigla_provincia: 'GE',
    regione: 'Liguria',
    street: 'Corso Europa',
    houseNumber: 800,
    lat: 44.4207,
    lon: 8.9772,
    propertyType: 'Attico',
    superficie: 120,
    piano: 7,
    rooms: 4,
    bathrooms: 2,
    condition: 'Nuovo',
    hasElevator: true,
    yearBuilt: 2018
  }
]

const SAME_CAP_71010_CASES = [
  {
    label: '71010 Poggio Imperiale',
    cap: '71010',
    comune: 'Poggio Imperiale',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Roma',
    houseNumber: 10,
    propertyType: 'Appartamento',
    superficie: 80,
    piano: 2,
    rooms: 3,
    bathrooms: 1,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1980,
    lat: null,
    lon: null
  },
  {
    label: '71010 Lesina',
    cap: '71010',
    comune: 'Lesina',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Garibaldi',
    houseNumber: 22,
    propertyType: 'Appartamento',
    superficie: 70,
    piano: 1,
    rooms: 3,
    bathrooms: 1,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1975,
    lat: null,
    lon: null
  },
  {
    label: '71010 Serracapriola',
    cap: '71010',
    comune: 'Serracapriola',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Manzoni',
    houseNumber: 5,
    propertyType: 'Appartamento',
    superficie: 90,
    piano: 3,
    rooms: 4,
    bathrooms: 2,
    condition: 'Buono',
    hasElevator: true,
    yearBuilt: 1990,
    lat: null,
    lon: null
  },
  {
    label: '71010 Cagnano Varano',
    cap: '71010',
    comune: 'Cagnano Varano',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Vittorio Veneto',
    houseNumber: 30,
    propertyType: 'Appartamento',
    superficie: 85,
    piano: 2,
    rooms: 4,
    bathrooms: 2,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1985,
    lat: null,
    lon: null
  },
  {
    label: '71010 Carpino',
    cap: '71010',
    comune: 'Carpino',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Dante Alighieri',
    houseNumber: 8,
    propertyType: 'Appartamento',
    superficie: 75,
    piano: 1,
    rooms: 3,
    bathrooms: 1,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1978,
    lat: null,
    lon: null
  }
]

const SAME_COMUNE_POGGIO_CASES = [
  {
    label: 'Poggio Imperiale 1',
    cap: '71010',
    comune: 'Poggio Imperiale',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Roma',
    houseNumber: 10,
    propertyType: 'Appartamento',
    superficie: 75,
    piano: 1,
    rooms: 3,
    bathrooms: 1,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1975,
    lat: null,
    lon: null
  },
  {
    label: 'Poggio Imperiale 2',
    cap: '71010',
    comune: 'Poggio Imperiale',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Garibaldi',
    houseNumber: 22,
    propertyType: 'Appartamento',
    superficie: 80,
    piano: 2,
    rooms: 3,
    bathrooms: 1,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1980,
    lat: null,
    lon: null
  },
  {
    label: 'Poggio Imperiale 3',
    cap: '71010',
    comune: 'Poggio Imperiale',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Manzoni',
    houseNumber: 5,
    propertyType: 'Appartamento',
    superficie: 85,
    piano: 3,
    rooms: 4,
    bathrooms: 2,
    condition: 'Buono',
    hasElevator: true,
    yearBuilt: 1985,
    lat: null,
    lon: null
  },
  {
    label: 'Poggio Imperiale 4',
    cap: '71010',
    comune: 'Poggio Imperiale',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Vittorio Veneto',
    houseNumber: 30,
    propertyType: 'Appartamento',
    superficie: 90,
    piano: 2,
    rooms: 4,
    bathrooms: 2,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1990,
    lat: null,
    lon: null
  },
  {
    label: 'Poggio Imperiale 5',
    cap: '71010',
    comune: 'Poggio Imperiale',
    provincia: 'Foggia',
    sigla_provincia: 'FG',
    regione: 'Puglia',
    street: 'Via Dante Alighieri',
    houseNumber: 8,
    propertyType: 'Appartamento',
    superficie: 70,
    piano: 1,
    rooms: 3,
    bathrooms: 1,
    condition: 'Buono',
    hasElevator: false,
    yearBuilt: 1978,
    lat: null,
    lon: null
  }
]

function openOfficialDb() {
  const envPath = process.env.OMI_DB_PATH
  const dbPath =
    envPath && envPath.endsWith('.sqlite')
      ? envPath
      : path.join(__dirname, '..', 'data', 'omi_official.sqlite')
  return new Database(dbPath, { readonly: true })
}

function loadCapComuneUniverse(db) {
  const localDb = db || openOfficialDb()
  const rows = localDb
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
  if (!db) {
    localDb.close()
  }
  return rows
}

function pickRandomCapComune(pool) {
  const index = randomInt(0, pool.length - 1)
  const row = pool[index]
  return {
    cap: row.cap,
    comune: row.comune,
    provincia: row.provincia,
    sigla_provincia: row.sigla_provincia,
    regione: row.regione
  }
}

function createOfficialHelpers(db) {
  const latestActiveSemesterStmt = db.prepare(`
    SELECT codice_semestre
    FROM omi_semesters
    WHERE is_active = 1
    ORDER BY anno DESC, semestre DESC
    LIMIT 1
  `)
  const latestSemesterStmt = db.prepare(`
    SELECT codice_semestre
    FROM omi_semesters
    ORDER BY anno DESC, semestre DESC
    LIMIT 1
  `)
  const comuniByCapStmt = db.prepare(`
    SELECT
      cp.cap as cap,
      c.id as comune_id,
      c.denominazione_comune,
      p.sigla_provincia,
      p.denominazione_provincia,
      r.denominazione_regione
    FROM cap cp
    JOIN cap_comune cc ON cc.cap_id = cp.id
    JOIN comuni c ON c.id = cc.comune_id
    JOIN province p ON p.id = c.id_provincia
    JOIN regioni r ON r.id = p.id_regione
    WHERE cp.cap = @cap
  `)
  const rangeStmt = db.prepare(`
    SELECT
      MIN(v.min_eur_mq) as min_comune_eur_mq,
      MAX(v.max_eur_mq) as max_comune_eur_mq,
      COUNT(DISTINCT z.id) as zone_count_used
    FROM omi_zones z
    JOIN omi_values v ON v.id_zone = z.id
    JOIN omi_semesters s ON s.id = z.id_semestre
    WHERE z.id_comune = @id_comune
      AND s.codice_semestre = @codice_semestre
      AND v.descr_tipologia = @descr_tipologia COLLATE NOCASE
  `)

  function getLatestSemesterCode() {
    const active = latestActiveSemesterStmt.get()
    if (active && active.codice_semestre) return active.codice_semestre
    const any = latestSemesterStmt.get()
    return any && any.codice_semestre ? any.codice_semestre : null
  }

  function getComuneRangeByUiTypology({ cap, uiTypology }) {
    if (!cap || !uiTypology) return null
    const normalizedCap = String(cap).padStart(5, '0')
    const comuni = comuniByCapStmt.all({ cap: normalizedCap })
    if (!comuni || comuni.length === 0) return null
    const comune = comuni[0]
    const semestreCode = getLatestSemesterCode()
    if (!semestreCode) return null
    const descr_tipologia = mapUiCategoryToOmi(uiTypology)
    if (!descr_tipologia) return null

    const params = {
      id_comune: comune.comune_id,
      codice_semestre: semestreCode,
      descr_tipologia
    }

    const rangeRow = rangeStmt.get(params)
    if (!rangeRow || !rangeRow.zone_count_used) return null

    return {
      min_comune_eur_mq: rangeRow.min_comune_eur_mq,
      max_comune_eur_mq: rangeRow.max_comune_eur_mq,
      zone_count_used: rangeRow.zone_count_used,
      descr_tipologia,
      semestre_code: semestreCode
    }
  }

  return {
    getLatestSemesterCode,
    getComuneRangeByUiTypology
  }
}

async function buildTestCase(capPool, options = {}) {
  const { useOfficialExpected = false, officialHelpers = null } = options
  const { cap, comune, provincia, sigla_provincia, regione } =
    pickRandomCapComune(capPool)
  const propertyType =
    PROPERTY_TYPES[randomInt(0, PROPERTY_TYPES.length - 1)]
  let expectedFrom = null
  let baseAvg = null

  if (useOfficialExpected && officialHelpers) {
    const range = officialHelpers.getComuneRangeByUiTypology({
      cap,
      uiTypology: propertyType
    })
    if (range && range.min_comune_eur_mq != null && range.max_comune_eur_mq != null) {
      baseAvg = (range.min_comune_eur_mq + range.max_comune_eur_mq) / 2
      expectedFrom = 'official'
    }
  }

  if (baseAvg == null) {
    const omi = await getRealOmiValues(cap)
    baseAvg = omi && typeof omi.avg === 'number' ? omi.avg : 2000
    expectedFrom = 'synthetic'
  }

  const superficie = randomInt(40, 180)
  const piano = randomInt(0, 7)
  const rooms = randomInt(1, 6)
  const bathrooms = randomInt(1, 3)
  const condition = CONDITIONS[randomInt(0, CONDITIONS.length - 1)]
  const hasElevator = piano > 3 ? Math.random() < 0.7 : Math.random() < 0.3
  const yearBuilt = randomInt(1960, 2023)

  const street = STREET_NAMES[randomInt(0, STREET_NAMES.length - 1)]
  const houseNumber = randomInt(1, 220)
  const displayAddress = `${street} ${houseNumber}, ${cap} ${comune} (${provincia}), ${regione}`

  const expectedPrezzoAlMetroQuadro = Math.round(baseAvg)
  const expectedPrezzoMedio = Math.round(
    expectedPrezzoAlMetroQuadro * superficie
  )
  const expectedPrezzoMinimo = Math.round(expectedPrezzoMedio * 0.85)
  const expectedPrezzoMassimo = Math.round(expectedPrezzoMedio * 1.15)

  const address = {
    display: displayAddress,
    street,
    housenumber: String(houseNumber),
    city: comune,
    state: regione,
    province: sigla_provincia,
    postcode: cap,
    country: 'Italia',
    lat: null,
    lon: null,
    source: 'batch-api-test'
  }

  const property = {
    livingArea: superficie,
    balconyArea: 0,
    terraceArea: 0,
    verandaArea: 0,
    loftArea: 0,
    atticArea: 0,
    basementArea: 0,
    gardenArea: 0,
    rooftopArea: 0,
    condition,
    floor: piano,
    hasElevator,
    rooms,
    bathrooms,
    yearBuilt
  }

  return {
    meta: {
      cap,
      comune,
      provincia,
      sigla_provincia,
      regione,
      street,
      houseNumber,
      fullAddress: displayAddress,
      propertyType,
      condition,
      piano,
      hasElevator,
      rooms,
      bathrooms,
      yearBuilt,
      superficie,
      expectedFrom
    },
    address,
    property,
    expected: {
      prezzoAlMetroQuadro: expectedPrezzoAlMetroQuadro,
      prezzoMinimo: expectedPrezzoMinimo,
      prezzoMedio: expectedPrezzoMedio,
      prezzoMassimo: expectedPrezzoMassimo
    }
  }
}

async function buildDeterministicTestCase(caseDef, options = {}) {
  const { useOfficialExpected = false, officialHelpers = null } = options
  const {
    label,
    cap,
    comune,
    provincia,
    sigla_provincia,
    regione,
    street,
    houseNumber,
    propertyType,
    superficie,
    piano,
    rooms,
    bathrooms,
    condition,
    hasElevator,
    yearBuilt,
    lat,
    lon
  } = caseDef

  const effectivePropertyType = propertyType || 'Appartamento'

  let expectedFrom = null
  let baseAvg = null

  if (useOfficialExpected && officialHelpers) {
    const range = officialHelpers.getComuneRangeByUiTypology({
      cap,
      uiTypology: effectivePropertyType
    })
    if (range && range.min_comune_eur_mq != null && range.max_comune_eur_mq != null) {
      baseAvg = (range.min_comune_eur_mq + range.max_comune_eur_mq) / 2
      expectedFrom = 'official'
    }
  }

  if (baseAvg == null) {
    const omi = await getRealOmiValues(cap)
    baseAvg = omi && typeof omi.avg === 'number' ? omi.avg : 2000
    expectedFrom = 'synthetic'
  }

  const displayAddress = `${street} ${houseNumber}, ${cap} ${comune} (${provincia}), ${regione}`

  const expectedPrezzoAlMetroQuadro = Math.round(baseAvg)
  const expectedPrezzoMedio = Math.round(
    expectedPrezzoAlMetroQuadro * superficie
  )
  const expectedPrezzoMinimo = Math.round(expectedPrezzoMedio * 0.85)
  const expectedPrezzoMassimo = Math.round(expectedPrezzoMedio * 1.15)

  const address = {
    display: displayAddress,
    street,
    housenumber: String(houseNumber),
    city: comune,
    state: regione,
    province: sigla_provincia,
    postcode: cap,
    country: 'Italia',
    lat,
    lon,
    source: 'batch-api-test-full-data'
  }

  const property = {
    livingArea: superficie,
    balconyArea: 10,
    terraceArea: 15,
    verandaArea: 5,
    loftArea: 0,
    atticArea: 0,
    basementArea: 20,
    gardenArea: 50,
    rooftopArea: 0,
    condition,
    floor: piano,
    hasElevator,
    rooms,
    bathrooms,
    yearBuilt,
    propertyType: effectivePropertyType
  }

  return {
    meta: {
      label: label || null,
      cap,
      comune,
      provincia,
      sigla_provincia,
      regione,
      street,
      houseNumber,
      fullAddress: displayAddress,
      propertyType: effectivePropertyType,
      condition,
      piano,
      hasElevator,
      rooms,
      bathrooms,
      yearBuilt,
      superficie,
      expectedFrom
    },
    address,
    property,
    expected: {
      prezzoAlMetroQuadro: expectedPrezzoAlMetroQuadro,
      prezzoMinimo: expectedPrezzoMinimo,
      prezzoMedio: expectedPrezzoMedio,
      prezzoMassimo: expectedPrezzoMassimo
    }
  }
}

async function callEnhancedOmi(address, property, options = {}) {
  const fallbackMode = options.fallbackMode || null
  const officialModeStrict = options.officialModeStrict === true
  const params = []
  if (officialModeStrict) {
    params.push('officialModeStrict=1')
  }
  if (fallbackMode) {
    params.push(`fallback=${encodeURIComponent(fallbackMode)}`)
  }
  const queryString = params.length ? `?${params.join('&')}` : ''
  const url = `${API_BASE_URL}/valuation/enhanced-omi${queryString}`
  const response = await axios.post(
    url,
    {
      address,
      property
    },
    {
      timeout: 15000,
      validateStatus() {
        return true
      }
    }
  )
  return response.data
}

async function runScenario({ label, total, fallbackMode, officialModeStrict, useOfficialExpected, capUniverse, officialHelpers }) {
  const results = []
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < total; i += 1) {
    try {
      const testCase = await buildTestCase(capUniverse, {
        useOfficialExpected,
        officialHelpers
      })
      const apiData = await callEnhancedOmi(
        testCase.address,
        testCase.property,
        { fallbackMode, officialModeStrict }
      )

      const apiVal = apiData && apiData.valutazione ? apiData.valutazione : null

      const apiPrezzoMedio =
        apiVal && typeof apiVal.prezzoMedio === 'number'
          ? apiVal.prezzoMedio
          : null

      const deltaEuro =
        apiPrezzoMedio != null
          ? apiPrezzoMedio - testCase.expected.prezzoMedio
          : null

      const deltaPercent =
        apiPrezzoMedio != null && testCase.expected.prezzoMedio
          ? (deltaEuro / testCase.expected.prezzoMedio) * 100
          : null

      const metadati = apiData && apiData.metadati ? apiData.metadati : {}
      const omi = apiData && apiData.omiData ? apiData.omiData : null
      const numComuniForCap = metadati.numComuniForCap ?? null
      const capStatus = metadati.capStatus || null
      const zoneCountUsed = omi && typeof omi.zone_count_used === 'number'
        ? omi.zone_count_used
        : null
      const semestre = omi && omi.semestre ? omi.semestre : null
      const descrTipologia = omi && omi.tipologia ? omi.tipologia : null
      const sources = Array.isArray(omi && omi.sources) ? omi.sources : []
      const sourcesCount = sources.length
      const sourceExamplePath =
        sourcesCount > 0 && sources[0].path_relativo
          ? sources[0].path_relativo
          : null

      const apiSource = apiData ? apiData.source || null : null
      const classification = apiSource || 'unknown'
      const fallbackReason = metadati.fallbackReason || null

      results.push({
        index: i + 1,
        ...testCase.meta,
        expected: testCase.expected,
        api: apiVal,
        omiData: omi,
        metadatiLimitazioni:
          Array.isArray(metadati.limitazioni) && metadati.limitazioni.length
            ? metadati.limitazioni
            : [],
        fallbackReason,
        apiSource,
        classification,
        numComuniForCap,
        zoneCountUsed,
        semestre,
        descrTipologia,
        sourcesCount,
        sourceExamplePath,
        deltaEuro,
        deltaPercent,
        error: null
      })
      successCount += 1
    } catch (err) {
      console.error(
        'Errore durante il test case batch API:',
        err && err.message ? err.message : err,
        err && err.response && err.response.status
          ? `status=${err.response.status}`
          : null,
        err && err.response && err.response.data ? err.response.data : null
      )
      const baseMessage =
        err && err.message ? err.message : String(err)
      const statusSuffix =
        err && err.response && err.response.status
          ? ` (status ${err.response.status})`
          : ''
      results.push({
        index: i + 1,
        error: `${baseMessage}${statusSuffix}`
      })
      errorCount += 1
    }
  }

  const scenario = {
    label,
    total,
    successCount,
    errorCount,
    results
  }

  return scenario
}

async function runDeterministicScenario({ label, fallbackMode, officialModeStrict, useOfficialExpected, officialHelpers }) {
  const results = []
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < FULL_DATA_CASES.length; i += 1) {
    const caseDef = FULL_DATA_CASES[i]
    try {
      const testCase = await buildDeterministicTestCase(caseDef, {
        useOfficialExpected,
        officialHelpers
      })
      const apiData = await callEnhancedOmi(
        testCase.address,
        testCase.property,
        { fallbackMode, officialModeStrict }
      )

      const apiVal = apiData && apiData.valutazione ? apiData.valutazione : null

      const apiPrezzoMedio =
        apiVal && typeof apiVal.prezzoMedio === 'number'
          ? apiVal.prezzoMedio
          : null

      const deltaEuro =
        apiPrezzoMedio != null
          ? apiPrezzoMedio - testCase.expected.prezzoMedio
          : null

      const deltaPercent =
        apiPrezzoMedio != null && testCase.expected.prezzoMedio
          ? (deltaEuro / testCase.expected.prezzoMedio) * 100
          : null

      const metadati = apiData && apiData.metadati ? apiData.metadati : {}
      const omi = apiData && apiData.omiData ? apiData.omiData : null
      const numComuniForCap = metadati.numComuniForCap ?? null
      const capStatus = metadati.capStatus || null
      const zoneCountUsed = omi && typeof omi.zone_count_used === 'number'
        ? omi.zone_count_used
        : null
      const semestre = omi && omi.semestre ? omi.semestre : null
      const descrTipologia = omi && omi.tipologia ? omi.tipologia : null
      const sources = Array.isArray(omi && omi.sources) ? omi.sources : []
      const sourcesCount = sources.length
      const sourceExamplePath =
        sourcesCount > 0 && sources[0].path_relativo
          ? sources[0].path_relativo
          : null

      const apiSource = apiData ? apiData.source || null : null
      const classification = apiSource || 'unknown'
      const fallbackReason = metadati.fallbackReason || null

      results.push({
        index: i + 1,
        ...testCase.meta,
        expected: testCase.expected,
        api: apiVal,
        omiData: omi,
        metadatiLimitazioni:
          Array.isArray(metadati.limitazioni) && metadati.limitazioni.length
            ? metadati.limitazioni
            : [],
        fallbackReason,
        apiSource,
        classification,
        numComuniForCap,
        zoneCountUsed,
        semestre,
        descrTipologia,
        sourcesCount,
        sourceExamplePath,
        deltaEuro,
        deltaPercent,
        error: null
      })
      successCount += 1
    } catch (err) {
      console.error(
        'Errore durante il test case batch API full-data:',
        caseDef && caseDef.label ? caseDef.label : null,
        err && err.message ? err.message : err,
        err && err.response && err.response.status
          ? `status=${err.response.status}`
          : null,
        err && err.response && err.response.data ? err.response.data : null
      )
      const baseMessage =
        err && err.message ? err.message : String(err)
      const statusSuffix =
        err && err.response && err.response.status
          ? ` (status ${err.response.status})`
          : ''
      results.push({
        index: i + 1,
        label: caseDef && caseDef.label ? caseDef.label : null,
        error: `${baseMessage}${statusSuffix}`
      })
      errorCount += 1
    }
  }

  const scenario = {
    label,
    total: FULL_DATA_CASES.length,
    successCount,
    errorCount,
    results
  }

  return scenario
}

function renderScenarioMarkdown(scenario) {
  const { label, total, successCount, errorCount, results } = scenario

  let md = ''
  md += `## Scenario: ${label}\n\n`
  md += `Totale casi: ${total}\n\n`
  md += `Successi: ${successCount}\n\n`
  md += `Errori: ${errorCount}\n\n`

  md +=
    '| # | Indirizzo completo | CAP | Comune | Provincia | Regione | Tipo immobile | Condizione | Piano | Ascensore | Locali | Bagni | Anno | Mq | €/mq atteso | Prezzo medio atteso | Prezzo medio API | Prezzo minimo API | Prezzo massimo API | Delta € | Delta % | Affidabilità OMI | Sorgente API | Classificazione | num_comuni_for_cap | zone_count_used | semestre | descr_tipologia | omi_min_eur_mq | omi_max_eur_mq | omi_avg_eur_mq | sources_count | aggregation_level | source_example_path | limitazioni | fallback_reason | Errore |\n'
  md +=
    '|---|-------------------|-----|--------|-----------|---------|---------------|------------|-------|-----------|--------|-------|------|----|-------------|----------------------|------------------|-------------------|--------------------|---------|---------|------------------|-------------|--------------------|--------------------|----------------|----------|----------------|----------------|----------------|----------------|--------------|-------------------|----------------------|------------|----------------|--------|\n'

  for (const r of results) {
    if (r.error) {
      md += `| ${r.index} |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ${r.error} |\n`
      continue
    }

    const ascensore = r.hasElevator ? 'Sì' : 'No'
    const deltaEuroStr =
      r.deltaEuro != null ? Math.round(r.deltaEuro).toString() : ''
    const deltaPercentStr =
      r.deltaPercent != null ? `${r.deltaPercent.toFixed(2)}` : ''

    const omiMin = r.omiData && typeof r.omiData.min === 'number'
      ? r.omiData.min
      : ''
    const omiMax = r.omiData && typeof r.omiData.max === 'number'
      ? r.omiData.max
      : ''
    const omiAvg = r.omiData && typeof r.omiData.avg === 'number'
      ? r.omiData.avg
      : ''
    let aggregationLevel = ''
    if (r.omiData && r.omiData.aggregation_level) {
      aggregationLevel = r.omiData.aggregation_level
    } else if (r.apiSource === 'omi-ufficiale-comunale') {
      aggregationLevel = 'COMUNE'
    } else if (r.apiSource === 'real-omi-cap-fallback') {
      aggregationLevel = 'CAP'
    } else if (r.apiSource === 'enhanced-omi-ai') {
      aggregationLevel = 'AI'
    }
    const limitazioniStr =
      r.metadatiLimitazioni && r.metadatiLimitazioni.length
        ? r.metadatiLimitazioni.join('; ')
        : ''

    md += `| ${r.index} | ${r.fullAddress} | ${r.cap} | ${r.comune} | ${r.provincia} | ${r.regione} | ${r.propertyType} | ${r.condition} | ${r.piano} | ${ascensore} | ${r.rooms} | ${r.bathrooms} | ${r.yearBuilt} | ${r.superficie} | ${r.expected.prezzoAlMetroQuadro} | ${r.expected.prezzoMedio} | ${r.api && typeof r.api.prezzoMedio === 'number' ? r.api.prezzoMedio : ''} | ${r.api && typeof r.api.prezzoMinimo === 'number' ? r.api.prezzoMinimo : ''} | ${r.api && typeof r.api.prezzoMassimo === 'number' ? r.api.prezzoMassimo : ''} | ${deltaEuroStr} | ${deltaPercentStr} | ${r.reliability} | ${r.apiSource || ''} | ${r.classification} | ${r.numComuniForCap != null ? r.numComuniForCap : ''} | ${r.zoneCountUsed != null ? r.zoneCountUsed : ''} | ${r.semestre || ''} | ${r.descrTipologia || ''} | ${omiMin} | ${omiMax} | ${omiAvg} | ${r.sourcesCount != null ? r.sourcesCount : ''} | ${aggregationLevel} | ${r.sourceExamplePath || ''} | ${limitazioniStr} | ${r.fallbackReason || ''} |  |\n`
  }

  return md
}

function escapeCsvValue(value) {
  if (value == null) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function writeScenarioCsv(scenario, csvPath) {
  const { results } = scenario
  const header = [
    'index',
    'label',
    'full_address',
    'cap',
    'comune',
    'provincia',
    'regione',
    'property_type',
    'condition',
    'piano',
    'has_elevator',
    'rooms',
    'bathrooms',
    'year_built',
    'superficie',
    'expected_prezzo_medio',
    'api_prezzo_medio',
    'api_prezzo_minimo',
    'api_prezzo_massimo',
    'delta_euro',
    'delta_percent',
    'api_source',
    'classification',
    'num_comuni_for_cap',
    'zone_count_used',
    'semestre',
    'descr_tipologia',
    'omi_min_eur_mq',
    'omi_max_eur_mq',
    'omi_avg_eur_mq',
    'fallback_reason',
    'error'
  ]

  const lines = [header.join(',')]

  for (const r of results) {
    if (r.error) {
      const row = [
        r.index,
        r.label || '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        r.error
      ].map(escapeCsvValue)
      lines.push(row.join(','))
      continue
    }

    const omiMin =
      r.omiData && typeof r.omiData.min === 'number' ? r.omiData.min : ''
    const omiMax =
      r.omiData && typeof r.omiData.max === 'number' ? r.omiData.max : ''
    const omiAvg =
      r.omiData && typeof r.omiData.avg === 'number' ? r.omiData.avg : ''

    const deltaEuroStr =
      r.deltaEuro != null ? Math.round(r.deltaEuro).toString() : ''
    const deltaPercentStr =
      r.deltaPercent != null ? r.deltaPercent.toFixed(2) : ''

    const row = [
      r.index,
      r.label || '',
      r.fullAddress || '',
      r.cap || '',
      r.comune || '',
      r.provincia || '',
      r.regione || '',
      r.propertyType || '',
      r.condition || '',
      r.piano != null ? r.piano : '',
      r.hasElevator != null ? (r.hasElevator ? '1' : '0') : '',
      r.rooms != null ? r.rooms : '',
      r.bathrooms != null ? r.bathrooms : '',
      r.yearBuilt != null ? r.yearBuilt : '',
      r.superficie != null ? r.superficie : '',
      r.expected && r.expected.prezzoMedio != null
        ? r.expected.prezzoMedio
        : '',
      r.api && typeof r.api.prezzoMedio === 'number'
        ? r.api.prezzoMedio
        : '',
      r.api && typeof r.api.prezzoMinimo === 'number'
        ? r.api.prezzoMinimo
        : '',
      r.api && typeof r.api.prezzoMassimo === 'number'
        ? r.api.prezzoMassimo
        : '',
      deltaEuroStr,
      deltaPercentStr,
      r.apiSource || '',
      r.classification || '',
      r.numComuniForCap != null ? r.numComuniForCap : '',
      r.zoneCountUsed != null ? r.zoneCountUsed : '',
      r.semestre || '',
      r.descrTipologia || '',
      omiMin,
      omiMax,
      omiAvg,
      r.fallbackReason || '',
      ''
    ].map(escapeCsvValue)

    lines.push(row.join(','))
  }

  fs.writeFileSync(csvPath, `${lines.join('\n')}\n`, 'utf8')
}

function summarizeScenario(scenario) {
  const { label, results } = scenario

  const buckets = {
    'omi-ufficiale-comunale': [],
    'enhanced-omi-ai': [],
    'real-omi-cap-fallback': [],
    'ambiguous-cap': [],
    'official-no-data': [],
    'generic-fallback': [],
    unknown: []
  }

  for (const r of results) {
    if (r.error) continue
    const key = buckets[r.apiSource] ? r.apiSource : 'unknown'
    buckets[key].push(r)
  }

  const totalCases = results.length
  const officialCount = buckets['omi-ufficiale-comunale'].length
  const ambiguousCount = buckets['ambiguous-cap'].length
  const enhancedCount = buckets['enhanced-omi-ai'].length
  const fallbackSyntheticCount =
    buckets['real-omi-cap-fallback'].length + buckets['generic-fallback'].length
  const officialNoDataCount = buckets['official-no-data'].length

  console.log(`\nRiepilogo classificazioni batch API - scenario: ${label}`)
  console.log('Totale casi:', totalCases)
  console.log('OFFICIAL_COMUNE_ONLY (omi-ufficiale-comunale):', officialCount)
  console.log('AMBIGUOUS_CAP (ambiguous-cap):', ambiguousCount)
  console.log('ENHANCED_AI (enhanced-omi-ai):', enhancedCount)
  console.log('Fallback sintetici (real-omi-cap-fallback + generic-fallback):', fallbackSyntheticCount)
  console.log('OFFICIAL_NO_DATA (official-no-data):', officialNoDataCount)

  const printExamples = (categoryLabel, items) => {
    console.log(`\nEsempi categoria ${categoryLabel}:`)
    for (const r of items.slice(0, 5)) {
      console.log(
        `#${r.index} - ${r.fullAddress} - sorgente=${r.apiSource} - semestre=${r.semestre} - tipologia=${r.descrTipologia} - zone_count_used=${r.zoneCountUsed}`
      )
    }
  }

  printExamples('OFFICIAL_COMUNE_ONLY', buckets['omi-ufficiale-comunale'])
  printExamples('AMBIGUOUS_CAP', buckets['ambiguous-cap'])
  printExamples('ENHANCED_AI', buckets['enhanced-omi-ai'])
  printExamples('OFFICIAL_NO_DATA', buckets['official-no-data'])
  printExamples('Fallback sintetici', [
    ...buckets['real-omi-cap-fallback'],
    ...buckets['generic-fallback']
  ])
}

async function runSameCap71010() {
  const db = openOfficialDb()
  const officialHelpers = createOfficialHelpers(db)
  const results = []
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < SAME_CAP_71010_CASES.length; i += 1) {
    const caseDef = SAME_CAP_71010_CASES[i]
    try {
      const testCase = await buildDeterministicTestCase(caseDef, {
        useOfficialExpected: true,
        officialHelpers
      })
      const apiData = await callEnhancedOmi(
        testCase.address,
        testCase.property,
        { fallbackMode: 'synthetic', officialModeStrict: false }
      )

      const apiVal = apiData && apiData.valutazione ? apiData.valutazione : null

      const apiPrezzoMedio =
        apiVal && typeof apiVal.prezzoMedio === 'number'
          ? apiVal.prezzoMedio
          : null

      const deltaEuro =
        apiPrezzoMedio != null
          ? apiPrezzoMedio - testCase.expected.prezzoMedio
          : null

      const deltaPercent =
        apiPrezzoMedio != null && testCase.expected.prezzoMedio
          ? (deltaEuro / testCase.expected.prezzoMedio) * 100
          : null

      const metadati = apiData && apiData.metadati ? apiData.metadati : {}
      const omi = apiData && apiData.omiData ? apiData.omiData : null
      const numComuniForCap = metadati.numComuniForCap ?? null
      const capStatus = metadati.capStatus || null
      const zoneCountUsed = omi && typeof omi.zone_count_used === 'number'
        ? omi.zone_count_used
        : null
      const semestre = omi && omi.semestre ? omi.semestre : null
      const descrTipologia = omi && omi.tipologia ? omi.tipologia : null
      const sources = Array.isArray(omi && omi.sources) ? omi.sources : []
      const sourcesCount = sources.length
      const sourceExamplePath =
        sourcesCount > 0 && sources[0].path_relativo
          ? sources[0].path_relativo
          : null

      const apiSource = apiData ? apiData.source || null : null
      const classification = apiSource || 'unknown'
      const fallbackReason = metadati.fallbackReason || null

      results.push({
        index: i + 1,
        ...testCase.meta,
        expected: testCase.expected,
        api: apiVal,
        omiData: omi,
        metadatiLimitazioni:
          Array.isArray(metadati.limitazioni) && metadati.limitazioni.length
            ? metadati.limitazioni
            : [],
        fallbackReason,
        apiSource,
        classification,
        numComuniForCap,
        zoneCountUsed,
        semestre,
        descrTipologia,
        sourcesCount,
        sourceExamplePath,
        deltaEuro,
        deltaPercent,
        error: null
      })
      successCount += 1
    } catch (err) {
      console.error(
        'Errore durante il test case batch API same-cap-71010:',
        caseDef && caseDef.label ? caseDef.label : null,
        err && err.message ? err.message : err,
        err && err.response && err.response.status
          ? `status=${err.response.status}`
          : null,
        err && err.response && err.response.data ? err.response.data : null
      )
      const baseMessage =
        err && err.message ? err.message : String(err)
      const statusSuffix =
        err && err.response && err.response.status
          ? ` (status ${err.response.status})`
          : ''
      results.push({
        index: i + 1,
        label: caseDef && caseDef.label ? caseDef.label : null,
        error: `${baseMessage}${statusSuffix}`
      })
      errorCount += 1
    }
  }

  const scenario = {
    label: 'same-cap-71010 diversi-comuni',
    total: SAME_CAP_71010_CASES.length,
    successCount,
    errorCount,
    results
  }

  if (CREATE_TEST_LEAD) {
    for (const r of scenario.results) {
      if (!r || r.error || !r.api) continue
      const contact = {
        nome: 'Test',
        cognome: `CAP71010 ${r.index}`,
        email: `batch-test-71010-${r.index}@example.com`,
        telefono: '+390000000000'
      }
      const address = {
        display: r.fullAddress,
        street: r.street,
        housenumber: String(r.houseNumber),
        city: r.comune,
        state: r.regione,
        province: r.sigla_provincia,
        postcode: r.cap,
        country: 'Italia',
        lat: null,
        lon: null,
        source: 'batch-test-71010'
      }
      const property = {
        livingArea: r.superficie,
        balconyArea: 8,
        terraceArea: 12,
        verandaArea: 0,
        loftArea: 0,
        atticArea: 0,
        basementArea: 0,
        gardenArea: 40,
        rooftopArea: 10,
        condition: r.condition,
        floor: r.piano,
        hasElevator: r.hasElevator,
        rooms: r.rooms,
        bathrooms: r.bathrooms,
        yearBuilt: r.yearBuilt,
        propertyType: r.propertyType,
        heating: 'Autonomo',
        energyClass: 'D',
        parkingSpaces: 1
      }
      const valuation = {
        success: true,
        source: r.apiSource || 'omi-ufficiale-comunale',
        valutazione: r.api,
        omiData: r.omiData || null,
        metadati: {
          fallbackReason: r.fallbackReason || null,
          numComuniForCap: r.numComuniForCap ?? null,
          zoneCountUsed: r.zoneCountUsed ?? null,
          semestre: r.semestre || null,
          descrTipologia: r.descrTipologia || null,
          limitazioni: r.metadatiLimitazioni || [],
          sourceExamplePath: r.sourceExamplePath || null
        }
      }
      const wizardData = {
        propertyType: r.propertyType,
        features: {
          heating: 'Autonomo',
          yearBuilt: String(r.yearBuilt),
          rooms: r.rooms,
          bathrooms: r.bathrooms
        },
        extra: {
          hasBalconyOrTerrace:
            property.balconyArea > 0 || property.terraceArea > 0,
          hasGarden: property.gardenArea > 0,
          hasGarage: property.parkingSpaces > 0
        },
        lead: {
          profileType: 'proprietario',
          isOwner: true,
          marketingConsent: true,
          wantAgenciesValuation: true,
          saleTiming: 'attualmente_in_vendita',
          source: 'batch-test-71010'
        },
        property
      }
      const mediaSummary = {
        hasFloorplan: false,
        photosCount: 0
      }
      const aiAnalysisSummary = null
      const leadId = insertLead({
        contact,
        address,
        property,
        valuation,
        wizardData,
        mediaSummary,
        aiAnalysisSummary
      })
      insertMediaRecords(leadId, [])
      insertAiAnalysis(leadId, aiAnalysisSummary)
      console.log(
        `Creato lead di test CAP 71010 index=${r.index} id=${leadId}`
      )
    }
  }

  summarizeScenario(scenario)
  db.close()
}

async function runSameComunePoggioImperiale() {
  const db = openOfficialDb()
  const officialHelpers = createOfficialHelpers(db)
  const results = []
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < SAME_COMUNE_POGGIO_CASES.length; i += 1) {
    const caseDef = SAME_COMUNE_POGGIO_CASES[i]
    try {
      const testCase = await buildDeterministicTestCase(caseDef, {
        useOfficialExpected: true,
        officialHelpers
      })
      const apiData = await callEnhancedOmi(
        testCase.address,
        testCase.property,
        { fallbackMode: 'synthetic', officialModeStrict: false }
      )

      const apiVal = apiData && apiData.valutazione ? apiData.valutazione : null

      const apiPrezzoMedio =
        apiVal && typeof apiVal.prezzoMedio === 'number'
          ? apiVal.prezzoMedio
          : null

      const deltaEuro =
        apiPrezzoMedio != null
          ? apiPrezzoMedio - testCase.expected.prezzoMedio
          : null

      const deltaPercent =
        apiPrezzoMedio != null && testCase.expected.prezzoMedio
          ? (deltaEuro / testCase.expected.prezzoMedio) * 100
          : null

      const metadati = apiData && apiData.metadati ? apiData.metadati : {}
      const omi = apiData && apiData.omiData ? apiData.omiData : null
      const numComuniForCap = metadati.numComuniForCap ?? null
      const capStatus = metadati.capStatus || null
      const zoneCountUsed = omi && typeof omi.zone_count_used === 'number'
        ? omi.zone_count_used
        : null
      const semestre = omi && omi.semestre ? omi.semestre : null
      const descrTipologia = omi && omi.tipologia ? omi.tipologia : null
      const sources = Array.isArray(omi && omi.sources) ? omi.sources : []
      const sourcesCount = sources.length
      const sourceExamplePath =
        sourcesCount > 0 && sources[0].path_relativo
          ? sources[0].path_relativo
          : null

      const apiSource = apiData ? apiData.source || null : null
      const classification = apiSource || 'unknown'
      const fallbackReason = metadati.fallbackReason || null

      results.push({
        index: i + 1,
        ...testCase.meta,
        expected: testCase.expected,
        api: apiVal,
        omiData: omi,
        metadatiLimitazioni:
          Array.isArray(metadati.limitazioni) && metadati.limitazioni.length
            ? metadati.limitazioni
            : [],
        fallbackReason,
        apiSource,
        classification,
        numComuniForCap,
        zoneCountUsed,
        semestre,
        descrTipologia,
        sourcesCount,
        sourceExamplePath,
        deltaEuro,
        deltaPercent,
        error: null
      })
      successCount += 1
    } catch (err) {
      console.error(
        'Errore durante il test case batch API same-comune-poggio-imperiale:',
        caseDef && caseDef.label ? caseDef.label : null,
        err && err.message ? err.message : err,
        err && err.response && err.response.status
          ? `status=${err.response.status}`
          : null,
        err && err.response && err.response.data ? err.response.data : null
      )
      const baseMessage =
        err && err.message ? err.message : String(err)
      const statusSuffix =
        err && err.response && err.response.status
          ? ` (status ${err.response.status})`
          : ''
      results.push({
        index: i + 1,
        label: caseDef && caseDef.label ? caseDef.label : null,
        error: `${baseMessage}${statusSuffix}`
      })
      errorCount += 1
    }
  }

  const scenario = {
    label: 'same-comune-71010-poggio-imperiale',
    total: SAME_COMUNE_POGGIO_CASES.length,
    successCount,
    errorCount,
    results
  }

  if (CREATE_TEST_LEAD) {
    for (const r of scenario.results) {
      if (!r || r.error || !r.api) continue
      const contact = {
        nome: 'Test',
        cognome: `Poggio71010 ${r.index}`,
        email: `batch-test-poggio-71010-${r.index}@example.com`,
        telefono: '+390000000000'
      }
      const address = {
        display: r.fullAddress,
        street: r.street,
        housenumber: String(r.houseNumber),
        city: r.comune,
        state: r.regione,
        province: r.sigla_provincia,
        postcode: r.cap,
        country: 'Italia',
        lat: null,
        lon: null,
        source: 'batch-test-poggio-71010'
      }
      const property = {
        livingArea: r.superficie,
        balconyArea: 8,
        terraceArea: 12,
        verandaArea: 0,
        loftArea: 0,
        atticArea: 0,
        basementArea: 0,
        gardenArea: 40,
        rooftopArea: 10,
        condition: r.condition,
        floor: r.piano,
        hasElevator: r.hasElevator,
        rooms: r.rooms,
        bathrooms: r.bathrooms,
        yearBuilt: r.yearBuilt,
        propertyType: r.propertyType,
        heating: 'Autonomo',
        energyClass: 'D',
        parkingSpaces: 1
      }
      const valuation = {
        success: true,
        source: r.apiSource || 'omi-ufficiale-comunale',
        valutazione: r.api,
        omiData: r.omiData || null,
        metadati: {
          fallbackReason: r.fallbackReason || null,
          numComuniForCap: r.numComuniForCap ?? null,
          zoneCountUsed: r.zoneCountUsed ?? null,
          semestre: r.semestre || null,
          descrTipologia: r.descrTipologia || null,
          limitazioni: r.metadatiLimitazioni || [],
          sourceExamplePath: r.sourceExamplePath || null
        }
      }
      const wizardData = {
        propertyType: r.propertyType,
        features: {
          heating: 'Autonomo',
          yearBuilt: String(r.yearBuilt),
          rooms: r.rooms,
          bathrooms: r.bathrooms
        },
        extra: {
          hasBalconyOrTerrace:
            property.balconyArea > 0 || property.terraceArea > 0,
          hasGarden: property.gardenArea > 0,
          hasGarage: property.parkingSpaces > 0
        },
        lead: {
          profileType: 'proprietario',
          isOwner: true,
          marketingConsent: true,
          wantAgenciesValuation: true,
          saleTiming: 'attualmente_in_vendita',
          source: 'batch-test-poggio-71010'
        },
        property
      }
      const mediaSummary = {
        hasFloorplan: false,
        photosCount: 0
      }
      const aiAnalysisSummary = null
      const leadId = insertLead({
        contact,
        address,
        property,
        valuation,
        wizardData,
        mediaSummary,
        aiAnalysisSummary
      })
      insertMediaRecords(leadId, [])
      insertAiAnalysis(leadId, aiAnalysisSummary)
      console.log(
        `Creato lead di test Poggio Imperiale CAP 71010 index=${r.index} id=${leadId}`
      )
    }
  }

  summarizeScenario(scenario)
  db.close()
}

async function runDefault() {
  const total = 20
  const db = openOfficialDb()
  const officialHelpers = createOfficialHelpers(db)
  const capUniverse = loadCapComuneUniverse(db)

  const scenarioOfficialStrict = await runScenario({
    label: 'official-only strict (officialModeStrict=1, fallback=off)',
    total,
    fallbackMode: 'off',
    officialModeStrict: true,
    useOfficialExpected: true,
    capUniverse,
    officialHelpers
  })

  const scenarioFullDataDeterministic = await runDeterministicScenario({
    label: 'full-data deterministic (fallback=synthetic)',
    fallbackMode: 'synthetic',
    officialModeStrict: false,
    useOfficialExpected: true,
    officialHelpers
  })

  const scenarioOfficialWithFallback = await runScenario({
    label: 'official-only con fallback sintetico (fallback=synthetic)',
    total,
    fallbackMode: 'synthetic',
    officialModeStrict: false,
    useOfficialExpected: true,
    capUniverse,
    officialHelpers
  })

  db.close()

  writeScenarioCsv(scenarioOfficialStrict, CSV_OUTPUT_STRICT)
  writeScenarioCsv(scenarioOfficialWithFallback, CSV_OUTPUT_FALLBACK)
  writeScenarioCsv(scenarioFullDataDeterministic, CSV_OUTPUT_FULL)

  if (CREATE_TEST_LEAD) {
    for (const r of scenarioOfficialWithFallback.results) {
      if (!r || r.error || !r.api) continue
      const contact = {
        nome: 'Test',
        cognome: `Batch ${r.index}`,
        email: `batch-test-${r.index}@example.com`,
        telefono: '+390000000000'
      }
      const address = {
        display: r.fullAddress,
        street: r.street,
        housenumber: String(r.houseNumber),
        city: r.comune,
        state: r.regione,
        province: r.sigla_provincia,
        postcode: r.cap,
        country: 'Italia',
        lat: null,
        lon: null,
        source: 'batch-api-test-scenario'
      }
      const property = {
        livingArea: r.superficie,
        balconyArea: 8,
        terraceArea: 12,
        verandaArea: 0,
        loftArea: 0,
        atticArea: 0,
        basementArea: 0,
        gardenArea: 40,
        rooftopArea: 10,
        condition: r.condition,
        floor: r.piano,
        hasElevator: r.hasElevator,
        rooms: r.rooms,
        bathrooms: r.bathrooms,
        yearBuilt: r.yearBuilt,
        propertyType: r.propertyType,
        heating: 'Autonomo',
        energyClass: 'D',
        parkingSpaces: 1
      }
      const valuation = {
        success: true,
        source: r.apiSource || 'omi-ufficiale-comunale',
        valutazione: r.api,
        omiData: r.omiData || null,
        metadati: {
          fallbackReason: r.fallbackReason || null,
          numComuniForCap: r.numComuniForCap ?? null,
          zoneCountUsed: r.zoneCountUsed ?? null,
          semestre: r.semestre || null,
          descrTipologia: r.descrTipologia || null,
          limitazioni: r.metadatiLimitazioni || [],
          sourceExamplePath: r.sourceExamplePath || null
        }
      }
      const wizardData = {
        propertyType: r.propertyType,
        features: {
          heating: 'Autonomo',
          yearBuilt: String(r.yearBuilt),
          rooms: r.rooms,
          bathrooms: r.bathrooms
        },
        extra: {
          hasBalconyOrTerrace:
            property.balconyArea > 0 || property.terraceArea > 0,
          hasGarden: property.gardenArea > 0,
          hasGarage: property.parkingSpaces > 0
        },
        lead: {
          profileType: 'proprietario',
          isOwner: true,
          marketingConsent: true,
          wantAgenciesValuation: true,
          saleTiming: 'attualmente_in_vendita',
          source: 'batch-test-scenario'
        },
        property
      }
      const mediaSummary = {
        hasFloorplan: false,
        photosCount: 0
      }
      const aiAnalysisSummary = null
      const leadId = insertLead({
        contact,
        address,
        property,
        valuation,
        wizardData,
        mediaSummary,
        aiAnalysisSummary
      })
      insertMediaRecords(leadId, [])
      insertAiAnalysis(leadId, aiAnalysisSummary)
      console.log(
        `Creato lead di test per scenario official-with-fallback index=${r.index} id=${leadId}`
      )
    }
  }

  let md = ''
  md += '# Batch test API /valuation/enhanced-omi (Italia)\n\n'
  md += renderScenarioMarkdown(scenarioOfficialStrict)
  md += '\n\n'
  md += renderScenarioMarkdown(scenarioOfficialWithFallback)
  md += '\n\n'
  md += renderScenarioMarkdown(scenarioFullDataDeterministic)

  fs.writeFileSync(OUTPUT_PATH, md, 'utf8')
  console.log(
    `Creato file markdown API batch con tre scenari in ${OUTPUT_PATH}`
  )

  summarizeScenario(scenarioOfficialStrict)
  summarizeScenario(scenarioOfficialWithFallback)
  summarizeScenario(scenarioFullDataDeterministic)
}

async function main() {
  const mode = process.argv[2] || 'default'
  if (mode === 'same-cap-71010') {
    await runSameCap71010()
  } else if (mode === 'same-comune-poggio-imperiale') {
    await runSameComunePoggioImperiale()
  } else {
    await runDefault()
  }
}

main().catch((err) => {
  console.error('Errore durante il batch test API delle valutazioni:', err)
  process.exit(1)
})
