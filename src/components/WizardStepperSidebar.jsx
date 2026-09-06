function WizardStepperSidebar({ wizardStep, address }) {
  const steps = [
    { id: 1, key: 'address', label: 'Indirizzo' },
    { id: 2, key: 'features', label: 'Caratteristiche' },
    { id: 3, key: 'media', label: 'Foto e planimetria (opzionale)' },
    { id: 4, key: 'lead', label: 'Ultime informazioni' }
  ]

  const getCurrentMacroStep = () => {
    if (
      wizardStep === 'landing_address' ||
      wizardStep === 'confirm_address'
    ) {
      return 'address'
    }
    if (
      wizardStep === 'property_type' ||
      wizardStep === 'main_features' ||
      wizardStep === 'extra_features'
    ) {
      return 'features'
    }
    if (wizardStep === 'media_upload') {
      return 'media'
    }
    if (
      wizardStep === 'lead_profile' ||
      wizardStep === 'ownership_and_timing' ||
      wizardStep === 'agency_offer_and_marketing'
    ) {
      return 'lead'
    }
    return 'address'
  }

  const currentMacro = getCurrentMacroStep()

  const addressDisplay = address?.display || ''

  const isCompleted = (stepKey) => {
    const order = ['address', 'features', 'media', 'lead']
    const currentIndex = order.indexOf(currentMacro)
    const stepIndex = order.indexOf(stepKey)
    return stepIndex < currentIndex
  }

  const isCurrent = (stepKey) => stepKey === currentMacro

  return (
    <div className="flex flex-col w-full max-w-sm lg:max-w-md">
      <div className="rounded-3xl border-2 border-slate-900 bg-white px-5 py-5 shadow-[6px_6px_0_rgba(15,23,42,1)] flex flex-col">
        <div className="hidden md:block">
          <ol className="space-y-4">
          {steps.map((step, index) => {
            const completed = isCompleted(step.key)
            const current = isCurrent(step.key)
            const stepNumber = index + 1
            return (
              <li key={step.id} className="flex items-start">
                <div className="flex flex-col items-center mr-3">
                  <div
                    className={`flex items-center justify-center h-7 w-7 rounded-full border-2 text-xs font-semibold ${
                      completed
                        ? 'border-slate-900 bg-white text-slate-900'
                        : current
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {completed ? '✓' : stepNumber}
                  </div>
                  {stepNumber < steps.length && (
                    <div className="w-px flex-1 bg-slate-300 mt-1" />
                  )}
                </div>
                <div className="pt-1">
                  <div
                    className={`text-sm font-semibold ${
                      current
                        ? 'text-slate-900'
                        : completed
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {stepNumber}. {step.label}
                  </div>
                  {step.key === 'address' && addressDisplay && (
                    <div className="text-xs text-slate-600 mt-1">
                      {addressDisplay}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
          </ol>
        </div>
        <div className="mt-6 pt-4 border-t-2 border-slate-900">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 mb-2">
            La tua valutazione
          </div>
          <div className="text-xs text-slate-600 max-w-xs">
            Completa tutti i passaggi per ottenere una valutazione precisa del tuo immobile.
          </div>
        </div>
      </div>
    </div>
  )
}

export default WizardStepperSidebar
