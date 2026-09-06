import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '..', 'data', 'omi_official.sqlite')
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const zonesPerSemester = db
  .prepare(
    `
    SELECT s.codice_semestre, COUNT(*) as total_zones
    FROM omi_zones z
    JOIN omi_semesters s ON s.id = z.id_semestre
    GROUP BY s.codice_semestre
    ORDER BY total_zones DESC
  `
  )
  .all()

const valuesPerSemester = db
  .prepare(
    `
    SELECT s.codice_semestre, COUNT(*) as total_values
    FROM omi_values v
    JOIN omi_zones z ON z.id = v.id_zone
    JOIN omi_semesters s ON s.id = z.id_semestre
    GROUP BY s.codice_semestre
    ORDER BY total_values DESC
  `
  )
  .all()

const values20251 = db
  .prepare(
    `
    SELECT COUNT(*) as total_values_20251
    FROM omi_values v
    JOIN omi_zones z ON z.id = v.id_zone
    JOIN omi_semesters s ON s.id = z.id_semestre
    WHERE s.codice_semestre = '2025_1'
  `
  )
  .get()

const sampleZones = db
  .prepare(
    `
    SELECT z.id, z.codice_zona_omi, z.id_comune, s.codice_semestre
    FROM omi_zones z
    JOIN omi_semesters s ON s.id = z.id_semestre
    LIMIT 5
  `
  )
  .all()

const totalValues = db
  .prepare(
    `
    SELECT COUNT(*) as total_values
    FROM omi_values
  `
  )
  .get()

const valuesWithoutZone = db
  .prepare(
    `
    SELECT COUNT(*) as total_values_without_zone
    FROM omi_values v
    LEFT JOIN omi_zones z ON z.id = v.id_zone
    WHERE z.id IS NULL
  `
  )
  .get()

const zonesWithoutComune = db
  .prepare(
    `
    SELECT COUNT(*) as total_zones_without_comune
    FROM omi_zones
    WHERE id_comune IS NULL
  `
  )
  .get()

const importFilesCount = db
  .prepare(
    `
    SELECT COUNT(*) as total_import_files
    FROM omi_import_files
  `
  )
  .get()

const importFilesSample = db
  .prepare(
    `
    SELECT path_relativo, tipo_file, esito, righe_lette, righe_importate, messaggio_errore
    FROM omi_import_files
    ORDER BY path_relativo, tipo_file
    LIMIT 10
  `
  )
  .all()

const zones20251WithoutComune = db
  .prepare(
    `
    SELECT COUNT(*) as total_zones_20251_without_comune
    FROM omi_zones z
    JOIN omi_semesters s ON s.id = z.id_semestre
    WHERE s.codice_semestre = '2025_1'
      AND z.id_comune IS NULL
  `
  )
  .get()

const zones20251WithoutComuneSample = db
  .prepare(
    `
    SELECT z.id, z.codice_zona_omi, z.id_comune, s.codice_semestre, z.id_file_import, f.path_relativo
    FROM omi_zones z
    JOIN omi_semesters s ON s.id = z.id_semestre
    LEFT JOIN omi_import_files f ON f.id = z.id_file_import
    WHERE s.codice_semestre = '2025_1'
      AND z.id_comune IS NULL
    LIMIT 5
  `
  )
  .all()

const importFiles20251 = db
  .prepare(
    `
    SELECT path_relativo, tipo_file, esito, righe_lette, righe_importate
    FROM omi_import_files
    WHERE path_relativo LIKE 'omi\\\\QI1335%20251_%'
    ORDER BY path_relativo, tipo_file
  `
  )
  .all()

const getComuneByIstat = db.prepare(`
  SELECT id, codice_comune, denominazione_comune
  FROM comuni
  WHERE codice_comune = ?
`)

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

const omiRoot = path.join(__dirname, '..', 'omi')
const sampleZoneMappings = []

if (fs.existsSync(omiRoot)) {
  const dirEntries = fs.readdirSync(omiRoot, { withFileTypes: true })
  for (const dirEntry of dirEntries) {
    if (!dirEntry.isDirectory()) continue
    const dirPath = path.join(omiRoot, dirEntry.name)
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const fileEntry of files) {
      if (!fileEntry.isFile()) continue
      const name = fileEntry.name
      if (!name.toUpperCase().includes('ZONE')) continue
      if (!name.includes('20251')) continue
      const fullPath = path.join(dirPath, name)
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '')
      if (lines.length <= 1) continue
      const headerLine = lines[1]
      const headers = headerLine.split(';').map((h) => h.trim())
      for (let i = 2; i < lines.length && sampleZoneMappings.length < 5; i += 1) {
        const line = lines[i]
        if (!line.trim()) continue
        const cols = line.split(';')
        if (cols.length < headers.length) continue
        const row = {}
        headers.forEach((h, idx) => {
          row[h] = cols[idx]
        })
        const rawComuneIstat = row.Comune_ISTAT
        const normalizedComuneIstat = normalizeOmiComuneIstat(rawComuneIstat)
        if (!normalizedComuneIstat) continue
        const comune = getComuneByIstat.get(normalizedComuneIstat)
        sampleZoneMappings.push({
          file: path.relative(omiRoot, fullPath),
          rawComuneIstat,
          normalizedComuneIstat,
          comuneLookup: comune || null
        })
      }
      if (sampleZoneMappings.length >= 5) break
    }
    if (sampleZoneMappings.length >= 5) break
  }
}

console.log('--- Zones per semester ---')
console.log(JSON.stringify(zonesPerSemester, null, 2))
console.log('--- Values per semester ---')
console.log(JSON.stringify(valuesPerSemester, null, 2))
console.log('--- Sample zones ---')
console.log(JSON.stringify(sampleZones, null, 2))
console.log('--- Totals / consistency ---')
console.log(
  JSON.stringify(
    {
      totalValues,
      values20251,
      valuesWithoutZone,
      zonesWithoutComune,
      importFilesCount,
      importFilesSample
    },
    null,
    2
  )
)
console.log('--- Zones 2025_1 with id_comune IS NULL ---')
console.log(JSON.stringify(zones20251WithoutComune, null, 2))
console.log('--- Sample zones 2025_1 with id_comune IS NULL ---')
console.log(JSON.stringify(zones20251WithoutComuneSample, null, 2))
console.log('--- Sample Comune_ISTAT mappings from ZONE 2025_1 CSV ---')
console.log(JSON.stringify(sampleZoneMappings, null, 2))
console.log('--- Import files overview 2025_1 ---')
console.log(JSON.stringify(importFiles20251, null, 2))

const testComuneIstat = '13066049'
const testZonaCode = 'B1'
const normalizedTestComune = normalizeOmiComuneIstat(testComuneIstat)
const comuneForTest = getComuneByIstat.get(normalizedTestComune)
let zonaForTest = null
if (comuneForTest) {
  const semestre20251 = db
    .prepare(
      `
      SELECT id FROM omi_semesters WHERE codice_semestre = '2025_1'
    `
    )
    .get()
  if (semestre20251) {
    zonaForTest = db
      .prepare(
        `
        SELECT id, id_comune, codice_zona_omi
        FROM omi_zones
        WHERE id_semestre = ? AND id_comune = ? AND codice_zona_omi = ?
      `
      )
      .get(semestre20251.id, comuneForTest.id, testZonaCode)
  }
}
console.log('--- Manual test mapping 13066049 / B1 for 2025_1 ---')
console.log(
  JSON.stringify(
    {
      testComuneIstat,
      normalizedTestComune,
      comuneForTest,
      zonaForTest
    },
    null,
    2
  )
)

const legacySemesterCode = '1335_2'
const shouldCleanupLegacy =
  process.env.CLEANUP_OMI_LEGACY === '1' || process.argv.includes('--cleanup-legacy')

if (shouldCleanupLegacy) {
  console.log('--- Legacy cleanup: starting ---')
  const countsBefore = {
    semesters1335_2: db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM omi_semesters
        WHERE codice_semestre = ?
      `
      )
      .get(legacySemesterCode).c,
    zones1335_2: db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM omi_zones z
        JOIN omi_semesters s ON s.id = z.id_semestre
        WHERE s.codice_semestre = ?
      `
      )
      .get(legacySemesterCode).c,
    zonesWithoutComune: db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM omi_zones
        WHERE id_comune IS NULL
      `
      )
      .get().c,
    values1335_2: db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM omi_values v
        JOIN omi_zones z ON z.id = v.id_zone
        JOIN omi_semesters s ON s.id = z.id_semestre
        WHERE s.codice_semestre = ?
      `
      )
      .get(legacySemesterCode).c
  }
  console.log('--- Legacy cleanup: BEFORE ---')
  console.log(JSON.stringify(countsBefore, null, 2))

  const cleanupTx = db.transaction(() => {
    db.prepare(
      `
      DELETE FROM omi_values
      WHERE id_zone IN (
        SELECT z.id
        FROM omi_zones z
        JOIN omi_semesters s ON s.id = z.id_semestre
        WHERE s.codice_semestre = ?
      )
    `
    ).run(legacySemesterCode)

    db.prepare(
      `
      DELETE FROM omi_values
      WHERE id_zone IN (
        SELECT id
        FROM omi_zones
        WHERE id_comune IS NULL
      )
    `
    ).run()

    db.prepare(
      `
      DELETE FROM omi_zones
      WHERE id_semestre IN (
          SELECT id FROM omi_semesters WHERE codice_semestre = ?
        )
        OR id_comune IS NULL
    `
    ).run(legacySemesterCode)

    db.prepare(
      `
      DELETE FROM omi_semesters
      WHERE codice_semestre = ?
    `
    ).run(legacySemesterCode)
  })

  cleanupTx()

  const countsAfter = {
    semesters1335_2: db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM omi_semesters
        WHERE codice_semestre = ?
      `
      )
      .get(legacySemesterCode).c,
    zones1335_2: db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM omi_zones z
        JOIN omi_semesters s ON s.id = z.id_semestre
        WHERE s.codice_semestre = ?
      `
      )
      .get(legacySemesterCode).c,
    zonesWithoutComune: db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM omi_zones
        WHERE id_comune IS NULL
      `
      )
      .get().c,
    values1335_2: db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM omi_values v
        JOIN omi_zones z ON z.id = v.id_zone
        JOIN omi_semesters s ON s.id = z.id_semestre
        WHERE s.codice_semestre = ?
      `
      )
      .get(legacySemesterCode).c
  }
  console.log('--- Legacy cleanup: AFTER ---')
  console.log(JSON.stringify(countsAfter, null, 2))
}

const finalValuesWithoutZone = db
  .prepare(
    `
    SELECT COUNT(*) as values_without_zone
    FROM omi_values v
    LEFT JOIN omi_zones z ON z.id = v.id_zone
    WHERE z.id IS NULL
  `
  )
  .get()

const finalZonesWithoutComune = db
  .prepare(
    `
    SELECT COUNT(*) as zones_without_comune
    FROM omi_zones
    WHERE id_comune IS NULL
  `
  )
  .get()

console.log('--- Final consistency check ---')
console.log(
  JSON.stringify(
    {
      values_without_zone: finalValuesWithoutZone.values_without_zone,
      zones_without_comune: finalZonesWithoutComune.zones_without_comune
    },
    null,
    2
  )
)

db.close()
