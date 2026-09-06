function ExtraFeaturesToggle({
  propertyDraft,
  setPropertyDraft,
  wizardData,
  setWizardData,
  onNext,
  onBack
}) {
  const toggleExtra = (field) => {
    setWizardData((prev) => ({
      ...prev,
      extra: {
        ...prev.extra,
        [field]: !prev.extra[field]
      }
    }))
  }

  const toggleElevator = () => {
    setPropertyDraft((prev) => ({
      ...prev,
      hasElevator: !prev.hasElevator
    }))
  }

  const handleNext = () => {
    onNext()
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-[0.18em] mb-2">
        PASSAGGIO 2 DI 5
      </div>
      <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
        Extra dell&apos;immobile
      </h2>
      <p className="mt-3 text-sm text-gray-700 max-w-xl">
        Indica gli extra principali: ci aiutano a affinare la valutazione finale.
      </p>

      <div className="mt-8 rounded-3xl border-2 border-slate-900 bg-white px-6 py-6 shadow-[6px_6px_0_rgba(15,23,42,1)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={toggleElevator}
          className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
            propertyDraft.hasElevator
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-900 bg-white text-slate-900'
          }`}
        >
          <span>Ascensore</span>
          <span className="font-semibold">
            {propertyDraft.hasElevator ? 'Sì' : 'No'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => toggleExtra('hasBalconyOrTerrace')}
          className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
            wizardData.extra.hasBalconyOrTerrace
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-900 bg-white text-slate-900'
          }`}
        >
          <span>Terrazzo e balcone</span>
          <span className="font-semibold">
            {wizardData.extra.hasBalconyOrTerrace ? 'Sì' : 'No'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => toggleExtra('hasGarden')}
          className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
            wizardData.extra.hasGarden
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-900 bg-white text-slate-900'
          }`}
        >
          <span>Giardino</span>
          <span className="font-semibold">
            {wizardData.extra.hasGarden ? 'Sì' : 'No'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => toggleExtra('hasGarage')}
          className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 text-sm ${
            wizardData.extra.hasGarage
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-900 bg-white text-slate-900'
          }`}
        >
          <span>Garage/posto auto</span>
          <span className="font-semibold">
            {wizardData.extra.hasGarage ? 'Sì' : 'No'}
          </span>
        </button>
        </div>
        <div className="mt-8 pt-4 border-t-2 border-slate-900 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-xs sm:text-sm font-semibold text-slate-900 hover:underline"
          >
            Indietro
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center justify-center rounded-full px-6 py-2 text-xs sm:text-sm font-semibold bg-slate-900 text-white shadow-[4px_4px_0_rgba(15,23,42,1)] hover:bg-slate-800"
          >
            Prosegui
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExtraFeaturesToggle
