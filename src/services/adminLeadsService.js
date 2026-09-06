const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

const TOKEN_KEY = 'valutatore_admin_token'

export function getAdminToken() {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(TOKEN_KEY)
}

export function setAdminToken(token) {
  if (typeof window === 'undefined') return
  if (token) {
    window.sessionStorage.setItem(TOKEN_KEY, token)
  } else {
    window.sessionStorage.removeItem(TOKEN_KEY)
  }
}

export function clearAdminToken() {
  setAdminToken(null)
}

export async function startAdminLogin({ username, password }) {
  if (!API_BASE_URL) {
    throw new Error('API backend non configurato (VITE_API_BASE_URL mancante)')
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/login-step1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      const message =
        data?.error ||
        (response.status === 401
          ? 'Credenziali non valide'
          : 'Errore durante il login')
      throw new Error(message)
    }

    const data = await response.json()
    return data
  } catch (e) {
    if (e && e.message === 'Failed to fetch') {
      throw new Error(
        'Impossibile contattare il backend admin. Verifica che il server sia avviato (npm run server) e che VITE_API_BASE_URL punti alla stessa porta.'
      )
    }
    throw e
  }
}

export async function completeAdminLogin({ pendingToken, otp }) {
  if (!API_BASE_URL) {
    throw new Error('API backend non configurato (VITE_API_BASE_URL mancante)')
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/login-step2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pendingToken, otp })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      const message =
        data?.error ||
        (response.status === 401
          ? 'Codice 2FA non valido'
          : 'Errore durante la verifica 2FA')
      throw new Error(message)
    }

    const data = await response.json()
    if (data.token) {
      setAdminToken(data.token)
    }

    return data
  } catch (e) {
    if (e && e.message === 'Failed to fetch') {
      throw new Error(
        'Impossibile contattare il backend admin. Verifica che il server sia avviato (npm run server) e che VITE_API_BASE_URL punti alla stessa porta.'
      )
    }
    throw e
  }
}

function buildQuery(params) {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function authorizedFetch(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error('API backend non configurato (VITE_API_BASE_URL mancante)')
  }
  const token = getAdminToken()
  if (!token) {
    throw new Error('Token admin mancante')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  })

  if (response.status === 401) {
    clearAdminToken()
    throw new Error('Sessione scaduta o non valida')
  }

  if (!response.ok) {
    const text = await response.text().catch(() => null)
    throw new Error(
      `Errore API admin (${response.status})${text ? `: ${text}` : ''}`
    )
  }

  return response.json()
}

export async function fetchAdminLeads(params) {
  const query = buildQuery(params)
  return authorizedFetch(`/admin/leads${query}`)
}

// Fase pre-lancio: gate con codici invito (vedi InviteGate.jsx / InviteAdminDashboard.jsx)
export async function fetchAdminInviteMaster() {
  return authorizedFetch('/admin/invite/master')
}

export async function updateAdminInviteMaster(enabled) {
  return authorizedFetch('/admin/invite/master', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  })
}

export async function fetchAdminInviteCodes() {
  return authorizedFetch('/admin/invite/codes')
}

export async function createAdminInviteCode({ code, label }) {
  return authorizedFetch('/admin/invite/codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, label })
  })
}

export async function updateAdminInviteCode(id, { code, label, enabled }) {
  return authorizedFetch(`/admin/invite/codes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, label, enabled })
  })
}

export async function deleteAdminInviteCode(id) {
  return authorizedFetch(`/admin/invite/codes/${id}`, { method: 'DELETE' })
}

export async function fetchAdminInviteFeedback(code) {
  const query = code ? `?code=${encodeURIComponent(code)}` : ''
  return authorizedFetch(`/admin/invite/feedback${query}`)
}

export async function fetchAdminLeadDetail(id) {
  return authorizedFetch(`/admin/leads/${id}`)
}

export async function deleteAdminLead(id) {
  return authorizedFetch(`/admin/leads/${id}`, {
    method: 'DELETE'
  })
}

export async function fetchProvinceAnalyticsSummary(params) {
  const query = buildQuery(params)
  return authorizedFetch(`/admin/analytics/province/summary${query}`)
}

export async function fetchProvinceAnalyticsTimeseries(params) {
  const query = buildQuery(params)
  return authorizedFetch(`/admin/analytics/province/timeseries${query}`)
}
