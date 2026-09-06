const LISTMONK_URL = (process.env.LISTMONK_URL || 'http://localhost:9000').replace(/\/+$/, '')
const LISTMONK_AUTH = Buffer.from(
  `${process.env.LISTMONK_USERNAME || 'admin'}:${process.env.LISTMONK_PASSWORD || ''}`
).toString('base64')

// ID numerici template — compilare in .env dopo aver creato i template nella UI listmonk
// Settings → Transactional → Templates → nota l'ID numerico di ogni template
const TEMPLATE_IDS: Record<string, number> = {
  welcome: Number(process.env.LISTMONK_TEMPLATE_WELCOME) || 0,
  'report-pronto-pagamento': Number(process.env.LISTMONK_TEMPLATE_REPORT_PAGAMENTO) || 0,
  'magic-link-video': Number(process.env.LISTMONK_TEMPLATE_MAGIC_LINK) || 0,
  'visura-pronta': Number(process.env.LISTMONK_TEMPLATE_VISURA_PRONTA) || 0,
  'reset-password': Number(process.env.LISTMONK_TEMPLATE_RESET_PASSWORD) || 0,
  'crea-password': Number(process.env.LISTMONK_TEMPLATE_CREA_PASSWORD) || 0,
}

async function listmonkFetch(path: string, body: unknown) {
  const res = await fetch(`${LISTMONK_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${LISTMONK_AUTH}`
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`listmonk ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

export async function sendTransactionalEmail(
  subscriberEmail: string,
  templateName: keyof typeof TEMPLATE_IDS,
  data: Record<string, unknown>
) {
  const templateId = TEMPLATE_IDS[templateName]
  if (!templateId) throw new Error(`Template ID non configurato per: ${templateName}`)
  await listmonkFetch('/api/tx', {
    subscriber_email: subscriberEmail,
    template_id: templateId,
    data
  })
}

export async function addSubscriber(email: string, name: string, lists: number[]) {
  await listmonkFetch('/api/subscribers', {
    email,
    name,
    lists,
    status: 'enabled',
    preconfirm_subscriptions: true
  })
}

export async function unsubscribeFromList(email: string, listId: number) {
  // Prima cerca il subscriber per email
  const searchRes = await fetch(
    `${LISTMONK_URL}/api/subscribers?query=${encodeURIComponent(`subscribers.email = '${email}'`)}`,
    { headers: { Authorization: `Basic ${LISTMONK_AUTH}` } }
  )
  if (!searchRes.ok) return
  const { data } = await searchRes.json()
  const subscriber = data?.results?.[0]
  if (!subscriber) return

  await fetch(`${LISTMONK_URL}/api/subscribers/lists`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${LISTMONK_AUTH}`
    },
    body: JSON.stringify({
      ids: [subscriber.id],
      action: 'unsubscribe',
      target_list_ids: [listId]
    })
  })
}
