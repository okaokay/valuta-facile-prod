import Stripe from 'stripe'

// Lazy init — dotenv viene caricato in index.js prima che queste funzioni siano chiamate
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY non configurata')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripe
}

export async function createCheckoutSession(params: {
  email?: string
  priceId: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}) {
  return getStripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: params.email,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    payment_intent_data: { metadata: params.metadata }
  })
}

export function verifyWebhookEvent(payload: Buffer, sig: string) {
  return getStripe().webhooks.constructEvent(
    payload,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}

// Usato come fallback quando il webhook non è arrivato (es. sviluppo locale senza
// `stripe listen`, o ritardo di consegna): il frontend torna da Stripe con
// ?session_id=... e chiediamo direttamente a Stripe lo stato di quella sessione.
export function retrieveCheckoutSession(sessionId: string) {
  return getStripe().checkout.sessions.retrieve(sessionId)
}
