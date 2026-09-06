// Importa la popolazione residente per comune, per più anni, dal "Bilancio
// demografico" ISTAT (demo.istat.it) e popola la tabella `popolazione_comune`,
// usata dal report per il paragrafo "Andamento demografico" (popolazione in
// crescita/calo negli ultimi anni).
//
// DA LANCIARE UNA TANTUM (o una volta l'anno) SUL TUO SERVER, non da qui:
// questo ambiente di sviluppo non ha accesso libero a internet, quindi lo
// script va eseguito dove gira il backend vero, con:
//
//   node server/scripts/import-demografia.js
//
// Nessuna dipendenza esterna richiesta: l'estrazione dello ZIP è fatta a
// mano con i soli moduli nativi di Node (buffer + zlib), quindi lo script
// funziona identico su Windows, Linux o Mac senza bisogno di `unzip` o altri
// programmi installati sul sistema.
// I file scaricati sono ZIP con dentro un unico CSV nazionale per anno
// (tutti gli ~7900 comuni italiani in un solo file, qualche MB).
//
// AVVISO SUI NOMI DELLE COLONNE: a differenza dello script delle scuole (dove
// ho potuto verificare i nomi esatti delle colonne sulla pagina ufficiale),
// qui non ho potuto controllare il contenuto reale del CSV (è dentro un file
// ZIP binario, che non riesco a leggere da questo ambiente). I nomi delle
// colonne sotto sono la mia migliore stima basata sulla terminologia ISTAT
// standard. Se il primo lancio fallisce con "colonne non trovate", lo script
// stampa la lista delle intestazioni REALI del CSV: rimandamele e correggo
// FIELD_CANDIDATES al volo (stessa cosa già successa ed è stata risolta in
// un minuto con lo script delle scuole).

import zlib from 'node:zlib'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// --- CONFIGURAZIONE ---------------------------------------------------
// Ultimi N anni disponibili su demo.istat.it (verificato: selezionabili 2019-
// 2025 sul portale al momento della stesura di questo script). Aggiorna se
// nel frattempo sono usciti dati più recenti.
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025]
const urlForYear = (anno) => `https://demo.istat.it/data/p2/P2_${anno}_it_Comuni.zip`

const FIELD_CANDIDATES = {
  comune: ['DENOMINAZIONE', 'COMUNE', 'NOME COMUNE', 'DENOMINAZIONE COMUNE'],
  sesso: ['SESSO', 'GENERE'],
  popolazioneFine: [
    'POPOLAZIONE FINE PERIODO',
    'POPOLAZIONE AL 31 DICEMBRE',
    'POPOLAZIONE TOTALE AL 31 DICEMBRE',
    'POPOLAZIONE CENSITA AL 31 DICEMBRE',
    'POPOLAZIONE RESIDENTE AL 31 DICEMBRE'
  ]
}

function normalizeHeader(h) {
  return String(h || '').trim().replace(/^"|"$/g, '').toUpperCase()
}

function detectDelimiter(headerLine) {
  const semi = (headerLine.match(/;/g) || []).length
  const comma = (headerLine.match(/,/g) || []).length
  const tab = (headerLine.match(/\t/g) || []).length
  if (tab >= semi && tab >= comma) return '\t'
  return semi >= comma ? ';' : ','
}

function parseCsvLine(line, delimiter) {
  const fields = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      fields.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  fields.push(cur)
  return fields
}

// I CSV di demo.istat.it hanno una riga di titolo (es. "Bilancio demografico
// e popolazione residente al 31 dicembre 2020") prima della vera riga di
// intestazione con i nomi delle colonne: bisogna scansionare le prime righe
// e riconoscere quella giusta, non prendere semplicemente la prima riga non
// vuota. Una riga "è" l'intestazione solo se contiene ALMENO un campo che
// somiglia al nome comune E almeno un campo che somiglia alla popolazione:
// una riga di titolo (un solo campo, nessun delimitatore) o una riga di dati
// (valori numerici, non nomi di colonna) non soddisfano mai questa condizione.
function looksLikeHeaderRow(fields) {
  const normalized = fields.map(normalizeHeader)
  const hasComune = FIELD_CANDIDATES.comune.some((c) => normalized.some((h) => h.includes(c)))
  const hasPop = FIELD_CANDIDATES.popolazioneFine.some((c) => normalized.some((h) => h.includes(c)))
  return hasComune && hasPop
}

function findColumnIndex(headers, candidates) {
  const normalizedHeaders = headers.map(normalizeHeader)
  for (const candidate of candidates) {
    const idx = normalizedHeaders.findIndex((h) => h === candidate)
    if (idx !== -1) return idx
  }
  for (const candidate of candidates) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(candidate))
    if (idx !== -1) return idx
  }
  return -1
}

function decodeBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('iso-8859-1').decode(buf)
  }
}

function parseItalianNumber(raw) {
  if (raw == null) return NaN
  const cleaned = String(raw).trim().replace(/\./g, '').replace(',', '.')
  return Number(cleaned)
}

// --- Estrazione ZIP "a mano" (nessun programma esterno necessario) --------
// Implementazione minimale del formato ZIP: legge il central directory dalla
// fine del file, trova la voce .csv/.txt al suo interno e la decomprime. I
// file di demo.istat.it hanno una sola voce, quindi non serve altro.

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIR_SIGNATURE = 0x02014b50
const LOCAL_HEADER_SIGNATURE = 0x04034b50

function findEndOfCentralDirectory(buf) {
  const minPos = Math.max(0, buf.length - 65557) // 22 + max comment (65535)
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) return i
  }
  throw new Error('Il file scaricato non sembra un archivio ZIP valido (EOCD non trovato).')
}

function listZipEntries(buf) {
  const eocdPos = findEndOfCentralDirectory(buf)
  const totalEntries = buf.readUInt16LE(eocdPos + 10)
  let cdOffset = buf.readUInt32LE(eocdPos + 16)
  const entries = []
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(cdOffset) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error('Central directory dello ZIP non riconosciuta o corrotta.')
    }
    const compressionMethod = buf.readUInt16LE(cdOffset + 10)
    const compressedSize = buf.readUInt32LE(cdOffset + 20)
    const nameLen = buf.readUInt16LE(cdOffset + 28)
    const extraLen = buf.readUInt16LE(cdOffset + 30)
    const commentLen = buf.readUInt16LE(cdOffset + 32)
    const localHeaderOffset = buf.readUInt32LE(cdOffset + 42)
    const name = buf.toString('utf-8', cdOffset + 46, cdOffset + 46 + nameLen)
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset })
    cdOffset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function extractZipEntry(buf, entry) {
  const lhOffset = entry.localHeaderOffset
  if (buf.readUInt32LE(lhOffset) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`Local file header non riconosciuto per "${entry.name}".`)
  }
  const nameLen = buf.readUInt16LE(lhOffset + 26)
  const extraLen = buf.readUInt16LE(lhOffset + 28)
  const dataStart = lhOffset + 30 + nameLen + extraLen
  const compressedData = buf.subarray(dataStart, dataStart + entry.compressedSize)
  if (entry.compressionMethod === 0) return Buffer.from(compressedData)
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressedData)
  throw new Error(`Metodo di compressione ZIP non supportato (codice ${entry.compressionMethod}) per "${entry.name}".`)
}

// Scarica lo ZIP di un anno e ritorna il testo del CSV al suo interno,
// decodificato correttamente (vedi decodeBuffer).
async function downloadAndExtractCsv(anno) {
  const url = urlForYear(anno)
  console.log(`\n→ Scarico anno ${anno}: ${url}`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download fallito (HTTP ${response.status}) per ${url}`)
  }
  const buf = Buffer.from(await response.arrayBuffer())
  if (buf.length < 1000) {
    throw new Error(`Risposta troppo corta (${buf.length} byte) per l'anno ${anno}: l'URL probabilmente non è più valido.`)
  }

  const entries = listZipEntries(buf)
  const csvEntry = entries.find((e) => /\.(csv|txt)$/i.test(e.name))
  if (!csvEntry) {
    throw new Error(
      `Nessun file .csv/.txt trovato dentro lo ZIP dell'anno ${anno}. Contenuto: ${entries.map((e) => e.name).join(', ') || '(vuoto)'}`
    )
  }
  const csvBuf = extractZipEntry(buf, csvEntry)
  return decodeBuffer(csvBuf)
}

function parseYearCsv(text, anno) {
  const lines = text.split(/\r\n|\n|\r/)
  let headers = null
  let delimiter = ','
  let idxComune = -1
  let idxSesso = -1
  let idxPop = -1

  // comune -> { totaleRow: number|null, sommaTutte: number }
  const perComune = new Map()
  let rowCount = 0
  let preambleLinesSkipped = 0
  const maxPreambleLines = 25
  const skippedLinesForError = []

  for (const line of lines) {
    if (!line.trim()) continue

    if (!headers) {
      const candidateDelimiter = detectDelimiter(line)
      const candidateFields = parseCsvLine(line, candidateDelimiter)

      if (!looksLikeHeaderRow(candidateFields)) {
        // Riga di titolo/nota prima della vera intestazione (comune su
        // demo.istat.it): la saltiamo e continuiamo a cercare.
        preambleLinesSkipped++
        skippedLinesForError.push(line)
        if (preambleLinesSkipped > maxPreambleLines) {
          throw new Error(
            `Anno ${anno}: non trovo una riga di intestazione valida nelle prime ${maxPreambleLines} righe non vuote del CSV. Prime righe incontrate:\n${skippedLinesForError.join('\n')}`
          )
        }
        continue
      }

      delimiter = candidateDelimiter
      headers = candidateFields
      idxComune = findColumnIndex(headers, FIELD_CANDIDATES.comune)
      idxSesso = findColumnIndex(headers, FIELD_CANDIDATES.sesso)
      idxPop = findColumnIndex(headers, FIELD_CANDIDATES.popolazioneFine)

      if (idxComune === -1 || idxPop === -1) {
        console.error(`✗ Anno ${anno}: non trovo le colonne attese. Intestazioni reali del CSV:`)
        console.error(headers.join(' | '))
        throw new Error(
          'Colonne comune/popolazione non riconosciute: rimanda questa lista di intestazioni per correggere FIELD_CANDIDATES nello script.'
        )
      }
      console.log(`  Anno ${anno} — colonne: comune=[${headers[idxComune]}] sesso=[${idxSesso !== -1 ? headers[idxSesso] : 'n/d'}] popolazione=[${headers[idxPop]}]${preambleLinesSkipped ? ` (saltate ${preambleLinesSkipped} righe di titolo/nota prima dell'intestazione)` : ''}`)
      continue
    }

    rowCount++
    const fields = parseCsvLine(line, delimiter)
    const comune = fields[idxComune]?.trim()
    const pop = parseItalianNumber(fields[idxPop])
    if (!comune || !Number.isFinite(pop)) continue

    const key = comune.toUpperCase()
    if (!perComune.has(key)) {
      perComune.set(key, { comune, totaleRow: null, sommaTutte: 0 })
    }
    const entry = perComune.get(key)
    entry.sommaTutte += pop

    if (idxSesso !== -1) {
      const sessoVal = normalizeHeader(fields[idxSesso])
      if (sessoVal.includes('TOTAL')) {
        entry.totaleRow = pop
      }
    } else {
      // Nessuna colonna sesso: ogni riga è già un totale per comune.
      entry.totaleRow = pop
    }
  }

  console.log(`  ✓ Anno ${anno}: ${rowCount} righe lette, ${perComune.size} comuni.`)

  const result = new Map()
  for (const [key, entry] of perComune) {
    const popolazione = entry.totaleRow !== null ? entry.totaleRow : entry.sommaTutte
    result.set(key, { comune: entry.comune, popolazione: Math.round(popolazione) })
  }
  return result
}

async function main() {
  const dbModulePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db.js')
  const { upsertPopolazioneComune } = await import(pathToFileURL(dbModulePath).href)

  let totalRowsWritten = 0
  for (const anno of YEARS) {
    const csvText = await downloadAndExtractCsv(anno)
    const perComune = parseYearCsv(csvText, anno)
    for (const { comune, popolazione } of perComune.values()) {
      upsertPopolazioneComune({ comune, anno, popolazione })
      totalRowsWritten++
    }
  }

  console.log(`\n✓ Fatto. ${totalRowsWritten} righe (comune × anno) scritte in popolazione_comune.`)
  console.log('  Esempio di verifica: apri il DB e lancia')
  console.log(`  SELECT * FROM popolazione_comune WHERE comune LIKE 'PESCARA%' ORDER BY anno;`)
}

main().catch((err) => {
  console.error('\n✗ Import fallito:', err.message)
  process.exit(1)
})
