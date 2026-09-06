import { useEffect, useState } from 'react'
import {
  enrichAddressWithCAP,
  findPreciseCoordinates
} from '../services/enhancedAddressService'

function AddressConfirmWithMap({ draftAddress, onBack, onConfirm }) {
  const [city, setCity] = useState('')
  const [displayAddress, setDisplayAddress] = useState('')
  const [houseNumber, setHouseNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (draftAddress) {
      setCity(draftAddress.city || '')
      setDisplayAddress(draftAddress.display || '')
      setHouseNumber(draftAddress.housenumber || '')
    }
  }, [draftAddress])

  const handleSubmit = async () => {
    const trimmedCity = city.trim()
    const trimmedAddress = displayAddress.trim()
    const trimmedNumber = houseNumber.trim()

    if (!trimmedCity || !trimmedAddress) {
      setError('Compila Comune e Indirizzo prima di proseguire')
      return
    }
    if (!trimmedNumber) {
      setError('Inserisci il numero civico per proseguire')
      return
    }
    if (
      !/^[0-9A-Za-z/\- ]+$/.test(trimmedNumber) ||
      !/[0-9]/.test(trimmedNumber)
    ) {
      setError('Inserisci un numero civico valido (es. 12, 12A, 12/B)')
      return
    }
    if (!draftAddress) {
      setError('Seleziona prima un indirizzo dalla schermata precedente')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      let finalDisplay = trimmedAddress
      if (!finalDisplay.toLowerCase().includes(trimmedNumber.toLowerCase())) {
        finalDisplay = `${finalDisplay} ${trimmedNumber}`
      }
      let base = {
        ...draftAddress,
        display: finalDisplay,
        city: trimmedCity,
        housenumber: trimmedNumber,
        state: draftAddress.state || draftAddress.province || '',
        country: 'Italia',
        source: 'confirm-address'
      }
      base = await findPreciseCoordinates(base)
      const enriched = await enrichAddressWithCAP(base)
      if (!enriched.postcode && draftAddress.postcode) {
        enriched.postcode = draftAddress.postcode
      }
      onConfirm(enriched)
    } catch (e) {
      setError('Errore nella conferma dell\'indirizzo, riprova')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-xl">
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-[0.18em] mb-2">
        PASSAGGIO 1 DI 4
      </div>
      <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
        Conferma indirizzo
      </h2>
      <p className="mt-3 text-sm text-gray-700 max-w-md">
        Controlla che i dati siano corretti: useremo questo indirizzo per calcolare la stima e mostrare la
        zona di riferimento sulla mappa.
      </p>

      <div className="mt-8 rounded-3xl border-2 border-slate-900 bg-white px-6 py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Comune
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border-2 border-slate-900 text-sm bg-white focus:outline-none focus:ring-0 focus:border-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Numero civico
            </label>
            <input
              type="text"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border-2 border-slate-900 text-sm bg-white focus:outline-none focus:ring-0 focus:border-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Indirizzo
            </label>
            <input
              type="text"
              value={displayAddress}
              onChange={(e) => setDisplayAddress(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border-2 border-slate-900 text-sm bg-white focus:outline-none focus:ring-0 focus:border-slate-900"
            />
          </div>
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border-2 border-red-300 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="mt-8 pt-4 border-t-2 border-slate-900">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="text-xs sm:text-sm font-semibold text-slate-900 hover:underline"
            >
              Indietro
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2 text-xs sm:text-sm font-semibold text-white shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Attendi...' : 'Prosegui'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddressConfirmWithMap
