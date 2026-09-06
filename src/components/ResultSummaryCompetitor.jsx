import ValuationBox from './ValuationBox'
import MapDisplay from './MapDisplay'
import AdBanner from './ads/AdBanner'

function ResultSummaryCompetitor({
  valuationResult,
  contactData,
  selectedAddress,
  isValuationUnlocked,
  adMode,
  leadId,
  profileType,
  onBackToEdit,
  onRestart,
  onOpenContactForm,
  onReportUnlocked
}) {
  const hasContact = !!contactData
  const addressDisplay = selectedAddress?.display || 'Indirizzo non disponibile'
  const addressCap = selectedAddress?.postcode

  return (
    <div className="min-h-screen bg-[#F5F3FF] border-t-2 border-b-2 border-slate-900">
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr,0.85fr] min-h-screen">
        <div className="px-6 sm:px-10 lg:px-20 py-8 lg:py-12 flex flex-col gap-8">
          <header className="max-w-3xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.18em] text-sky-700 uppercase">
                  Valutazione appartamento
                </div>
              </div>
              <img
                src="/assets/Risorsa 2.png"
                alt="Valuta Facile"
                className="h-8 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl md:text-[28px] font-semibold leading-snug text-slate-900">
              {addressDisplay}
            </h1>
            {addressCap && (
              <div className="mt-1 text-xs text-slate-500">CAP {addressCap}</div>
            )}
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/85 backdrop-blur px-3 py-1 border border-slate-200 shadow-sm">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-xs">
                ℹ️
              </span>
              <span className="text-[11px] text-slate-600">
                Stima basata su dati OMI, caratteristiche e analisi avanzata
              </span>
            </div>
          </header>

          <main className="flex-1">
            <div className="summaryCard">
              <ValuationBox
                valuation={valuationResult}
                contactData={contactData}
                selectedAddress={selectedAddress}
                onBackToEdit={onBackToEdit}
                isValuationUnlocked={isValuationUnlocked}
                onOpenContactForm={onOpenContactForm}
                adMode={adMode}
                leadId={leadId}
                profileType={profileType}
                onReportUnlocked={onReportUnlocked}
              />
            </div>

            {isValuationUnlocked && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)] gap-6">
                <div className="rounded-3xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[6px_6px_0_rgba(15,23,42,1)]">
                  <div className="text-xs font-semibold text-slate-700 mb-1">
                    Riepilogo valutazione
                  </div>
                  <div className="text-sm text-slate-700 mb-2">
                    Valutazione per:
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {addressDisplay}
                  </div>
                  {addressCap && (
                    <div className="text-xs text-slate-600 mt-1">
                      CAP: {addressCap}
                    </div>
                  )}
                </div>
                <div className="rounded-3xl border-2 border-slate-900 bg-white px-5 py-4 shadow-[6px_6px_0_rgba(15,23,42,1)] space-y-3">
                  <button
                    type="button"
                    onClick={onRestart}
                    className="w-full h-10 inline-flex items-center justify-center rounded-full border-2 border-slate-900 bg-white text-xs sm:text-sm font-semibold text-slate-900 shadow-[3px_3px_0_rgba(15,23,42,1)] hover:bg-slate-50"
                  >
                    Nuova valutazione
                  </button>
                  {!hasContact && (
                    <button
                      type="button"
                      onClick={onOpenContactForm}
                      className="w-full h-10 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs sm:text-sm font-semibold shadow-[3px_3px_0_rgba(15,23,42,1)] hover:bg-slate-800"
                    >
                      Inserisci i tuoi dati
                    </button>
                  )}
                  {hasContact && (
                    <div className="text-xs text-emerald-800 bg-emerald-50 border-2 border-emerald-300 rounded-2xl px-3 py-2">
                      Dati di contatto già inseriti
                    </div>
                  )}
                </div>
              </div>
            )}

            {isValuationUnlocked && adMode === 'banner' && (
              <div className="mt-8">
                <AdBanner
                  slotEnvVar="VITE_ADSENSE_SLOT_RESULTS"
                  placeholderLabel="Spazio pubblicitario"
                />
              </div>
            )}
          </main>
        </div>

        <aside className="border-t-2 lg:border-l-2 border-slate-900 bg-sky-50">
          <div className="h-full w-full p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center gap-4">
            <div className="w-full max-w-xl rounded-3xl border-2 border-slate-900 bg-white shadow-[6px_6px_0_rgba(15,23,42,1)] overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b-2 border-slate-900 bg-slate-900 text-slate-50 text-[11px] font-semibold uppercase tracking-[0.16em]">
                Posizione immobile
              </div>
              <div className="w-full aspect-square max-h-[420px]">
                <MapDisplay address={selectedAddress} variant="bare" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ResultSummaryCompetitor
