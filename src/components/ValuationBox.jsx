import React from 'react'
import ReportSellModal from './ReportSellModal'

// Per Villa/Villetta a schiera/Rustico-Casale il campo "Piano" contiene il
// numero di livelli della villa, non la posizione in un condominio.
const VILLA_FLOOR_LABELS = {
  unico: 'Villa su un livello',
  due_livelli: 'Villa su due livelli',
  tre_livelli: 'Villa su tre livelli o più'
}

// Stabile/Palazzo: il campo "Piano" contiene il numero di piani dell'intero
// edificio, non la posizione di un singolo appartamento.
const STABILE_FLOOR_LABELS = {
  due_piani: 'Stabile di 2 piani',
  tre_piani: 'Stabile di 3 piani',
  quattro_piani: 'Stabile di 4 piani',
  cinque_piani_o_piu: 'Stabile di 5 piani o più'
}

function ValuationBox({
  valuation,
  isValuationUnlocked = false,
  onBackToEdit,
  onOpenContactForm,
  adMode,
  leadId,
  profileType,
  onReportUnlocked,
  contactData,
  selectedAddress
}) {
  // Formatta il numero in formato valuta Euro
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value)
  }

  // Estrae i dati dal nuovo formato (supporta sia il formato tradizionale che Enhanced AI)
  const isEnhancedFormat = valuation?.valutazione && valuation?.source

  let totalValue, minValue, maxValue, pricePerSqm, livingArea, omiData, address, propertyDetails
  
  if (isEnhancedFormat) {
    // Formato Enhanced AI
    totalValue = valuation.valutazione.prezzoMedio
    minValue = valuation.valutazione.prezzoMinimo
    maxValue = valuation.valutazione.prezzoMassimo
    pricePerSqm = valuation.valutazione.prezzoAlMetroQuadro
    omiData = valuation.zonaOMI
  } else {
    // Formato tradizionale
    ({ 
      totalValue, 
      minValue, 
      maxValue, 
      pricePerSqm,
      livingArea,
      omiData,
      address,
      propertyDetails
    } = valuation || {})
  }

  if (selectedAddress) {
    address = selectedAddress
  }

  // Valutazione separata del garage/posto auto (OMI tipologia "Box"),
  // indipendente dal prezzo dell'abitazione.
  const valutazioneGarage = valuation?.valutazioneGarage || null

  const mediaAI = valuation?.mediaAI
  const hasMediaDelta =
    mediaAI && typeof mediaAI.aiDeltaPercent === 'number' && mediaAI.aiDeltaPercent !== 0


  const hasRooms = propertyDetails && propertyDetails.rooms != null
  const hasBaths = propertyDetails && propertyDetails.bathrooms != null
  const hasFloor = propertyDetails && propertyDetails.floor !== undefined
  const hasHeating = propertyDetails && !!propertyDetails.heating
  const hasElevator =
    propertyDetails && typeof propertyDetails.hasElevator === 'boolean'
  const hasLivingArea = typeof livingArea === 'number' && livingArea > 0
  const hasAnyPropertyInfo =
    hasRooms || hasBaths || hasFloor || hasHeating || hasElevator || hasLivingArea

  const hasPricePerSqm = typeof pricePerSqm === 'number' && pricePerSqm > 0
  const formattedPricePerSqm = hasPricePerSqm ? formatCurrency(pricePerSqm) : null

  const streetName =
    (address &&
      (address.road ||
        address.street ||
        address.via ||
        address.thoroughfare ||
        address.name ||
        address.display)) ||
    (typeof address === 'string' ? address : null)

  const cityName =
    address &&
    (address.city ||
      address.town ||
      address.village ||
      address.comune ||
      address.municipality)

  const areaName =
    (omiData && (omiData.zona || omiData.quartiere || omiData.microzona)) || null

  const locationLabel = streetName && cityName ? `${streetName}, ${cityName}` : streetName || cityName || null

  const areaLabel =
    areaName && cityName ? `${areaName} di ${cityName}` : areaName || cityName || null

  return (
    <div className="relative mt-4 rounded-3xl border-2 border-slate-900 bg-white px-5 md:px-7 py-6 md:py-7 shadow-[6px_6px_0_rgba(15,23,42,1)]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 md:gap-6">
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={onBackToEdit}
            className="inline-flex items-center gap-3 px-4 py-3 rounded-full border-2 border-slate-900 bg-white hover:bg-slate-900 hover:text-white text-xs md:text-sm font-semibold text-slate-900 shadow-[4px_4px_0_rgba(15,23,42,1)] transition-colors"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-900 bg-white text-slate-900 text-lg">
              ✏️
            </span>
            <span className="text-left leading-tight">
              <span className="block uppercase tracking-[0.16em] text-[10px]">
                Modifica
              </span>
              <span className="block text-xs md:text-sm">
                caratteristiche
              </span>
            </span>
          </button>
        </div>

        {hasAnyPropertyInfo && (
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 text-slate-900 text-lg bg-slate-50">
                🛋️
              </div>
              <div className="text-[11px] text-slate-600">Locali</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {hasRooms ? propertyDetails.rooms : '—'}
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 text-slate-900 text-lg bg-slate-50">
                📐
              </div>
              <div className="text-[11px] text-slate-600">Superficie</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {hasLivingArea ? `${livingArea} m²` : '—'}
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 text-slate-900 text-lg bg-slate-50">
                🛁
              </div>
              <div className="text-[11px] text-slate-600">Bagni</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {hasBaths ? propertyDetails.bathrooms : '—'}
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 text-slate-900 text-lg bg-slate-50">
                ⬆️
              </div>
              <div className="text-[11px] text-slate-600">Piano</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {hasFloor
                  ? VILLA_FLOOR_LABELS[propertyDetails.floor] ||
                    STABILE_FLOOR_LABELS[propertyDetails.floor] ||
                    (propertyDetails.floor === 0
                      ? 'Terra'
                      : propertyDetails.floor === 6
                        ? 'Attico'
                        : `${propertyDetails.floor}`)
                  : '—'}
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 text-slate-900 text-lg bg-slate-50">
                🔥
              </div>
              <div className="text-[11px] text-slate-600">Riscaldamento</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {hasHeating ? propertyDetails.heating : '—'}
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 text-slate-900 text-lg bg-slate-50">
                🛗
              </div>
              <div className="text-[11px] text-slate-600">Ascensore</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {hasElevator
                  ? propertyDetails.hasElevator
                    ? 'Sì'
                    : 'No'
                  : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {isValuationUnlocked ? (
        <div className="mt-8 border-t-2 border-slate-900 pt-6">
          <div className="text-center mb-6">
            <div className="text-xs font-semibold tracking-[0.16em] text-slate-700 uppercase mb-2">
              Stima principale basata su OMI
            </div>
            {hasMediaDelta && (
              <div className="mb-2 text-xs font-medium">
                <span
                  className={
                    mediaAI.aiDeltaPercent > 0 ? 'text-emerald-700' : 'text-rose-700'
                  }
                >
                  Affinamento da foto/planimetria:{' '}
                  {mediaAI.aiDeltaPercent > 0 ? '+' : ''}
                  {(mediaAI.aiDeltaPercent * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-1">
              Ecco la stima dell&apos;immobile!
            </h2>
            <div className="text-xs text-slate-500">
              {new Date().toLocaleDateString('it-IT')}
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-[0.16em]">
              Prezzo stimato
            </div>
            <div className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">
              {typeof totalValue === 'number' ? formatCurrency(totalValue) : '—'}
            </div>
          </div>

          {valutazioneGarage && (
            <div className="mt-6 rounded-2xl border-2 border-slate-900 bg-slate-50 px-5 py-4">
              <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                Valutazione separata: garage/posto auto
              </div>
              {valutazioneGarage.disponibile ? (
                <div className="flex flex-col items-center text-center">
                  <div className="text-xs text-slate-600">
                    {valutazioneGarage.superficie} m² ×{' '}
                    {formatCurrency(valutazioneGarage.prezzoAlMetroQuadro)}/m²
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {formatCurrency(valutazioneGarage.prezzoStimato)}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Basata sui valori OMI ufficiali &quot;Box&quot;
                    {valutazioneGarage.comune
                      ? ` di ${valutazioneGarage.comune}`
                      : ' del comune'}{' '}
                    — non è incluso nel prezzo dell&apos;abitazione qui sopra.
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-600">
                  {valutazioneGarage.motivo ||
                    'Valutazione del garage non disponibile per questo comune.'}
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <ReportSellModal
              profileType={profileType}
              adMode={adMode}
              leadId={leadId}
              onUnlocked={onReportUnlocked}
            />
          </div>

        </div>
      ) : (
        <div className="mt-8 md:mt-10 border-t-2 border-slate-900 pt-8">
          <div className="max-w-md mx-auto text-center">
            <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
              Sblocca la valutazione completa
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Inserisci i tuoi dati per visualizzare il valore stimato del tuo
              immobile.
            </p>
            <button
              type="button"
              onClick={onOpenContactForm}
              className="mt-5 inline-flex w-full sm:w-auto justify-center px-6 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-[4px_4px_0_rgba(15,23,42,1)]"
            >
              Visualizza valore immobile
            </button>
            <p className="mt-2 text-[11px] text-slate-600">
              I tuoi dati saranno usati solo per inviarti la valutazione
              dell&apos;immobile.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

export default ValuationBox
