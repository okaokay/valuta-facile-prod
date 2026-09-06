const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

export async function submitLead({
  contact,
  address,
  property,
  valuation,
  wizardData
}) {
  if (!API_BASE_URL || USE_MOCKS) {
    const stored = window.localStorage.getItem('valutatore_contacts_v1')
    const parsed = stored ? JSON.parse(stored) : []
    const record = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      contact,
      address,
      property,
      valuation
    }
    parsed.push(record)
    window.localStorage.setItem(
      'valutatore_contacts_v1',
      JSON.stringify(parsed)
    )
    return { success: true, leadId: record.id, mocked: true }
  }

  const formData = new FormData()

  formData.append('contact', JSON.stringify(contact || null))
  formData.append('address', JSON.stringify(address || null))
  formData.append('property', JSON.stringify(property || null))
  formData.append('valuation', JSON.stringify(valuation || null))
  formData.append('wizardData', JSON.stringify(wizardData || null))

  const media = wizardData?.media || {}

  if (media.floorPlanFile instanceof File) {
    formData.append('floorplan', media.floorPlanFile)
  }

  if (Array.isArray(media.photos)) {
    media.photos.forEach((file) => {
      if (file instanceof File) {
        formData.append('photos', file)
      }
    })
  }

  const visitorId = (() => {
    try { return window.localStorage.getItem('valutatore_analytics_visitor_id') || '' }
    catch { return '' }
  })()
  formData.append('visitor_id', visitorId)

  const response = await fetch(`${API_BASE_URL}/leads`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  })

  if (!response.ok) {
    let body = null
    try { body = await response.json() } catch {}
    const err = new Error(body?.message || `Errore salvataggio lead (${response.status})`)
    err.status = response.status
    err.code = body?.error || null
    throw err
  }

  return response.json()
}
