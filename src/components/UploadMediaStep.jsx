import { useEffect, useState } from 'react'
import { uploadValuationMedia, analyzeValuationMedia } from '../services/valuationMediaService'

function UploadMediaStep({
  wizardData,
  setWizardData,
  onNext,
  onBack,
  onTrackEvent,
  valuationId
}) {
  const [floorPlanError, setFloorPlanError] = useState('')
  const [photosError, setPhotosError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [analysisStatus, setAnalysisStatus] = useState('idle')
  const [serverMessage, setServerMessage] = useState('')

  const mediaState = wizardData.media || {
    floorPlanFile: null,
    photos: [],
    skippedUploadStep: false,
    aiFeatures: null,
    mediaId: null
  }

  const maxFloorPlanSize = 20 * 1024 * 1024
  const maxPhotoSize = 15 * 1024 * 1024
  const maxPhotosCount = 10

  useEffect(() => {
    if (onTrackEvent) {
      onTrackEvent('upload_step_opened', {
        hasFloorPlan: !!mediaState.floorPlanFile,
        photosCount: mediaState.photos?.length || 0
      })
    }
    // Vogliamo tracciare l'evento solo all'apertura dello step,
    // ignorando cambi successivi di mediaState/onTrackEvent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateMediaState = (partial) => {
    setWizardData((prev) => ({
      ...prev,
      media: {
        ...prev.media,
        ...partial
      }
    }))
  }

  const handleFloorPlanChange = (event) => {
    const file = event.target.files && event.target.files[0]
    setFloorPlanError('')

    if (!file) {
      updateMediaState({ floorPlanFile: null })
      return
    }

    if (file.size > maxFloorPlanSize) {
      setFloorPlanError('File troppo grande. Dimensione massima 20MB.')
      updateMediaState({ floorPlanFile: null })
      return
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ]

    if (!allowedTypes.includes(file.type)) {
      setFloorPlanError('Formato non supportato. Usa PDF o immagine (JPG/PNG).')
      updateMediaState({ floorPlanFile: null })
      return
    }

    updateMediaState({ floorPlanFile: file, skippedUploadStep: false })
  }

  const handlePhotosChange = (event) => {
    const files = Array.from(event.target.files || [])
    setPhotosError('')

    if (!files.length) {
      return
    }

    const currentPhotos = mediaState.photos || []
    const remainingSlots = maxPhotosCount - currentPhotos.length
    const filesToAdd = files.slice(0, Math.max(remainingSlots, 0))

    const validFiles = []

    for (const file of filesToAdd) {
      if (file.size > maxPhotoSize) {
        setPhotosError('Alcune immagini superano il limite di 15MB e sono state ignorate.')
        continue
      }

      const isImage = file.type.startsWith('image/')
      if (!isImage) {
        setPhotosError('Sono supportate solo immagini (JPG, PNG, HEIC).')
        continue
      }

      validFiles.push(file)
    }

    if (!validFiles.length) {
      return
    }

    updateMediaState({
      photos: [...currentPhotos, ...validFiles],
      skippedUploadStep: false
    })
  }

  const handleRemoveFloorPlan = () => {
    setFloorPlanError('')
    updateMediaState({ floorPlanFile: null })
  }

  const handleRemovePhoto = (index) => {
    const currentPhotos = mediaState.photos || []
    const updated = currentPhotos.filter((_, i) => i !== index)
    updateMediaState({ photos: updated })
  }

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return ''
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const hasAnyFile =
    !!mediaState.floorPlanFile && !floorPlanError
      ? true
      : (mediaState.photos || []).length > 0 && !photosError

  const handleSkip = () => {
    setServerMessage('')
    setUploadStatus('idle')
    setAnalysisStatus('idle')
    updateMediaState({
      floorPlanFile: null,
      photos: [],
      skippedUploadStep: true,
      aiFeatures: null,
      mediaId: null
    })
    if (onTrackEvent) {
      onTrackEvent('upload_skipped', {
        fromButton: true
      })
    }
    onNext()
  }

  const handleProceed = async () => {
    if (!hasAnyFile) {
      updateMediaState({
        skippedUploadStep: true
      })
      if (onTrackEvent) {
        onTrackEvent('upload_skipped', {
          fromButton: false
        })
      }
      onNext()
      return
    }

    if (uploadStatus === 'uploading' || analysisStatus === 'analyzing') {
      return
    }

    try {
      setServerMessage('')
      setUploadStatus('uploading')

      const hasFloorPlan = !!mediaState.floorPlanFile
      const photosCount = mediaState.photos?.length || 0

      const uploadResult = await uploadValuationMedia({
        valuationId,
        floorplanFile: mediaState.floorPlanFile,
        photos: mediaState.photos || []
      })

      setUploadStatus('success')

      updateMediaState({
        skippedUploadStep: false,
        mediaId: uploadResult.mediaId
      })

      if (onTrackEvent) {
        onTrackEvent('files_uploaded_count', {
          totalFiles: photosCount + (hasFloorPlan ? 1 : 0),
          photosCount,
          hasFloorPlan
        })
      }

      try {
        setAnalysisStatus('analyzing')
        const analysis = await analyzeValuationMedia({
          valuationId,
          mediaId: uploadResult.mediaId
        })

        if (analysis) {
          updateMediaState({
            aiFeatures: analysis
          })
          setAnalysisStatus('success')
          if (onTrackEvent) {
            onTrackEvent('ai_analysis_success', {
              mediaId: uploadResult.mediaId,
              photosCount,
              hasFloorPlan
            })
          }
        } else {
          setAnalysisStatus('error')
          if (onTrackEvent) {
            onTrackEvent('ai_analysis_fail', {
              message: 'Analisi AI non disponibile'
            })
          }
        }
      } catch (analysisError) {
        setAnalysisStatus('error')
        if (onTrackEvent) {
          onTrackEvent('ai_analysis_fail', {
            message: analysisError.message
          })
        }
      }
    } catch (error) {
      setUploadStatus('error')
      setServerMessage('Caricamento non riuscito, puoi continuare comunque.')
      if (onTrackEvent) {
        onTrackEvent('ai_analysis_fail', {
          message: error.message
        })
      }
    }

    onNext()
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-[0.18em] mb-2">
        PASSAGGIO 3 DI 4
      </div>
      <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
        Hai foto o una planimetria?
      </h2>
      <p className="mt-3 text-sm text-gray-700 max-w-2xl">
        Caricando questi dettagli possiamo stimare meglio il valore del tuo
        immobile. Puoi anche saltare questo passaggio.
      </p>

      <div className="mt-8 rounded-3xl border-2 border-slate-900 bg-white px-6 py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <div className="text-sm font-semibold text-gray-800 mb-1">
            Planimetria
          </div>
          <div className="text-xs text-gray-500 mb-4">
            PDF o immagine (max 20MB)
          </div>

          <label className="inline-flex items-center justify-center px-4 h-10 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-900 cursor-pointer bg-white hover:border-slate-900">
            <span>Carica file</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/jpg"
              onChange={handleFloorPlanChange}
              className="hidden"
            />
          </label>

          {floorPlanError && (
            <div className="mt-3 text-xs text-red-500">{floorPlanError}</div>
          )}

          {mediaState.floorPlanFile && !floorPlanError && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <div>
                <div className="text-xs font-semibold text-gray-800 truncate max-w-[180px]">
                  {mediaState.floorPlanFile.name}
                </div>
                <div className="text-[11px] text-gray-500">
                  {formatFileSize(mediaState.floorPlanFile.size)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-green-100 overflow-hidden">
                  <div className="h-full w-full bg-green-500" />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFloorPlan}
                  className="text-[11px] text-gray-500 hover:text-red-600"
                >
                  Rimuovi
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold text-gray-800">
              Foto immobile
            </div>
            <div className="text-[11px] text-gray-500">
              {(mediaState.photos || []).length}/{maxPhotosCount}
            </div>
          </div>
          <div className="text-xs text-gray-500 mb-4">
            JPG, PNG o HEIC, max 10 immagini da 10-15MB ciascuna
          </div>

          <label className="inline-flex items-center justify-center px-4 h-10 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-900 cursor-pointer bg-white hover:border-slate-900">
            <span>Aggiungi foto</span>
            <input
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={handlePhotosChange}
              className="hidden"
            />
          </label>

          {photosError && (
            <div className="mt-3 text-xs text-red-500">{photosError}</div>
          )}

          {(mediaState.photos || []).length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto space-y-2 pr-1">
              {mediaState.photos.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center text-[10px] text-gray-600">
                      Foto
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 truncate max-w-[140px]">
                        {file.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-green-100 overflow-hidden">
                      <div className="h-full w-full bg-green-500" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="text-[11px] text-gray-500 hover:text-red-600"
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

        <div className="mt-8 pt-4 border-t-2 border-slate-900 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-xs sm:text-sm font-semibold text-slate-900 hover:underline"
          >
            Indietro
          </button>
          <div className="flex items-center gap-4">
            {serverMessage && (
              <div className="text-xs text-gray-500">
                {serverMessage}
              </div>
            )}
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 hover:underline"
            >
              Salta
            </button>
            <button
              type="button"
              onClick={handleProceed}
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-xs sm:text-sm font-semibold bg-slate-900 text-white shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={uploadStatus === 'uploading' || analysisStatus === 'analyzing'}
            >
              Prosegui
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadMediaStep
