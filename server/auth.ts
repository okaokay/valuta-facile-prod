import { betterAuth } from 'better-auth'
import { magicLink } from 'better-auth/plugins'
import { Kysely, SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { sendTransactionalEmail, addSubscriber } from './services/listmonk.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Kysely instance separata per Better Auth — punta allo stesso file SQLite
const sqliteDb = new Database(path.join(__dirname, '..', 'data', 'dev.sqlite'))

// Crea le tabelle Better Auth se non esistono
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS "session" (
    id TEXT PRIMARY KEY,
    expiresAt TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS "account" (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt TEXT,
    refreshTokenExpiresAt TEXT,
    scope TEXT,
    password TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS "verification" (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

const kyselyDb = new Kysely<any>({ dialect: new SqliteDialect({ database: sqliteDb }) })

export const auth = betterAuth({
  database: {
    db: kyselyDb,
    type: 'sqlite'
  },
  baseURL: process.env.APP_BASE_URL || 'http://localhost:4001',
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }: { user: any; url: string }) => {
      // Riusiamo lo stesso meccanismo di token/link per due casi diversi:
      // - recupero password "normale" (utente che ha dimenticato la password)
      // - primo accesso dopo un pagamento (redirectTo punta a /crea-password)
      // Distinguiamo guardando l'URL di destinazione per scegliere il template email giusto.
      const isCreateFlow = url.includes('/crea-password')
      console.log(`[better-auth] ${isCreateFlow ? 'Crea password' : 'Reset password'} per ${user.email}: ${url}`)
      try {
        if (isCreateFlow) {
          await sendTransactionalEmail(user.email, 'crea-password', {
            nome: user.name || user.email.split('@')[0],
            set_password_url: url
          })
        } else {
          await sendTransactionalEmail(user.email, 'reset-password', {
            nome: user.name || user.email.split('@')[0],
            reset_url: url
          })
        }
      } catch (err) {
        console.error('[better-auth] Errore invio email reset/crea password via listmonk:', err)
      }
    }
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        console.log(`[better-auth] Magic link per ${email}: ${url}`)
        try {
          await sendTransactionalEmail(email, 'magic-link-video', {
            nome: email.split('@')[0],
            magic_link: url,
            report_url: (process.env.APP_FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '') + '/profilo'
          })
        } catch (err) {
          console.error('[better-auth] Errore invio magic link via listmonk:', err)
        }
      }
    })
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: { enabled: true, maxAge: 5 * 60 }
  },
  trustedOrigins: (process.env.ADMIN_ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim()),
  databaseHooks: {
    user: {
      create: {
        after: async (user: any) => {
          if (!user.email) return
          try {
            // Il subscriber deve esistere su listmonk PRIMA di potergli inviare
            // una email transazionale via /api/tx (altrimenti listmonk risponde
            // "Subscriber not found"), quindi va creato per primo.
            await addSubscriber(user.email, user.name, [Number(process.env.LISTMONK_LIST_TUTTI_UTENTI)])
            await sendTransactionalEmail(user.email, 'welcome', { nome: user.name })
          } catch (err) {
            console.error('[auth] Errore email benvenuto:', err)
          }
        }
      }
    }
  }
})

// Helper server-side: recupera un utente esistente per id (nessuna creazione).
// Usato dal webhook Stripe per accreditare l'utente che ha AVVIATO il pagamento
// (id salvato in metadata al momento della create-session), evitando di doversi
// affidare all'email restituita da Stripe Checkout — che può differire da quella
// dell'account loggato (autocompletamento, Stripe Link, refuso, ecc.).
export async function getUserById(id: string): Promise<{ id: string; name: string; email: string } | null> {
  const existing = await kyselyDb
    .selectFrom('user')
    .select(['id', 'name', 'email'])
    .where('id', '=', id)
    .executeTakeFirst()
  return (existing as { id: string; name: string; email: string } | undefined) || null
}

// Helper server-side: trova o crea utente per email
// Usato da payment.ts e report.ts per auto-account dopo pagamento/video
export async function findOrCreateUserByEmail(email: string): Promise<{ id: string; name: string; email: string; isNew: boolean }> {
  // 1. Cerca l'utente nel DB Better Auth via Kysely
  const existing = await kyselyDb
    .selectFrom('user')
    .select(['id', 'name', 'email'])
    .where('email', '=', email)
    .executeTakeFirst()

  if (existing) return { ...(existing as { id: string; name: string; email: string }), isNew: false }

  // 2. Crea utente tramite API Better Auth (salva password hash correttamente)
  // La password è casuale e non viene mai comunicata: chi chiama questa funzione
  // per un utente isNew=true deve far seguire un invito a impostare la password
  // (vedi server/routes/payment.ts → auth.api.requestPasswordReset con redirectTo /crea-password).
  const result = await auth.api.signUpEmail({
    body: {
      email,
      password: crypto.randomUUID(),
      name: email.split('@')[0]
    }
  })
  const user = (result as any)?.user || result
  return { id: user.id, name: user.name, email: user.email, isNew: true }
}
