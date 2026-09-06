const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(
  /\/+$/,
  ''
)
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

export const uploadValuationMedia = async ({
  valuationId,
  floorplanFile,
  photos
}) => {
  const hasBackend = !!API_BASE_URL && !USE_MOCKS

  if (!hasBackend) {
    const photosCount = (photos && photos.length) || 0
    return {
      mediaId: `media_${Date.now()}`,
      uploaded: {
        floorplan: !!floorplanFile,
        photosCount
      },
      mocked: true
    }
  }

  const formData = new FormData()
  if (valuationId) {
    formData.append('valuationId', valuationId)
  }
  if (floorplanFile) {
    formData.append('floorplan', floorplanFile)
  }
  (photos || []).forEach((file, index) => {
    formData.append('photos[]', file, file.name || `photo_${index + 1}`)
  })

  const response = await fetch(`${API_BASE_URL}/valuation/media`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error('Upload media non riuscito')
  }

  const data = await response.json()

  return {
    mediaId: data.mediaId || `media_${Date.now()}`,
    uploaded: {
      floorplan: data.uploaded?.floorplan ?? !!floorplanFile,
      photosCount: data.uploaded?.photosCount ?? ((photos && photos.length) || 0)
    },
    mocked: false
  }
}

export const analyzeValuationMedia = async ({ valuationId, mediaId }) => {
  const hasBackend = !!API_BASE_URL && !USE_MOCKS

  if (hasBackend) {
    const response = await fetch(`${API_BASE_URL}/valuation/ai-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valuationId,
        mediaId
      })
    })

    if (!response.ok) {
      throw new Error('Analisi AI non riuscita')
    }

    const data = await response.json()
    return data
  }

  return null
}
