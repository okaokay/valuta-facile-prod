import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { mapUiCategoryToOmi } from './omiCategoryMapping.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function openOmiDb() {
  const dbDir = path.join(__dirname, '..', '..', 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  const dbPath =
    process.env.OMI_DB_PATH || path.join(dbDir, 'omi_official.sqlite')
  const db = new Database(dbPath, { readonly: true })
  try {
    db.pragma('journal_mode = WAL')
  } catch (err) {
    console.error('Errore impostando WAL sul DB OMI, fallback DELETE:', err.message)
    try {
      db.pragma('journal_mode = DELETE')
    } catch (err2) {
      console.error('Errore impostando DELETE journal mode sul DB OMI:', err2.message)
    }
  }
  return db
}

export class OmiOfficialRepository {
  constructor() {
    this.db = openOmiDb()
    this.statements = {
      comuniByCap: this.db.prepare(`
        SELECT
          c.id as comune_id,
          c.codice_comune,
          c.denominazione_comune,
          p.sigla_provincia,
          p.denominazione_provincia,
          r.denominazione_regione
        FROM cap cp
        JOIN cap_comune cc ON cc.cap_id = cp.id
        JOIN comuni c ON c.id = cc.comune_id
        JOIN province p ON p.id = c.id_provincia
        JOIN regioni r ON r.id = p.id_regione
        WHERE cp.cap = ?
        ORDER BY c.denominazione_comune
      `),
      latestActiveSemester: this.db.prepare(`
        SELECT codice_semestre
        FROM omi_semesters
        WHERE is_active = 1
        ORDER BY anno DESC, semestre DESC
        LIMIT 1
      `),
      latestSemester: this.db.prepare(`
        SELECT codice_semestre
        FROM omi_semesters
        ORDER BY anno DESC, semestre DESC
        LIMIT 1
      `),
      zonesCountByComuneSemestre: this.db.prepare(`
        SELECT COUNT(DISTINCT z.id) as zone_count
        FROM omi_zones z
        JOIN omi_semesters s ON s.id = z.id_semestre
        WHERE z.id_comune = @id_comune
          AND s.codice_semestre = @codice_semestre
      `),
      rangeByComuneSemestreTipologia: this.db.prepare(`
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
      `),
      rangeSourcesByComuneSemestreTipologia: this.db.prepare(`
        SELECT DISTINCT
          f.path_relativo,
          f.hash_file,
          f.tipo_file
        FROM omi_zones z
        JOIN omi_values v ON v.id_zone = z.id
        JOIN omi_semesters s ON s.id = z.id_semestre
        JOIN omi_import_files f ON f.id = v.id_file_import
        WHERE z.id_comune = @id_comune
          AND s.codice_semestre = @codice_semestre
          AND v.descr_tipologia = @descr_tipologia
      `),
      // Come rangeByComuneSemestreTipologia ma filtrata anche per stato di
      // conservazione OMI (SCADENTE/NORMALE/OTTIMO) — usata per far dipendere
      // il prezzo dalla condizione dell'immobile scelta nel wizard.
      rangeByComuneSemestreTipologiaStato: this.db.prepare(`
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
          AND v.stato = @stato COLLATE NOCASE
      `),
      provinciaIdByComune: this.db.prepare(`
        SELECT id_provincia, (SELECT denominazione_provincia FROM province WHERE id = comuni.id_provincia) as denominazione_provincia
        FROM comuni WHERE id = ?
      `),
      // Media provinciale: usata per contestualizzare il prezzo/mq della
      // zona specifica rispetto al resto della provincia nel report (non
      // usata nel calcolo della valutazione, solo a scopo narrativo).
      avgByProvinciaSemestreTipologia: this.db.prepare(`
        SELECT
          AVG((v.min_eur_mq + v.max_eur_mq) / 2.0) as avg_provincia_eur_mq,
          COUNT(DISTINCT z.id) as zone_count_used,
          COUNT(DISTINCT c.id) as comuni_count_used
        FROM omi_zones z
        JOIN omi_values v ON v.id_zone = z.id
        JOIN omi_semesters s ON s.id = z.id_semestre
        JOIN comuni c ON c.id = z.id_comune
        WHERE c.id_provincia = @id_provincia
          AND s.codice_semestre = @codice_semestre
          AND v.descr_tipologia = @descr_tipologia COLLATE NOCASE
      `)
    }
  }

  findComuniByCap(cap) {
    if (!cap) return []
    const normalizedCap = String(cap).padStart(5, '0')
    return this.statements.comuniByCap.all(normalizedCap)
  }

  // Punto di ingresso "comodo" per il solo scopo del report (non usato nel
  // calcolo della valutazione): dato cap+nome comune+tipologia, ricava da sé
  // comuneId e semestre più recente e ritorna la media provinciale. Pensato
  // per essere chiamato in modo isolato da report.ts/payment.ts, così un
  // eventuale problema qui non può in alcun modo toccare il prezzo calcolato
  // altrove — stessa logica di isolamento già usata per POI/scuole.
  getProvinciaContextForReport({ cap, comuneName, uiTypology }) {
    if (!cap || !uiTypology) return null
    const semestreCode = this.getLatestSemesterCode()
    if (!semestreCode) return null

    const comuni = this.findComuniByCap(cap)
    if (!comuni.length) return null

    const normalize = (s) => String(s || '').trim().toUpperCase()
    const match =
      comuni.find((c) => normalize(c.denominazione_comune) === normalize(comuneName)) ||
      comuni[0]
    if (!match) return null

    return this.getProvinciaAverageByUiTypology({
      comuneId: match.comune_id,
      semestreCode,
      uiTypology
    })
  }

  getLatestSemesterCode() {
    const active = this.statements.latestActiveSemester.get()
    if (active && active.codice_semestre) return active.codice_semestre
    const any = this.statements.latestSemester.get()
    return any && any.codice_semestre ? any.codice_semestre : null
  }

  getComuneRangeByUiTypology({ comuneId, semestreCode, uiTypology }) {
    if (!comuneId || !semestreCode || !uiTypology) return null
    const descr_tipologia = mapUiCategoryToOmi(uiTypology)
    if (!descr_tipologia) return null

    const params = {
      id_comune: comuneId,
      codice_semestre: semestreCode,
      descr_tipologia
    }

    const rangeRow =
      this.statements.rangeByComuneSemestreTipologia.get(params)

    if (!rangeRow || rangeRow.zone_count_used === 0) {
      return null
    }

    const rawSources =
      this.statements.rangeSourcesByComuneSemestreTipologia.all(params)

    const uniqueSourcesMap = new Map()
    for (const src of rawSources || []) {
      const key = src.hash_file || `${src.path_relativo}::${src.tipo_file}`
      if (!uniqueSourcesMap.has(key)) {
        uniqueSourcesMap.set(key, src)
      }
    }
    const sources = Array.from(uniqueSourcesMap.values())

    return {
      min_comune_eur_mq: rangeRow.min_comune_eur_mq,
      max_comune_eur_mq: rangeRow.max_comune_eur_mq,
      zone_count_used: rangeRow.zone_count_used,
      descr_tipologia,
      semestre_code: semestreCode,
      sources
    }
  }

  // Come getComuneRangeByUiTypology, ma filtra i valori OMI anche per stato
  // di conservazione (SCADENTE/NORMALE/OTTIMO). Restituisce null se per quel
  // comune/tipologia/semestre non esiste nessuna riga con quello stato — il
  // chiamante (buildCapBasedValuation) applica in quel caso una percentuale
  // di fallback calcolata sul valore NORMALE.
  getComuneRangeByUiTypologyAndStato({ comuneId, semestreCode, uiTypology, stato }) {
    if (!comuneId || !semestreCode || !uiTypology || !stato) return null
    const descr_tipologia = mapUiCategoryToOmi(uiTypology)
    if (!descr_tipologia) return null

    const params = {
      id_comune: comuneId,
      codice_semestre: semestreCode,
      descr_tipologia,
      stato
    }

    const rangeRow =
      this.statements.rangeByComuneSemestreTipologiaStato.get(params)

    if (!rangeRow || rangeRow.zone_count_used === 0) {
      return null
    }

    return {
      min_comune_eur_mq: rangeRow.min_comune_eur_mq,
      max_comune_eur_mq: rangeRow.max_comune_eur_mq,
      zone_count_used: rangeRow.zone_count_used,
      descr_tipologia,
      stato,
      semestre_code: semestreCode
    }
  }

  // Media provinciale del prezzo/mq per una tipologia, usata per dare
  // contesto nel report ("questa zona è il X% sopra/sotto la media della
  // provincia"). Ritorna null se manca la provincia o non ci sono dati
  // sufficienti — il chiamante deve trattarlo come sezione opzionale.
  getProvinciaAverageByUiTypology({ comuneId, semestreCode, uiTypology }) {
    if (!comuneId || !semestreCode || !uiTypology) return null
    const descr_tipologia = mapUiCategoryToOmi(uiTypology)
    if (!descr_tipologia) return null

    const comuneRow = this.statements.provinciaIdByComune.get(comuneId)
    if (!comuneRow || !comuneRow.id_provincia) return null

    const row = this.statements.avgByProvinciaSemestreTipologia.get({
      id_provincia: comuneRow.id_provincia,
      codice_semestre: semestreCode,
      descr_tipologia
    })

    if (!row || !row.avg_provincia_eur_mq || row.zone_count_used === 0) {
      return null
    }

    return {
      avgProvinciaEurMq: Math.round(row.avg_provincia_eur_mq),
      provincia: comuneRow.denominazione_provincia || null,
      zoneCountUsed: row.zone_count_used,
      comuniCountUsed: row.comuni_count_used,
      descrTipologia: descr_tipologia,
      semestreCode
    }
  }

  countZonesByComuneSemestre({ comuneId, semestreCode }) {
    if (!comuneId || !semestreCode) return 0
    const row = this.statements.zonesCountByComuneSemestre.get({
      id_comune: comuneId,
      codice_semestre: semestreCode
    })
    return row && typeof row.zone_count === 'number' ? row.zone_count : 0
  }
}
