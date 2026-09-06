#!/usr/bin/env node
/**
 * purge-test-users.mjs
 * Elenca (o cancella) gli utenti nel DB Better Auth locale (data/dev.sqlite).
 *
 * Uso:
 *   node scripts/purge-test-users.mjs                 → solo elenco, nessuna modifica
 *   node scripts/purge-test-users.mjs --delete-all     → cancella TUTTI gli utenti
 *   node scripts/purge-test-users.mjs --keep email@x.it → cancella tutti tranne l'email indicata
 *
 * Cancella a cascata anche session e account collegati (PRAGMA foreign_keys attivo).
 */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '..', 'data', 'dev.sqlite')

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const users = db.prepare('SELECT id, name, email, createdAt FROM user ORDER BY createdAt').all()

console.log(`\n📋 Utenti trovati in ${dbPath}: ${users.length}\n`)
for (const u of users) {
  console.log(`  - ${u.email}  (${u.name || 'senza nome'})  creato: ${u.createdAt}`)
}

const deleteAll = process.argv.includes('--delete-all')
const keepIdx = process.argv.indexOf('--keep')
const keepEmail = keepIdx !== -1 ? process.argv[keepIdx + 1] : null

if (!deleteAll && !keepEmail) {
  console.log('\nNessuna modifica effettuata (modalità solo elenco).')
  console.log('Per cancellare tutti: node scripts/purge-test-users.mjs --delete-all')
  console.log('Per cancellare tutti tranne uno: node scripts/purge-test-users.mjs --keep email@esempio.it\n')
  process.exit(0)
}

let result
if (deleteAll) {
  result = db.prepare('DELETE FROM user').run()
} else {
  const target = users.find(u => u.email.toLowerCase() === keepEmail.toLowerCase())
  if (!target) {
    console.error(`\n❌ Nessun utente trovato con email "${keepEmail}". Nessuna cancellazione eseguita.\n`)
    process.exit(1)
  }
  result = db.prepare('DELETE FROM user WHERE email != ?').run(target.email)
  console.log(`\n✓ Mantenuto: ${target.email}`)
}

console.log(`✅ Cancellati ${result.changes} utenti (session/account collegati rimossi a cascata).\n`)

const remaining = db.prepare('SELECT email FROM user').all()
console.log(`Utenti rimasti: ${remaining.length}`)
for (const u of remaining) console.log(`  - ${u.email}`)
