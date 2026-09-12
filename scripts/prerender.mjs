// Prerendering statico per SEO/GEO.
//
// Perché: i crawler delle AI generative (GPTBot, ClaudeBot, PerplexityBot, ecc.)
// e molti motori tradizionali non eseguono JavaScript e leggono solo l'HTML
// restituito dal server. Questa app è una SPA React puramente client-side, quindi
// oggi ogni pagina restituisce lo stesso index.html vuoto a chi non esegue JS.
//
// Questo script, eseguito DOPO `vite build` (vedi package.json: "build": "vite
// build && node scripts/prerender.mjs"), apre ogni rotta nota con un vero browser
// headless (Chromium via Playwright — @playwright/test è già una devDependency),
// aspetta che il bundle React finisca di renderizzare, e salva l'HTML risultante
// come file statico dist/<rotta>/index.html. nginx (vedi nginx.conf, `try_files
// $uri $uri/ /index.html`) servirà questi file statici quando esistono, prima di
// cadere sul fallback SPA — quindi un crawler senza JS vede contenuto reale,
// mentre un utente reale continua a caricare il bundle React che poi fa
// l'hydrate sopra l'HTML statico.
//
// Note operative:
// - Non richiede un backend live: eventuali fetch verso /api (es. dati di
//   mercato città) falliscono silenziosamente in fase di prerender (il codice
//   in App.jsx già gestisce il fallback con .catch), quindi la pagina
//   prerenderizzata avrà semplicemente quella sezione vuota — verrà comunque
//   ripopolata lato client dopo l'hydrate per un utente reale.
// - Le rotte utente/dinamiche (wizard di valutazione, /profilo, /admin*,
//   reset/crea password) sono escluse di proposito: non hanno valore SEO e
//   spesso richiedono uno stato non disponibile in fase di build.
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '..', 'dist')
const PORT = 4173 + Math.floor(Math.random() * 1000)

const BLOG_SLUGS = [
  'come-capire-valutazione-immobile-realistica',
  'prezzi-case-italia-2024',
  'errori-che-abbassano-valore-immobile',
  'cosa-cercano-acquirenti-in-casa',
  'lavori-che-aumentano-valore-casa',
  'tasso-mutuo-e-prezzo-di-vendita',
  'vendere-o-mettere-a-reddito',
  'documenti-per-vendita-casa',
  'preparare-casa-per-le-visite',
  'prima-impressione-nella-vendita-di-casa'
]

// Città con pagina dedicata e dati di mercato reali. Tenuto in sync a mano
// con FEATURED_CITIES in src/App.jsx (stesso pattern già usato per
// FAQ_PAGE_ITEMS): deve combaciare con lo slug usato in
// /valutazione-casa-:slug e con il comune passato a getMarketData nel
// backend (server/services/realAdvisorMarketData.js).
const CITY_SLUGS = [
  'pescara',
  'roma',
  'milano',
  'napoli',
  'torino',
  'bologna',
  'firenze',
  'bari',
  'chieti',
  'teramo'
]

const ROUTES = [
  '/home',
  '/blog',
  ...BLOG_SLUGS.map((slug) => `/blog/${slug}`),
  ...CITY_SLUGS.map((slug) => `/valutazione-casa-${slug}`),
  '/domande-frequenti',
  '/contatti',
  '/centro-assistenza',
  '/privacy',
  '/termini-di-utilizzo',
  '/cookie-consenso'
]

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
}

// Server statico minimale con fallback SPA (equivalente a `try_files $uri
// $uri/ /index.html` di nginx), usato solo per servire dist/ al browser
// headless durante il prerendering. Nessuna dipendenza nuova aggiunta.
function createStaticServer(rootDir) {
  return createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(req.url.split('?')[0])
      let filePath = path.join(rootDir, urlPath)

      let fileStat = null
      try {
        fileStat = await stat(filePath)
      } catch (e) {
        fileStat = null
      }

      if (fileStat && fileStat.isDirectory()) {
        filePath = path.join(filePath, 'index.html')
        try {
          fileStat = await stat(filePath)
        } catch (e) {
          fileStat = null
        }
      }

      if (!fileStat) {
        filePath = path.join(rootDir, 'index.html')
      }

      const data = await readFile(filePath)
      const ext = path.extname(filePath)
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
      res.end(data)
    } catch (err) {
      res.writeHead(500)
      res.end('Internal error')
    }
  })
}

async function main() {
  try {
    await stat(DIST_DIR)
  } catch (e) {
    console.error(`[prerender] Cartella ${DIST_DIR} non trovata. Esegui prima "vite build".`)
    process.exitCode = 1
    return
  }

  const server = createStaticServer(DIST_DIR)
  await new Promise((resolve) => server.listen(PORT, resolve))
  const baseUrl = `http://127.0.0.1:${PORT}`
  console.log(`[prerender] Server statico avviato su ${baseUrl}`)

  const launchOptions = { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  // In Docker (Alpine) usiamo il Chromium di sistema installato via apk,
  // invece del Chromium bundle di Playwright (spesso incompatibile con
  // musl libc). Vedi Dockerfile.frontend, PRERENDER_CHROMIUM_PATH.
  if (process.env.PRERENDER_CHROMIUM_PATH) {
    launchOptions.executablePath = process.env.PRERENDER_CHROMIUM_PATH
  }

  const browser = await chromium.launch(launchOptions)
  let okCount = 0
  let failCount = 0

  try {
    for (const route of ROUTES) {
      const page = await browser.newPage()
      // Il sito carica Google tag (gtag.js) da index.html: senza questo
      // blocco, ogni pagina prerenderizzata durante la build invierebbe un
      // pageview reale a Google Analytics per ogni build, inquinando i dati
      // con visite fittizie dalla macchina di build invece che da utenti
      // veri. Blocchiamo qui la richiesta di rete, non lato App (più
      // affidabile: funziona anche se in futuro si aggiungono altri script
      // di tracking in index.html).
      await page.route(/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/, (route2) =>
        route2.abort()
      )
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 30000 })
        // Margine extra per gli useEffect che aggiornano title/meta/JSON-LD
        // dopo il primo render (dipendono da stato impostato in un effect
        // successivo al mount, quindi arrivano un tick dopo networkidle).
        await page.waitForTimeout(300)

        const html = await page.content()
        const outDir = path.join(DIST_DIR, route.replace(/^\//, ''))
        await mkdir(outDir, { recursive: true })
        await writeFile(path.join(outDir, 'index.html'), html, 'utf-8')

        // La home ('/') deve sovrascrivere anche dist/index.html, perché è
        // quello che nginx serve per il dominio nudo prima del redirect
        // client-side a /home, ed è anche il fallback SPA di default.
        if (route === '/home') {
          await writeFile(path.join(DIST_DIR, 'index.html'), html, 'utf-8')
        }

        console.log(`[prerender] OK  ${route}`)
        okCount += 1
      } catch (err) {
        console.error(`[prerender] FAIL ${route}:`, err.message)
        failCount += 1
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
    server.close()
  }

  console.log(`[prerender] Completato: ${okCount} ok, ${failCount} falliti su ${ROUTES.length} rotte.`)
  if (failCount > 0) {
    // Non blocchiamo la build per una singola rotta fallita (es. rete assente
    // in un ambiente di build isolato): meglio un deploy con N-1 pagine
    // prerenderizzate che nessun deploy.
    console.warn('[prerender] Attenzione: alcune rotte non sono state prerenderizzate, controllare i log sopra.')
  }
}

main().catch((err) => {
  console.error('[prerender] Errore fatale:', err)
  process.exitCode = 1
})
