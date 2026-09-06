 import { test, expect } from '@playwright/test'

// Dati minimali per un lead valido (multer richiede multipart/form-data)
function makeLeadPayload(email, visitorId = '') {
  return {
    contact: JSON.stringify({
      nome: 'Playwright',
      cognome: 'Test',
      email,
      telefono: '3401234567',
    }),
    address: JSON.stringify({
      display: 'Via Roma 1, Milano',
      city: 'Milano',
      postcode: '20100',
    }),
    property: JSON.stringify({
      type: 'appartamento',
      livingArea: 80,
    }),
    valuation: JSON.stringify({
      success: true,
      prezzoMedio: 300000,
    }),
    wizardData: JSON.stringify({}),
    visitor_id: visitorId,
  }
}

async function postLead(request, email, visitorId) {
  return request.post('/api/leads', {
    multipart: makeLeadPayload(email, visitorId),
  })
}

// ─────────────────────────────────────────────
// BLOCCO 1 — Email usa-e-getta (422)
// ─────────────────────────────────────────────
test.describe('Email usa-e-getta → 422', () => {
  test('mailinator.com deve essere bloccata', async ({ request }) => {
    const res = await postLead(request, 'test@mailinator.com', `vis_disp_${Date.now()}`)

    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('disposable_email')
    expect(body.message).toBeTruthy()
  })

  test('yopmail.com deve essere bloccata', async ({ request }) => {
    const res = await postLead(request, 'qualcuno@yopmail.com', `vis_disp_yop_${Date.now()}`)

    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('disposable_email')
  })

  test('trashmail.com deve essere bloccata', async ({ request }) => {
    const res = await postLead(request, 'spam@trashmail.com', `vis_disp_trash_${Date.now()}`)

    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('disposable_email')
  })
})

// ─────────────────────────────────────────────
// BLOCCO 2 — Limite per email (429 alla 3ª)
// ─────────────────────────────────────────────
test.describe('Limite per email → 429 alla 3ª valutazione', () => {
  test('1ª e 2ª valutazione accettate, 3ª bloccata', async ({ request }) => {
    const ts = Date.now()
    const email = `pw-limit-${ts}@example.com`

    const res1 = await postLead(request, email, `vis_limit1_${ts}`)
    expect(res1.status(), 'Prima valutazione deve essere 201').toBe(201)
    expect((await res1.json()).success).toBe(true)

    const res2 = await postLead(request, email, `vis_limit2_${ts}`)
    expect(res2.status(), 'Seconda valutazione deve essere 201').toBe(201)
    expect((await res2.json()).success).toBe(true)

    const res3 = await postLead(request, email, `vis_limit3_${ts}`)
    expect(res3.status(), 'Terza valutazione deve essere 429').toBe(429)
    const body3 = await res3.json()
    expect(body3.error).toBe('limit_reached')
    expect(body3.message).toContain('limite')
  })
})

// ─────────────────────────────────────────────
// BLOCCO 3 — Normalizzazione Gmail (plus-tag)
// ─────────────────────────────────────────────
test.describe('Normalizzazione Gmail — plus-tag conta come stessa email', () => {
  test('user@gmail.com e user+tag@gmail.com contano insieme', async ({ request }) => {
    const ts = Date.now()
    const baseEmail = `pwtest${ts}@gmail.com`
    const plusEmail = `pwtest${ts}+newsletter@gmail.com`

    // 1ª — email base
    const r1 = await postLead(request, baseEmail, `vis_gm1_${ts}`)
    expect(r1.status(), '1ª (base) deve essere 201').toBe(201)

    // 2ª — email base di nuovo
    const r2 = await postLead(request, baseEmail, `vis_gm2_${ts}`)
    expect(r2.status(), '2ª (base) deve essere 201').toBe(201)

    // 3ª — stessa email con plus-tag → normalizza allo stesso indirizzo → 429
    const r3 = await postLead(request, plusEmail, `vis_gm3_${ts}`)
    expect(r3.status(), '3ª (plus-tag) deve essere 429').toBe(429)
    const body3 = await r3.json()
    expect(body3.error).toBe('limit_reached')
  })
})

// ─────────────────────────────────────────────
// BLOCCO 4 — Limite per dispositivo / visitorId
// ─────────────────────────────────────────────
test.describe('Limite per dispositivo → 429 alla 5ª (visitorId)', () => {
  test('4 email diverse stesso dispositivo: ok; 5ª bloccata', async ({ request }) => {
    const ts = Date.now()
    const visitorId = `vis_abuse_${ts}`

    for (let i = 0; i < 4; i++) {
      const res = await postLead(request, `pw-visitor-${ts}-${i}@example.com`, visitorId)
      expect(
        res.status(),
        `Valutazione ${i + 1}/4 deve essere 201`
      ).toBe(201)
    }

    // 5ª con stessa visitorId → bloccata
    const res5 = await postLead(request, `pw-visitor-${ts}-extra@example.com`, visitorId)
    expect(res5.status(), '5ª valutazione (stesso dispositivo) deve essere 429').toBe(429)
    const body5 = await res5.json()
    expect(body5.error).toBe('limit_reached')
  })
})
