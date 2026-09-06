// Importa il numero di scuole per comune (Scuola in Chiaro / MIUR - Open
// Data Istruzione) e popola la tabella `scuole_comune`, usata dal report
// per la sezione "Scuole nel comune".
//
// DA LANCIARE UNA TANTUM (o una volta l'anno) SUL TUO SERVER, non da qui:
// questo ambiente di sviluppo non ha accesso libero a internet, quindi lo
// script va eseguito dove gira il backend vero, con:
//
//   node server/scripts/import-scuole.js
//
// I file sorgente sono piccoli (~13Mb + ~2Mb), quindi lo script li scarica
// per intero in memoria: pochi secondi anche su una connessione normale.
//
// IMPORTANTE SULL'URL: il portale dati.istruzione.it rinomina il file ogni
// anno scolastico (es. SCUANAGRAFESTAT20252620250901.csv per il 2025/26).
// Se gli URL qui sotto rispondono 404, vai su:
//   https://dati.istruzione.it/opendata/opendata/catalogo/elements1/?area=Scuole
// cerca "Informazioni anagrafiche scuole statali" (dataset SCUANAGRAFESTAT) e
// "...scuole paritarie" (dataset SCUANAGRAFEPAR), apri la scheda, tab CSV, e
// copia il link della riga con l'anno scolastico più recente.
// Nota: il nome del file segue lo schema <DATASET><AASS><AASS+1><DATA>.csv,
// es. 20252620250901 = anno scolastico 2025/26, dati al 01/09/2025.

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// --- CONFIGURAZIONE: verifica/aggiorna questi URL prima di lanciare -------
// (URL verificati il 06/07/2026 — entrambi i CSV sono in realtà piccoli,
// ~13 Mb le statali e ~2 Mb le paritarie: molto più leggeri della stima
// iniziale, il download richiede pochi secondi anche da una connessione
// normale.)
const SOURCES = [
  {
    label: 'Scuole statali',
    url: 'https://dati.istruzione.it/opendata/opendata/catalogo/elements1/leaf/SCUANAGRAFESTAT20252620250901.csv'
  },
  {
    label: 'Scuole paritarie',
    url: 'https://dati.istruzione.it/opendata/opendata/catalogo/elements1/leaf/SCUANAGRAFEPAR20252620250901.csv'
  }
]

// Nomi di colonna plausibili per ciascun campo che ci serve, dal più
// specifico al più generico: il parser prende la prima intestazione del CSV
// che contiene (case-insensitive) una di queste stringhe. I dataset MIUR
// cambiano leggermente nome alle colonne di anno in anno, quindi questo
// meccanismo "tollerante" evita che lo script si rompa per un rename.
const FIELD_CANDIDATES = {
  comune: ['DESCRIZIONECOMUNE', 'COMUNE'],
  provincia: ['DESCRIZIONEPROVINCIA', 'PROVINCIA', 'SIGLAPROVINCIA'],
  tipologia: ['DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA', 'DESCRIZIONETIPOLOGIA', 'ORDINESCUOLA', 'GRADOISTRUZIONE']
}

function normalizeHeader(h) {
  return String(h || '').trim().replace(/^"|"$/g, '').toUpperCase()
}

// Autodetect del separatore: i CSV open-data italiani usano quasi sempre
// ';', ma alcuni export usano ','. Guardiamo quale compare più spesso nella
// prima riga (l'intestazione).
function detectDelimiter(headerLine) {
  const semi = (headerLine.match(/;/g) || []).length
  const comma = (headerLine.match(/,/g) || []).length
  return semi >= comma ? ';' : ','
}

// Parser CSV minimale ma corretto per campi tra virgolette con delimitatore
// o virgolette interne (le righe MIUR di solito non ne hanno, ma meglio non
// rompersi su un indirizzo con virgola dentro le virgolette).
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

// I portali open-data del MIUR spesso pubblicano i CSV in ISO-8859-1
// (Latin-1) invece che UTF-8: senza gestirlo esplicitamente, i comuni con
// accenti (Perugia va bene, ma "L'Aquila", "Cinisello Balsamo"... in
// generale qualunque nome con apostrofo/accento) verrebbero letti con
// caratteri corrotti. Proviamo prima UTF-8 in modalità stretta: se fallisce
// (byte non validi), decodifichiamo come Latin-1.
function decodeBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('iso-8859-1').decode(buf)
  }
}

function classifyTipologia(raw) {
  const t = String(raw || '').toUpperCase()
  if (t.includes('INFANZIA')) return 'infanzia'
  if (t.includes('PRIMARIA')) return 'primaria'
  if (t.includes('SECONDARIA') && (t.includes('I GRADO') || t.includes('1 GRADO') || t.includes('MEDIA'))) return 'secondaria1'
  if (t.includes('SECONDARIA') && (t.includes('II GRADO') || t.includes('2 GRADO') || t.includes('SUPERIORE'))) return 'secondaria2'
  return null
}

async function importSource(source, aggregate) {
  console.log(`\n→ Scarico: ${source.label} (${source.url})`)
  const response = await fetch(source.url)
  if (!response.ok) {
    throw new Error(`Download fallito (HTTP ${response.status}) per ${source.url}`)
  }
  const buf = new Uint8Array(await response.arrayBuffer())
  if (buf.length < 100) {
    throw new Error(`Risposta troppo corta (${buf.length} byte): l'URL probabilmente non punta più al CSV. Controlla il link sul portale.`)
  }
  const text = decodeBuffer(buf)
  if (text.trim().startsWith('<')) {
    throw new Error(`La risposta sembra HTML, non CSV (l'URL probabilmente è cambiato o è sbagliato). Prime righe: ${text.slice(0, 200)}`)
  }
  const lines = text.split(/\r\n|\n|\r/)

  let headers = null
  let delimiter = ','
  let idxComune = -1
  let idxProvincia = -1
  let idxTipologia = -1
  let rowCount = 0
  let matchedCount = 0

  for (const line of lines) {
    if (!line.trim()) continue

    if (!headers) {
      delimiter = detectDelimiter(line)
      headers = parseCsvLine(line, delimiter)
      idxComune = findColumnIndex(headers, FIELD_CANDIDATES.comune)
      idxProvincia = findColumnIndex(headers, FIELD_CANDIDATES.provincia)
      idxTipologia = findColumnIndex(headers, FIELD_CANDIDATES.tipologia)

      if (idxComune === -1 || idxTipologia === -1) {
        console.error('✗ Non trovo le colonne attese in questo CSV. Intestazioni trovate:')
        console.error(headers.join(' | '))
        throw new Error(
          'Colonne comune/tipologia non riconosciute: apri il CSV manualmente, individua i nomi esatti e aggiungili a FIELD_CANDIDATES in questo script.'
        )
      }
      console.log(`  Colonne: comune=[${headers[idxComune]}] provincia=[${headers[idxProvincia] ?? 'n/d'}] tipologia=[${headers[idxTipologia]}]`)
      continue
    }

    rowCount++
    const fields = parseCsvLine(line, delimiter)
    const comune = fields[idxComune]?.trim()
    const provincia = idxProvincia !== -1 ? fields[idxProvincia]?.trim() : null
    const tipo = classifyTipologia(fields[idxTipologia])
    if (!comune || !tipo) continue

    matchedCount++
    const key = comune.toUpperCase()
    if (!aggregate.has(key)) {
      aggregate.set(key, { comune, provincia, infanzia: 0, primaria: 0, secondaria1: 0, secondaria2: 0 })
    }
    aggregate.get(key)[tipo]++
    if (provincia && !aggregate.get(key).provincia) aggregate.get(key).provincia = provincia

    if (rowCount % 20000 === 0) {
      process.stdout.write(`  ...${rowCount} righe lette\r`)
    }
  }

  console.log(`  ✓ ${rowCount} righe lette, ${matchedCount} classificate correttamente.`)
}

async function main() {
  const aggregate = new Map()

  for (const source of SOURCES) {
    await importSource(source, aggregate)
  }

  if (aggregate.size === 0) {
    console.error('\n✗ Nessun comune trovato: controlla gli URL/colonne sopra prima di riprovare.')
    process.exit(1)
  }

  // Import dinamico dopo che il file esiste nel path giusto rispetto a dove
  // viene lanciato lo script (server/db.js accanto a questo file).
  const dbModulePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db.js')
  const { upsertScuoleComune } = await import(pathToFileURL(dbModulePath).href)

  console.log(`\n→ Scrivo ${aggregate.size} comuni nel database...`)
  for (const row of aggregate.values()) {
    upsertScuoleComune(row)
  }

  console.log(`✓ Fatto. ${aggregate.size} comuni importati in scuole_comune.`)
  console.log('  Esempio di verifica: apri il DB e lancia')
  console.log(`  SELECT * FROM scuole_comune WHERE comune LIKE 'PESCARA%';`)
}

main().catch((err) => {
  console.error('\n✗ Import fallito:', err.message)
  process.exit(1)
})
