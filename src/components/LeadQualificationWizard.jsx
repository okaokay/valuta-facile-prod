import { AnimatedSelect } from './FeaturesFormCompetitor'

// Etichette ed opzioni condivise con la dashboard admin (ContactsDashboard.jsx)
// per tradurre i valori grezzi salvati in wizardData.lead in testo leggibile.

export const PROFILE_TYPE_META = {
  PROPRIETARIO: { label: 'Proprietario', color: 'bg-sky-100 text-sky-800 border-sky-300' },
  CLIENTE_ACQUIRENTE: { label: 'Cliente acquirente', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  PROFESSIONISTA: { label: 'Professionista', color: 'bg-violet-100 text-violet-800 border-violet-300' }
}

export const saleTimingOptions = [
  { value: 'attualmente_in_vendita', label: 'Sì, è attualmente in vendita' },
  { value: 'a_breve', label: 'No, lo farò a breve' },
  { value: 'entro_3_mesi', label: 'No, lo farò entro 3 mesi' },
  { value: 'entro_6_mesi', label: 'No, lo farò entro 6 mesi' },
  { value: 'entro_1_anno', label: 'No, lo farò entro 1 anno' }
]

export const buyerStageOptions = [
  { value: 'solo_valutando', label: 'Sto solo valutando' },
  { value: 'proposta_fatta', label: 'Ho fatto una proposta' },
  { value: 'preliminare_firmato', label: 'Ho firmato un preliminare' }
]

export const buyerFinancingOptions = [
  { value: 'liquidita_propria', label: 'Ho liquidità propria' },
  { value: 'mutuo_approvato', label: 'Ho già un mutuo approvato' },
  { value: 'mutuo_da_richiedere', label: 'Devo ancora richiedere il mutuo' }
]

export const buyerTimelineOptions = [
  { value: 'subito', label: 'Subito' },
  { value: 'entro_3_mesi', label: 'Entro 3 mesi' },
  { value: 'entro_6_mesi', label: 'Entro 6 mesi' },
  { value: 'nessuna_fretta', label: 'Nessuna fretta' }
]

export const proRoleOptions = [
  { value: 'agente_immobiliare', label: 'Agente immobiliare' },
  { value: 'titolare_agenzia', label: 'Titolare di agenzia' },
  { value: 'perito', label: 'Perito immobiliare' },
  { value: 'notaio', label: 'Notaio' },
  { value: 'altro', label: 'Altro professionista del settore' }
]

export const proPurposeOptions = [
  { value: 'mandato_vendita', label: 'Devo preparare un mandato di vendita' },
  { value: 'consulenza_acquirente', label: 'Devo consigliare un cliente acquirente' },
  { value: 'perizia_tecnica', label: 'Perizia o stima tecnica' },
  { value: 'uso_interno', label: 'Uso interno / comparativo' }
]

export const proHasMandateOptions = [
  { value: 'si', label: 'Sì' },
  { value: 'no', label: 'No' },
  { value: 'non_ancora', label: 'Non ancora' }
]

// Helper per tradurre un valore grezzo salvato in DB nella sua label leggibile
export function labelFromOptions(options, value) {
  if (!value) return '-'
  const found = options.find((o) => o.value === value)
  return found ? found.label : value
}

function LeadQualificationWizard({
  wizardStep,
  setWizardStep,
  wizardData,
  setWizardData,
  onBackToMedia,
  onSubmit
}) {
  const setLeadField = (field, value) => {
    setWizardData((prev) => ({
      ...prev,
      lead: {
        ...prev.lead,
        [field]: value
      }
    }))
  }

  const isLeadProfileValid = () => {
    const l = wizardData.lead
    if (l.profileType === 'PROPRIETARIO') {
      return !!l.saleTiming
    }
    if (l.profileType === 'CLIENTE_ACQUIRENTE') {
      return !!l.buyerStage && !!l.buyerFinancing && !!l.buyerTimeline
    }
    if (l.profileType === 'PROFESSIONISTA') {
      return !!l.proRole && !!l.proPurpose && !!l.proHasMandate
    }
    return false
  }

  const goNext = () => {
    if (wizardStep === 'lead_profile') {
      if (!isLeadProfileValid()) return
      onSubmit()
    } else if (wizardStep === 'agency_offer_and_marketing') {
      onSubmit()
    }
  }

  const goBack = () => {
    if (wizardStep === 'lead_profile') {
      onBackToMedia()
    } else if (wizardStep === 'agency_offer_and_marketing') {
      setWizardStep('lead_profile')
    }
  }

  const nextButtonLabel = wizardData.lead.profileType === 'PROFESSIONISTA'
    ? 'Vedi stima'
    : 'Vedi valutazione'

  return (
    <div className="w-full max-w-3xl">
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-[0.18em] mb-2">
        PASSAGGIO 4 DI 4
      </div>
      <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
        Ultime informazioni
      </h2>
      <div className="mt-8 rounded-3xl border-2 border-slate-900 bg-white px-6 py-6 shadow-[6px_6px_0_rgba(15,23,42,1)] space-y-8">
        {wizardStep === 'lead_profile' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="text-sm font-semibold text-slate-900">
                Richiedi come
              </div>
              <div className="flex flex-col sm:inline-flex sm:flex-row w-full sm:w-auto rounded-2xl sm:rounded-full border-2 border-slate-900 bg-white overflow-hidden text-xs sm:text-sm font-semibold divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-900">
                <button
                  type="button"
                  onClick={() => setLeadField('profileType', 'PROPRIETARIO')}
                  className={`px-4 sm:px-5 h-11 sm:h-9 ${
                    wizardData.lead.profileType === 'PROPRIETARIO'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-900'
                  }`}
                >
                  PROPRIETARIO
                </button>
                <button
                  type="button"
                  onClick={() => setLeadField('profileType', 'CLIENTE_ACQUIRENTE')}
                  className={`px-4 sm:px-5 h-11 sm:h-9 ${
                    wizardData.lead.profileType === 'CLIENTE_ACQUIRENTE'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-900'
                  }`}
                >
                  STAI ACQUISTANDO
                </button>
                <button
                  type="button"
                  onClick={() => setLeadField('profileType', 'PROFESSIONISTA')}
                  className={`px-4 sm:px-5 h-11 sm:h-9 ${
                    wizardData.lead.profileType === 'PROFESSIONISTA'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-900'
                  }`}
                >
                  SEI UN PROFESSIONISTA
                </button>
              </div>
            </div>

            {wizardData.lead.profileType === 'PROPRIETARIO' && (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Hai iniziato la vendita di questa proprietà?
                  </div>
                  <AnimatedSelect
                    value={wizardData.lead.saleTiming}
                    onChange={(val) => setLeadField('saleTiming', val)}
                    options={saleTimingOptions}
                    placeholder="Seleziona"
                  />
                </div>
              </div>
            )}

            {wizardData.lead.profileType === 'CLIENTE_ACQUIRENTE' && (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    A che punto sei con l'acquisto?
                  </div>
                  <AnimatedSelect
                    value={wizardData.lead.buyerStage}
                    onChange={(val) => setLeadField('buyerStage', val)}
                    options={buyerStageOptions}
                    placeholder="Seleziona"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Hai già la disponibilità economica o ti serve un mutuo?
                  </div>
                  <AnimatedSelect
                    value={wizardData.lead.buyerFinancing}
                    onChange={(val) => setLeadField('buyerFinancing', val)}
                    options={buyerFinancingOptions}
                    placeholder="Seleziona"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Entro quanto tempo vorresti concludere l'acquisto?
                  </div>
                  <AnimatedSelect
                    value={wizardData.lead.buyerTimeline}
                    onChange={(val) => setLeadField('buyerTimeline', val)}
                    options={buyerTimelineOptions}
                    placeholder="Seleziona"
                  />
                </div>
              </div>
            )}

            {wizardData.lead.profileType === 'PROFESSIONISTA' && (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Che ruolo ricopri?
                  </div>
                  <AnimatedSelect
                    value={wizardData.lead.proRole}
                    onChange={(val) => setLeadField('proRole', val)}
                    options={proRoleOptions}
                    placeholder="Seleziona"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Nome dell'agenzia o studio <span className="font-normal text-slate-500">(facoltativo)</span>
                  </div>
                  <input
                    type="text"
                    value={wizardData.lead.proAgencyName}
                    onChange={(e) => setLeadField('proAgencyName', e.target.value)}
                    placeholder="Es. Agenzia Rossi Immobiliare"
                    className="w-full border-2 border-slate-900 rounded-full px-4 h-9 text-sm text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Per cosa ti serve questa valutazione?
                  </div>
                  <AnimatedSelect
                    value={wizardData.lead.proPurpose}
                    onChange={(val) => setLeadField('proPurpose', val)}
                    options={proPurposeOptions}
                    placeholder="Seleziona"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Hai già un mandato su questo immobile?
                  </div>
                  <AnimatedSelect
                    value={wizardData.lead.proHasMandate}
                    onChange={(val) => setLeadField('proHasMandate', val)}
                    options={proHasMandateOptions}
                    placeholder="Seleziona"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {wizardStep === 'lead_profile' && (
          <div className="space-y-6">
            {wizardData.lead.profileType === 'PROPRIETARIO' && (
              <div>
                <div className="text-sm font-semibold text-slate-900 mb-2">
                  Vuoi una valutazione personalizzata e gratuita da agenzie di zona?
                </div>
                <div className="inline-flex rounded-full border-2 border-slate-900 bg-white overflow-hidden text-xs sm:text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setLeadField('wantAgenciesValuation', true)}
                    className={`px-4 sm:px-5 h-9 ${
                      wizardData.lead.wantAgenciesValuation
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-900'
                    }`}
                  >
                    Sì
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadField('wantAgenciesValuation', false)}
                    className={`px-4 sm:px-5 h-9 ${
                      wizardData.lead.wantAgenciesValuation === false
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-900'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {wizardData.lead.profileType === 'CLIENTE_ACQUIRENTE' && (
              <div>
                <div className="text-sm font-semibold text-slate-900 mb-2">
                  Vuoi un supporto gratuito nella trattativa d'acquisto da parte di un consulente di zona?
                </div>
                <div className="inline-flex rounded-full border-2 border-slate-900 bg-white overflow-hidden text-xs sm:text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setLeadField('buyerWantsSupport', true)}
                    className={`px-4 sm:px-5 h-9 ${
                      wizardData.lead.buyerWantsSupport
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-900'
                    }`}
                  >
                    Sì
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeadField('buyerWantsSupport', false)}
                    className={`px-4 sm:px-5 h-9 ${
                      wizardData.lead.buyerWantsSupport === false
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-900'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-start text-xs text-gray-700">
              <input
                id="marketingConsent"
                type="checkbox"
                checked={wizardData.lead.marketingConsent}
                onChange={(e) =>
                  setLeadField('marketingConsent', e.target.checked)
                }
                className="mt-1 mr-2 h-3 w-3"
              />
              <label htmlFor="marketingConsent">
                Desidero ricevere comunicazioni promozionali e offerte
                commerciali da terzi
              </label>
            </div>
          </div>
        )}
        <div className="mt-8 pt-4 border-t-2 border-slate-900 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={goBack}
            className="text-xs sm:text-sm font-semibold text-slate-900 hover:underline"
          >
            Indietro
          </button>
          <div className="flex flex-col items-end gap-1">
            {!isLeadProfileValid() && (
              <span className="text-[11px] text-slate-500">
                Completa i campi obbligatori per continuare
              </span>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!isLeadProfileValid()}
              className="inline-flex items-center justify-center rounded-full px-6 py-2 text-xs sm:text-sm font-semibold bg-slate-900 text-white shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {nextButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeadQualificationWizard
