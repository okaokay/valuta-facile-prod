import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}
  for (const arg of args) {
    const [key, value] = arg.split('=')
    if (!key || !value) continue
    if (key.startsWith('--')) {
      result[key.slice(2)] = value.replace(/^"(.+)"$/, '$1')
    }
  }
  return result
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function createOmiDb(dbPath) {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS regioni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice_regione TEXT NOT NULL UNIQUE,
      denominazione_regione TEXT,
      ripartizione_geografica TEXT,
      tipologia_regione TEXT,
      numero_province INTEGER,
      numero_comuni INTEGER,
      superficie_kmq REAL
    );

    CREATE TABLE IF NOT EXISTS province (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice_provincia TEXT NOT NULL UNIQUE,
      denominazione_provincia TEXT,
      sigla_provincia TEXT UNIQUE,
      id_regione INTEGER REFERENCES regioni(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comuni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice_comune TEXT NOT NULL UNIQUE,
      denominazione_comune TEXT,
      id_provincia INTEGER REFERENCES province(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      codice_catastale TEXT,
      data_inizio_validita TEXT,
      data_fine_validita TEXT
    );

    CREATE TABLE IF NOT EXISTS cap (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cap TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS cap_comune (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cap_id INTEGER NOT NULL,
      comune_id INTEGER NOT NULL,
      UNIQUE (cap_id, comune_id)
    );

    CREATE TABLE IF NOT EXISTS omi_semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice_semestre TEXT NOT NULL UNIQUE,
      anno INTEGER NOT NULL,
      semestre INTEGER NOT NULL,
      descrizione TEXT,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS omi_import_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path_relativo TEXT NOT NULL,
      hash_file TEXT NOT NULL UNIQUE,
      tipo_file TEXT NOT NULL,
      id_semestre INTEGER NOT NULL REFERENCES omi_semesters(id) ON DELETE CASCADE ON UPDATE CASCADE,
      righe_lette INTEGER NOT NULL DEFAULT 0,
      righe_importate INTEGER NOT NULL DEFAULT 0,
      timestamp_import TEXT NOT NULL DEFAULT (datetime('now')),
      esito TEXT NOT NULL,
      messaggio_errore TEXT
    );

    CREATE TABLE IF NOT EXISTS omi_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_semestre INTEGER NOT NULL REFERENCES omi_semesters(id) ON DELETE CASCADE ON UPDATE CASCADE,
      id_comune INTEGER REFERENCES comuni(id) ON DELETE SET NULL ON UPDATE CASCADE,
      codice_zona_omi TEXT NOT NULL,
      denominazione_zona TEXT,
      tipologia_zona TEXT,
      microzona TEXT,
      id_file_import INTEGER REFERENCES omi_import_files(id) ON DELETE SET NULL ON UPDATE CASCADE,
      UNIQUE (id_semestre, id_comune, codice_zona_omi)
    );

    CREATE TABLE IF NOT EXISTS omi_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_zone INTEGER NOT NULL REFERENCES omi_zones(id) ON DELETE CASCADE ON UPDATE CASCADE,
      codice_tipologia TEXT,
      descr_tipologia TEXT,
      stato TEXT,
      stato_prev TEXT,
      min_eur_mq REAL NOT NULL,
      max_eur_mq REAL NOT NULL,
      id_file_import INTEGER NOT NULL REFERENCES omi_import_files(id) ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cap_cap ON cap(cap);
    CREATE INDEX IF NOT EXISTS idx_cap_comune_cap_comune ON cap_comune(cap_id, comune_id);
    CREATE INDEX IF NOT EXISTS idx_omi_zones_semestre_comune ON omi_zones(id_semestre, id_comune);
    CREATE INDEX IF NOT EXISTS idx_omi_values_zone_tipologia ON omi_values(id_zone, descr_tipologia, codice_tipologia);
  `)

  return db
}

function loadJsonFile(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    return null
  }
  const raw = fs.readFileSync(jsonPath, 'utf8')
  return JSON.parse(raw)
}

function importAnagrafiche(db, capPath) {
  const regioniPath = path.join(capPath, 'gi_regioni.json')
  const provincePath = path.join(capPath, 'gi_province.json')
  const comuniPath = path.join(capPath, 'gi_comuni.json')
  const comuniValiditaPath = path.join(capPath, 'gi_comuni_validita.json')
  const capComuniPath = path.join(capPath, 'gi_comuni_cap.json')

  const regioniData = loadJsonFile(regioniPath) || []
  const provinceData = loadJsonFile(provincePath) || []
  const comuniData = loadJsonFile(comuniPath) || []
  const comuniValiditaData = loadJsonFile(comuniValiditaPath) || []
  const capComuniData = loadJsonFile(capComuniPath) || []

  const validitaByComune = new Map()
  for (const row of comuniValiditaData) {
    const codice = String(row.codice_istat).trim()
    if (!codice) continue
    if (row.stato_validita !== 'Attivo') continue
    if (!validitaByComune.has(codice)) {
      validitaByComune.set(codice, row)
    }
  }

  const insertRegione = db.prepare(`
    INSERT INTO regioni (codice_regione, denominazione_regione, ripartizione_geografica, tipologia_regione, numero_province, numero_comuni, superficie_kmq)
    VALUES (@codice_regione, @denominazione_regione, @ripartizione_geografica, @tipologia_regione, @numero_province, @numero_comuni, @superficie_kmq)
    ON CONFLICT(codice_regione) DO UPDATE SET
      denominazione_regione = excluded.denominazione_regione,
      ripartizione_geografica = excluded.ripartizione_geografica,
      tipologia_regione = excluded.tipologia_regione,
      numero_province = excluded.numero_province,
      numero_comuni = excluded.numero_comuni,
      superficie_kmq = excluded.superficie_kmq
  `)

  const insertProvincia = db.prepare(`
    INSERT INTO province (codice_provincia, denominazione_provincia, sigla_provincia, id_regione)
    VALUES (@codice_provincia, @denominazione_provincia, @sigla_provincia, @id_regione)
    ON CONFLICT(codice_provincia) DO UPDATE SET
      denominazione_provincia = excluded.denominazione_provincia,
      sigla_provincia = excluded.sigla_provincia,
      id_regione = excluded.id_regione
  `)

  const insertComune = db.prepare(`
    INSERT INTO comuni (codice_comune, denominazione_comune, id_provincia, codice_catastale, data_inizio_validita, data_fine_validita)
    VALUES (@codice_comune, @denominazione_comune, @id_provincia, @codice_catastale, @data_inizio_validita, @data_fine_validita)
    ON CONFLICT(codice_comune) DO UPDATE SET
      denominazione_comune = excluded.denominazione_comune,
      id_provincia = excluded.id_provincia,
      codice_catastale = excluded.codice_catastale,
      data_inizio_validita = excluded.data_inizio_validita,
      data_fine_validita = excluded.data_fine_validita
  `)

  const insertCap = db.prepare(`
    INSERT INTO cap (cap)
    VALUES (?)
    ON CONFLICT(cap) DO UPDATE SET cap = excluded.cap
  `)

  const insertCapComune = db.prepare(`
    INSERT INTO cap_comune (cap_id, comune_id)
    VALUES (?, ?)
    ON CONFLICT(cap_id, comune_id) DO NOTHING
  `)

  const getRegioneId = db.prepare(`
    SELECT id FROM regioni WHERE codice_regione = ?
  `)

  const getProvinciaId = db.prepare(`
    SELECT id FROM province WHERE codice_provincia = ?
  `)

  const getComuneId = db.prepare(`
    SELECT id FROM comuni WHERE codice_comune = ?
  `)

  db.transaction(() => {
    for (const row of regioniData) {
      insertRegione.run({
        codice_regione: String(row.codice_regione).trim(),
        denominazione_regione: row.denominazione_regione || null,
        ripartizione_geografica: row.ripartizione_geografica || null,
        tipologia_regione: row.tipologia_regione || null,
        numero_province: row.numero_province ?? null,
        numero_comuni: row.numero_comuni ?? null,
        superficie_kmq: row.superficie_kmq ?? null
      })
    }

    for (const row of provinceData) {
      const codiceRegione = String(row.codice_regione).trim()
      const regione = getRegioneId.get(codiceRegione)
      const id_regione = regione ? regione.id : null
      const siglaProvincia = String(row.sigla_provincia).trim()
      insertProvincia.run({
        codice_provincia: siglaProvincia,
        denominazione_provincia: row.denominazione_provincia || null,
        sigla_provincia: siglaProvincia || null,
        id_regione
      })
    }

    for (const row of comuniData) {
      const codiceComune = String(row.codice_istat).trim()
      const siglaProvincia = String(row.sigla_provincia).trim()
      const provincia = getProvinciaId.get(siglaProvincia)
      const id_provincia = provincia ? provincia.id : null
      const validita = validitaByComune.get(codiceComune)
      insertComune.run({
        codice_comune: codiceComune,
        denominazione_comune:
          row.denominazione_ita || row.denominazione_ita_altra || null,
        id_provincia,
        codice_catastale: row.codice_belfiore || null,
        data_inizio_validita: validita?.data_inizio_validita || null,
        data_fine_validita: validita?.data_fine_validita || null
      })
    }

    for (const row of capComuniData) {
      const capValue = String(row.cap).padStart(5, '0')
      const codiceComune = String(row.codice_istat).trim()
      const comune = getComuneId.get(codiceComune)
      if (!comune) continue
      const capResult = insertCap.run(capValue)
      const capRowId =
        capResult.lastInsertRowid ||
        db.prepare('SELECT id FROM cap WHERE cap = ?').get(capValue).id
      try {
        insertCapComune.run(capRowId, comune.id)
      } catch (err) {
        console.error('Errore inserimento cap_comune', {
          capValue,
          codiceComune,
          comuneId: comune?.id,
          capRowId
        })
        throw err
      }
    }
  })()
}

function hashFile(filePath) {
  const hash = crypto.createHash('sha256')
  const data = fs.readFileSync(filePath)
  hash.update(data)
  return hash.digest('hex')
}

function parseSemesterFromFilename(filename) {
  const match = filename.match(/_(\d{5})_(ZONE|VALORI)\.csv$/i)
  if (!match) return null
  const yearAndSemester = match[1]
  const anno = Number(yearAndSemester.slice(0, 4))
  const semestre = Number(yearAndSemester.slice(4, 5))
  const codice_semestre = `${anno}_${semestre}`
  const descrizione = `${semestre}° semestre ${anno}`
  return { anno, semestre, codice_semestre, descrizione }
}

function getOrCreateSemester(db, semestreInfo) {
  const existing = db
    .prepare('SELECT id FROM omi_semesters WHERE codice_semestre = ?')
    .get(semestreInfo.codice_semestre)
  if (existing) return existing.id

  const stmt = db.prepare(`
    INSERT INTO omi_semesters (codice_semestre, anno, semestre, descrizione, is_active)
    VALUES (?, ?, ?, ?, 0)
  `)
  const info = stmt.run(
    semestreInfo.codice_semestre,
    semestreInfo.anno,
    semestreInfo.semestre,
    semestreInfo.descrizione
  )
  return info.lastInsertRowid
}

function walkDir(dirPath) {
  const files = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

function importOmiFiles(db, omiPath, dbRootDir) {
  const normalizeOmiComuneIstat = (raw) => {
    let codice = String(raw || '').trim()
    if (codice.length === 7 && codice.startsWith('9')) {
      codice = codice.slice(1)
    }
    if (codice.length === 8) {
      codice = codice.slice(2)
    }
    return codice
  }

  db.exec(`
    DELETE FROM omi_values;
    DELETE FROM omi_zones;
    DELETE FROM omi_import_files;
    DELETE FROM omi_semesters;
  `)

  const allFiles = walkDir(omiPath)

  const orderedFiles = [...allFiles].sort((a, b) => {
    const aName = path.basename(a).toUpperCase()
    const bName = path.basename(b).toUpperCase()
    const aIsZone = aName.includes('ZONE')
    const bIsZone = bName.includes('ZONE')
    if (aIsZone && !bIsZone) return -1
    if (!aIsZone && bIsZone) return 1
    return aName.localeCompare(bName)
  })

  const insertImportFile = db.prepare(`
    INSERT INTO omi_import_files (path_relativo, hash_file, tipo_file, id_semestre, righe_lette, righe_importate, esito, messaggio_errore)
    VALUES (@path_relativo, @hash_file, @tipo_file, @id_semestre, @righe_lette, @righe_importate, @esito, @messaggio_errore)
  `)

  const updateImportFile = db.prepare(`
    UPDATE omi_import_files
    SET righe_lette = @righe_lette,
        righe_importate = @righe_importate,
        esito = @esito,
        messaggio_errore = @messaggio_errore
    WHERE id = @id
  `)

  const getImportByHash = db.prepare(`
    SELECT id, esito FROM omi_import_files WHERE hash_file = ?
  `)

  const existingSemesterStmt = db.prepare(`
    SELECT id, anno, semestre, codice_semestre FROM omi_semesters WHERE codice_semestre = ?
  `)

  const insertZone = db.prepare(`
    INSERT INTO omi_zones (id_semestre, id_comune, codice_zona_omi, denominazione_zona, tipologia_zona, microzona, id_file_import)
    VALUES (@id_semestre, @id_comune, @codice_zona_omi, @denominazione_zona, @tipologia_zona, @microzona, @id_file_import)
    ON CONFLICT(id_semestre, id_comune, codice_zona_omi) DO UPDATE SET
      denominazione_zona = excluded.denominazione_zona,
      tipologia_zona = excluded.tipologia_zona,
      microzona = excluded.microzona,
      id_file_import = excluded.id_file_import
  `)

  const insertValue = db.prepare(`
    INSERT INTO omi_values (id_zone, codice_tipologia, descr_tipologia, stato, stato_prev, min_eur_mq, max_eur_mq, id_file_import)
    VALUES (@id_zone, @codice_tipologia, @descr_tipologia, @stato, @stato_prev, @min_eur_mq, @max_eur_mq, @id_file_import)
  `)

  const getComuneByIstat = db.prepare(`
    SELECT id FROM comuni WHERE codice_comune = ?
  `)

  const getComuneByCatastale = db.prepare(`
    SELECT id FROM comuni WHERE codice_catastale = ?
  `)

  const getZoneId = db.prepare(`
    SELECT id FROM omi_zones
    WHERE id_semestre = ? AND id_comune = ? AND codice_zona_omi = ?
  `)

  for (const fullPath of orderedFiles) {
    const filename = path.basename(fullPath)
    if (!filename.toUpperCase().includes('ZONE') && !filename.toUpperCase().includes('VALORI')) {
      continue
    }

    const hash = hashFile(fullPath)

    const tipo_file = filename.toUpperCase().includes('ZONE') ? 'ZONE' : 'VALORI'

    const existingImport = getImportByHash.get(hash)

    const semestreInfo = parseSemesterFromFilename(filename)
    if (!semestreInfo) {
      insertImportFile.run({
        path_relativo: path.relative(dbRootDir, fullPath),
        hash_file: hash,
        tipo_file,
        id_semestre: null,
        righe_lette: 0,
        righe_importate: 0,
        esito: 'ERROR',
        messaggio_errore: 'Impossibile determinare semestre dal nome file'
      })
      continue
    }

    let semestreRow = existingSemesterStmt.get(semestreInfo.codice_semestre)
    if (!semestreRow) {
      const id_semestre = getOrCreateSemester(db, semestreInfo)
      semestreRow = {
        id: id_semestre,
        codice_semestre: semestreInfo.codice_semestre,
        anno: semestreInfo.anno,
        semestre: semestreInfo.semestre
      }
    }

    const relativePath = path.relative(dbRootDir, fullPath)
    let importFileId
    if (existingImport) {
      updateImportFile.run({
        id: existingImport.id,
        righe_lette: 0,
        righe_importate: 0,
        esito: 'PENDING',
        messaggio_errore: null
      })
      importFileId = existingImport.id
    } else {
      const importInsertInfo = insertImportFile.run({
        path_relativo: relativePath,
        hash_file: hash,
        tipo_file,
        id_semestre: semestreRow.id,
        righe_lette: 0,
        righe_importate: 0,
        esito: 'PENDING',
        messaggio_errore: null
      })
      importFileId = importInsertInfo.lastInsertRowid
    }
    let righe_lette = 0
    let righe_importate = 0
    let esito = 'OK'
    let messaggio_errore = null

    try {
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '')
      if (lines.length <= 1) {
        esito = 'ERROR'
        messaggio_errore = 'File senza righe utili'
      } else {
        const headerLine = lines[1]
        const headers = headerLine.split(';').map((h) => h.trim())
        righe_lette = lines.length - 2

        const resolveComune = (row) => {
          const codiceComuneIstat = normalizeOmiComuneIstat(row.Comune_ISTAT)
          if (codiceComuneIstat) {
            const comuneIstat = getComuneByIstat.get(codiceComuneIstat)
            if (comuneIstat) return comuneIstat
          }
          const codiceCatComuneAmm = String(row.Comune_amm || '').trim()
          if (codiceCatComuneAmm) {
            const comuneCat = getComuneByCatastale.get(codiceCatComuneAmm)
            if (comuneCat) return comuneCat
          }
          const codiceCatComuneCat = String(row.Comune_cat || '').trim()
          if (codiceCatComuneCat) {
            const comuneCat = getComuneByCatastale.get(codiceCatComuneCat)
            if (comuneCat) return comuneCat
          }
          return null
        }

        if (tipo_file === 'ZONE') {
          db.transaction(() => {
            for (let i = 2; i < lines.length; i += 1) {
              const line = lines[i]
              if (!line.trim()) continue
              const cols = line.split(';')
              if (cols.length < headers.length) continue
              const row = {}
              headers.forEach((h, idx) => {
                row[h] = cols[idx]
              })
              const comune = resolveComune(row)
              const id_comune = comune ? comune.id : null
              const codice_zona_omi = String(row.Zona || row.Zona_Descr || '').replace(/'/g, '').trim()
              if (!codice_zona_omi) continue
              const denominazione_zona = row.Zona_Descr ? row.Zona_Descr.replace(/'/g, '').trim() : null
              const tipologia_zona = row.Descr_tip_prev || null
              const microzona = row.Microzona || null
              insertZone.run({
                id_semestre: semestreRow.id,
                id_comune,
                codice_zona_omi,
                denominazione_zona,
                tipologia_zona,
                microzona,
                id_file_import: importFileId
              })
              righe_importate += 1
            }
          })()
        } else {
          const orphanValues = []
          db.transaction(() => {
            for (let i = 2; i < lines.length; i += 1) {
              const line = lines[i]
              if (!line.trim()) continue
              const cols = line.split(';')
              if (cols.length < headers.length) continue
              const row = {}
              headers.forEach((h, idx) => {
                row[h] = cols[idx]
              })
              const zonaCode = String(row.Zona || '').trim()
              if (!zonaCode) continue
              const comune = resolveComune(row)
              if (!comune) {
                orphanValues.push({ reason: 'comune_not_found' })
                continue
              }
              const zona = getZoneId.get(semestreRow.id, comune.id, zonaCode)
              if (!zona) {
                orphanValues.push({ reason: 'zone_not_found' })
                continue
              }
              const comprMinRaw = String(row.Compr_min || '').replace(',', '.')
              const comprMaxRaw = String(row.Compr_max || '').replace(',', '.')
              const min_eur_mq = Number(comprMinRaw)
              const max_eur_mq = Number(comprMaxRaw)
              if (!Number.isFinite(min_eur_mq) || !Number.isFinite(max_eur_mq)) {
                continue
              }
              insertValue.run({
                id_zone: zona.id,
                codice_tipologia: row.Cod_Tip || null,
                descr_tipologia: row.Descr_Tipologia || null,
                stato: row.Stato || null,
                stato_prev: row.Stato_prev || null,
                min_eur_mq,
                max_eur_mq,
                id_file_import: importFileId
              })
              righe_importate += 1
            }
          })()
          if (orphanValues.length > 0 && righe_importate === 0) {
            esito = 'ERROR'
            messaggio_errore = 'Tutti i valori sono orfani (comune o zona non trovati)'
          }
        }
      }
    } catch (e) {
      esito = 'ERROR'
      messaggio_errore = e.message || String(e)
    }

    updateImportFile.run({
      id: importFileId,
      righe_lette,
      righe_importate,
      esito,
      messaggio_errore
    })
  }
}

async function main() {
  const args = parseArgs()
  const capPath =
    args.capPath ||
    path.join(
      __dirname,
      '..',
      'gi_db_comuni-2026-01-31-6fcd8',
      'json'
    )
  const omiPath =
    args.omiPath ||
    path.join(__dirname, '..', 'omi')
  const dbPath =
    args.dbPath ||
    path.join(__dirname, '..', 'data', 'omi_official.sqlite')

  ensureDir(path.dirname(dbPath))

  const db = createOmiDb(dbPath)

  importAnagrafiche(db, capPath)
  importOmiFiles(db, omiPath, path.join(__dirname, '..'))

  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

